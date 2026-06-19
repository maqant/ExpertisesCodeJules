import { makeSuccess, makeError } from './msgAnnexResult.js';

/**
 * Convertit une liste de fichiers .msg en PDF (1ère page) de façon
 * NON bloquante (cède le thread entre chaque), avec callbacks de progression.
 *
 * @param {File[]} files
 * @param {Object} options
 * @param {(bytes: ArrayBuffer) => Promise<Uint8Array>} options.convertFn  Injection de msgToSinglePagePdf
 * @param {(done: number, total: number, currentName: string) => void} [options.onProgress]
 * @param {() => boolean} [options.isCancelled]  Permet d'annuler à chaud
 * @returns {Promise<{results: MsgAnnexResult[], successCount: number, errorCount: number, cancelled: boolean}>}
 */
export async function processBulkMsg(files, {
  convertFn,
  onProgress = () => {},
  isCancelled = () => false,
} = {}) {
  if (typeof convertFn !== 'function') {
    throw new Error('processBulkMsg: convertFn (msgToSinglePagePdf) est requis.');
  }

  const list = Array.from(files).filter(
    (f) => f && typeof f.name === 'string' && f.name.toLowerCase().endsWith('.msg'),
  );

  const results = [];
  let cancelled = false;

  for (let i = 0; i < list.length; i++) {
    if (isCancelled()) {
      cancelled = true;
      break;
    }

    const file = list[i];
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfBytes = await convertFn(arrayBuffer);

      if (!pdfBytes || pdfBytes.length === 0) {
        results.push(makeError(file.name, 'Conversion vide (PDF non généré).'));
      } else {
        results.push(makeSuccess(file.name, pdfBytes));
      }
    } catch (err) {
      // Aucune perte silencieuse : l'échec est enregistré nommément.
      results.push(makeError(file.name, err));
    }

    onProgress(i + 1, list.length, file.name);

    // Cède le thread pour ne pas figer l'UI (yield après chaque fichier lourd).
    await new Promise((resolve) => setTimeout(resolve, 10)); // petit délai pour assurer la fluidité
  }

  const successCount = results.filter((r) => r.status === 'success').length;
  const errorCount = results.filter((r) => r.status === 'error').length;

  return { results, successCount, errorCount, cancelled };
}
