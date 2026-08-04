// src/services/pdf/PdfAssemblerEngine.js
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import localforage from 'localforage';
import { ANNEX_STATUS, updateManifestEntry, getFailedRequiredEntries } from './annexManifest.js';
import { AnnexLoadError, PdfAssemblyError } from './errors.js';

const DEFAULT_FETCH_TIMEOUT_MS = 30000;

async function fetchWithTimeout(url, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new AnnexLoadError(`Réponse HTTP ${response.status} pour "${url}".`, { url, status: response.status });
    }
    return await response.arrayBuffer();
  } catch (err) {
    if (err instanceof AnnexLoadError) throw err;
    if (err.name === 'AbortError') {
      throw new AnnexLoadError(`Timeout (${timeoutMs}ms) lors du chargement de "${url}".`, { url, timeoutMs });
    }
    throw new AnnexLoadError(`Échec réseau pour "${url}" : ${err.message}`, { url, cause: err });
  }
}

export class PdfAssemblerEngine {
  constructor(options = {}) {
    this.fetchTimeoutMs = options.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
    this.onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    this.addPageNumbers = options.addPageNumbers !== false;
    this.addSeparatorPages = options.addSeparatorPages !== false;
  }

  _emitProgress(step, detail = {}) {
    if (this.onProgress) {
      this.onProgress({ step, timestamp: Date.now(), ...detail });
    }
  }

  async _loadPdfBytes(source, label) {
    if (source instanceof ArrayBuffer) return source;
    if (source instanceof Uint8Array) return source.buffer;
    if (typeof source === 'string') {
      // Tentative localforage en premier, puis fetch URL
      try {
        const item = await localforage.getItem(source);
        if (item) {
          if (item instanceof ArrayBuffer) return item;
          if (item instanceof Uint8Array) return item.buffer;
          if (item instanceof Blob) return await item.arrayBuffer();
        }
      } catch (e) {
        // Fallback sur HTTP fetch si non présent dans IndexedDB
      }
      return fetchWithTimeout(source, this.fetchTimeoutMs);
    }
    if (source instanceof Blob) return source.arrayBuffer();
    throw new AnnexLoadError(`Source PDF non supportée pour "${label}".`, { label });
  }

  async _createSeparatorPage(targetDoc, font, label, pageIndex) {
    const page = targetDoc.addPage([595.28, 841.89]); // A4
    const fontSize = 20;
    const textWidth = font.widthOfTextAtSize(label, fontSize);
    page.drawText(label, {
      x: (page.getWidth() - textWidth) / 2,
      y: page.getHeight() / 2,
      size: fontSize,
      font,
      color: rgb(0.15, 0.15, 0.35),
    });
    page.drawText(`Annexe ${pageIndex}`, {
      x: 50,
      y: page.getHeight() - 60,
      size: 12,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    return page;
  }

  async _appendDocument(targetDoc, sourceBytes, label) {
    let sourceDoc;
    try {
      sourceDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
    } catch (err) {
      throw new PdfAssemblyError(`PDF illisible ou corrompu : "${label}".`, { label, cause: err });
    }
    const pageIndices = sourceDoc.getPageIndices();
    const copiedPages = await targetDoc.copyPages(sourceDoc, pageIndices);
    copiedPages.forEach((page) => targetDoc.addPage(page));
    return pageIndices.length;
  }

  _stampPageNumbers(doc, font) {
    const pages = doc.getPages();
    const total = pages.length;
    pages.forEach((page, i) => {
      const text = `${i + 1} / ${total}`;
      const fontSize = 9;
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      page.drawText(text, {
        x: page.getWidth() - textWidth - 40,
        y: 25,
        size: fontSize,
        font,
        color: rgb(0.35, 0.35, 0.35),
      });
    });
  }

  async assemble({ mainDocumentSource, manifest, metadata = {} }) {
    if (!mainDocumentSource) {
      throw new PdfAssemblyError('Document principal manquant.', {});
    }

    const targetDoc = await PDFDocument.create();
    const font = await targetDoc.embedFont(StandardFonts.Helvetica);
    let currentManifest = manifest;

    // 1. Document principal
    this._emitProgress('LOADING_MAIN');
    const mainBytes = await this._loadPdfBytes(mainDocumentSource, 'document principal');
    const mainPageCount = await this._appendDocument(targetDoc, mainBytes, 'document principal');
    this._emitProgress('MAIN_APPENDED', { pageCount: mainPageCount });

    // 2. Annexes
    let annexIndex = 0;
    for (const entry of currentManifest.entries) {
      annexIndex += 1;
      this._emitProgress('LOADING_ANNEX', { annexId: entry.id, label: entry.label });
      try {
        const annexBytes = await this._loadPdfBytes(entry.url, entry.label);
        if (this.addSeparatorPages) {
          await this._createSeparatorPage(targetDoc, font, entry.label, annexIndex);
        }
        const startPage = targetDoc.getPageCount() + 1;
        const pageCount = await this._appendDocument(targetDoc, annexBytes, entry.label);
        currentManifest = updateManifestEntry(currentManifest, entry.id, {
          status: ANNEX_STATUS.LOADED,
          pageCount,
          startPage,
          error: null,
        });
        this._emitProgress('ANNEX_APPENDED', { annexId: entry.id, pageCount });
      } catch (err) {
        currentManifest = updateManifestEntry(currentManifest, entry.id, {
          status: ANNEX_STATUS.FAILED,
          error: err.message,
        });
        this._emitProgress('ANNEX_FAILED', { annexId: entry.id, error: err.message });
        if (entry.required) {
          const failedRequired = getFailedRequiredEntries(currentManifest);
          throw new PdfAssemblyError(
            `Échec sur annexe(s) requise(s) : ${failedRequired.map((e) => e.label).join(', ')}.`,
            { failedIds: failedRequired.map((e) => e.id), cause: err }
          );
        }
      }
    }

    // 3. Métadonnées
    targetDoc.setTitle(metadata.title ?? 'Dossier assemblé');
    targetDoc.setAuthor(metadata.author ?? 'Système');
    targetDoc.setCreator(metadata.creator ?? 'PdfAssemblerEngine M1');
    targetDoc.setCreationDate(new Date());
    targetDoc.setModificationDate(new Date());

    // 4. Pagination
    if (this.addPageNumbers) {
      this._stampPageNumbers(targetDoc, font);
    }

    // 5. Sérialisation
    this._emitProgress('SERIALIZING');
    const finalBytes = await targetDoc.save();
    this._emitProgress('DONE', { totalPages: targetDoc.getPageCount() });

    return {
      bytes: finalBytes,
      blob: new Blob([finalBytes], { type: 'application/pdf' }),
      totalPages: targetDoc.getPageCount(),
      manifest: currentManifest,
    };
  }
}

export default PdfAssemblerEngine;
