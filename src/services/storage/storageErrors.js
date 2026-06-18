// Erreurs typées : interdiction absolue des catch silencieux.
// Chaque erreur porte un code exploitable par l'UI et la télémétrie.

export const StorageErrorCode = Object.freeze({
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  WRITE_FAILED: 'WRITE_FAILED',
  READ_FAILED: 'READ_FAILED',
  VERIFY_FAILED: 'VERIFY_FAILED',     // read-after-write incohérent
  MIGRATION_FAILED: 'MIGRATION_FAILED',
  CORRUPTED_DATA: 'CORRUPTED_DATA',
  NOT_FOUND: 'NOT_FOUND',
});

export class StorageError extends Error {
  constructor(code, message, { cause, dossierId } = {}) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.cause = cause;
    this.dossierId = dossierId;
  }
}

// Détecte un dépassement de quota quel que soit le navigateur.
export function isQuotaError(err) {
  return (
    err instanceof DOMException &&
    (err.code === 22 ||
      err.code === 1014 ||
      err.name === 'QuotaExceededError' ||
      err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  );
}
