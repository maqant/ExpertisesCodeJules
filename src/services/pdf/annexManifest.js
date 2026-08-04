// src/services/pdf/annexManifest.js
import { AnnexManifestError } from './errors.js';

export const ANNEX_STATUS = Object.freeze({
  PENDING: 'PENDING',
  LOADED: 'LOADED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
});

const SUPPORTED_MIME_TYPES = ['application/pdf'];
const MAX_ANNEX_SIZE_BYTES = 50 * 1024 * 1024; // 50 Mo

function assertNonEmptyString(value, field, annexId) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AnnexManifestError(
      `Champ "${field}" invalide ou manquant pour l'annexe "${annexId ?? 'inconnue'}".`,
      { annexId, field }
    );
  }
}

export function normalizeAnnexEntry(raw, index) {
  if (!raw || typeof raw !== 'object') {
    throw new AnnexManifestError(`Entrée d'annexe invalide à l'index ${index}.`, { index });
  }

  const id = raw.id ?? `annex-${index}`;
  assertNonEmptyString(raw.label ?? raw.title, 'label', id);
  assertNonEmptyString(raw.url ?? raw.sourceUrl ?? raw.dbKey, 'url', id);

  const mimeType = raw.mimeType ?? 'application/pdf';
  if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
    throw new AnnexManifestError(
      `Type MIME non supporté "${mimeType}" pour l'annexe "${id}".`,
      { annexId: id, mimeType }
    );
  }

  if (raw.sizeBytes != null && raw.sizeBytes > MAX_ANNEX_SIZE_BYTES) {
    throw new AnnexManifestError(
      `L'annexe "${id}" dépasse la taille maximale autorisée (${MAX_ANNEX_SIZE_BYTES} octets).`,
      { annexId: id, sizeBytes: raw.sizeBytes }
    );
  }

  return Object.freeze({
    id,
    label: (raw.label ?? raw.title).trim(),
    url: (raw.url ?? raw.sourceUrl ?? raw.dbKey).trim(),
    dbKey: raw.dbKey ?? raw.url ?? null,
    mimeType,
    sizeBytes: raw.sizeBytes ?? null,
    order: Number.isFinite(raw.order) ? raw.order : index,
    required: raw.required !== false,
    status: ANNEX_STATUS.PENDING,
    pageCount: null,
    startPage: null,
    error: null,
  });
}

export function buildAnnexManifest(rawAnnexes, options = {}) {
  const { allowEmpty = true } = options;

  if (!Array.isArray(rawAnnexes)) {
    throw new AnnexManifestError('La liste des annexes doit être un tableau.', {
      received: typeof rawAnnexes,
    });
  }

  if (rawAnnexes.length === 0) {
    if (!allowEmpty) {
      throw new AnnexManifestError('Le manifest ne peut pas être vide.', {});
    }
    return { entries: [], totalCount: 0, requiredCount: 0 };
  }

  const entries = rawAnnexes.map((raw, index) => normalizeAnnexEntry(raw, index));

  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.id)) {
      throw new AnnexManifestError(`ID d'annexe dupliqué : "${entry.id}".`, {
        annexId: entry.id,
      });
    }
    seen.add(entry.id);
  }

  entries.sort((a, b) => a.order - b.order);

  return {
    entries,
    totalCount: entries.length,
    requiredCount: entries.filter((e) => e.required).length,
  };
}

export function updateManifestEntry(manifest, annexId, patch) {
  const entries = manifest.entries.map((entry) =>
    entry.id === annexId ? Object.freeze({ ...entry, ...patch }) : entry
  );
  return { ...manifest, entries };
}

export function getFailedRequiredEntries(manifest) {
  return manifest.entries.filter(
    (e) => e.required && e.status === ANNEX_STATUS.FAILED
  );
}
