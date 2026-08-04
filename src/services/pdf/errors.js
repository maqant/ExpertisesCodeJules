/**
 * src/services/pdf/errors.js
 * ─────────────────────────────────────────────────────────────────────────
 * Taxonomie d'erreurs typées du pipeline "Physical-First Assembly".
 * ─────────────────────────────────────────────────────────────────────────
 */

export const PDF_PIPELINE_PHASES = Object.freeze({
  MANIFEST: 'MANIFEST',
  FORGE: 'FORGE',
  CONVERGENCE: 'CONVERGENCE',
  FUSION: 'FUSION',
});

export const PDF_ERROR_CODES = Object.freeze({
  PIPELINE_GENERIC: 'PDF_PIPELINE_ERROR',
  MANIFEST_INTEGRITY: 'PDF_MANIFEST_INTEGRITY',
  ANNEX_INTEGRITY: 'PDF_ANNEX_INTEGRITY',
  STORAGE_ACCESS: 'PDF_STORAGE_ACCESS',
  PHYSICAL_FORGE: 'PDF_PHYSICAL_FORGE',
  CONVERGENCE_UNSTABLE: 'PDF_CONVERGENCE_UNSTABLE',
  FUSION_FAILURE: 'PDF_FUSION_FAILURE',
  NAVIGATION_INDEX: 'PDF_NAVIGATION_INDEX',
  PIPELINE_ABORTED: 'PDF_PIPELINE_ABORTED',
});

export class PdfPipelineError extends Error {
  constructor(message, options = {}) {
    const {
      code = PDF_ERROR_CODES.PIPELINE_GENERIC,
      phase = null,
      context = {},
      cause = null,
    } = options;

    super(message);
    this.name = 'PdfPipelineError';
    this.code = code;
    this.phase = phase;
    this.context = Object.freeze({ ...context });
    this.cause = cause;
    this.timestamp = new Date().toISOString();

    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      phase: this.phase,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
      cause: this.cause ? { name: this.cause.name, message: this.cause.message, stack: this.cause.stack } : null,
      stack: this.stack,
    };
  }
}

export class ManifestIntegrityError extends PdfPipelineError {
  constructor(message, context = {}, cause = null) {
    super(message, { code: PDF_ERROR_CODES.MANIFEST_INTEGRITY, phase: PDF_PIPELINE_PHASES.MANIFEST, context, cause });
    this.name = 'ManifestIntegrityError';
  }
}

export class AnnexManifestError extends ManifestIntegrityError {
  constructor(message, context = {}, cause = null) {
    super(message, context, cause);
    this.name = 'AnnexManifestError';
  }
}

export class AnnexIntegrityError extends PdfPipelineError {
  constructor(message, context = {}, cause = null) {
    super(message, { code: PDF_ERROR_CODES.ANNEX_INTEGRITY, phase: PDF_PIPELINE_PHASES.FORGE, context, cause });
    this.name = 'AnnexIntegrityError';
  }
}

export class AnnexLoadError extends AnnexIntegrityError {
  constructor(message, context = {}, cause = null) {
    super(message, context, cause);
    this.name = 'AnnexLoadError';
  }
}

export class StorageAccessError extends PdfPipelineError {
  constructor(message, context = {}, cause = null) {
    super(message, { code: PDF_ERROR_CODES.STORAGE_ACCESS, phase: PDF_PIPELINE_PHASES.FORGE, context, cause });
    this.name = 'StorageAccessError';
  }
}

export class PhysicalForgeError extends PdfPipelineError {
  constructor(message, context = {}, cause = null) {
    super(message, { code: PDF_ERROR_CODES.PHYSICAL_FORGE, phase: PDF_PIPELINE_PHASES.FORGE, context, cause });
    this.name = 'PhysicalForgeError';
  }
}

export class PdfAssemblyError extends PhysicalForgeError {
  constructor(message, context = {}, cause = null) {
    super(message, context, cause);
    this.name = 'PdfAssemblyError';
  }
}

export class ConvergenceError extends PdfPipelineError {
  constructor(message, context = {}, cause = null) {
    super(message, { code: PDF_ERROR_CODES.CONVERGENCE_UNSTABLE, phase: PDF_PIPELINE_PHASES.CONVERGENCE, context, cause });
    this.name = 'ConvergenceError';
  }
}

export class FusionError extends PdfPipelineError {
  constructor(message, context = {}, cause = null) {
    super(message, { code: PDF_ERROR_CODES.FUSION_FAILURE, phase: PDF_PIPELINE_PHASES.FUSION, context, cause });
    this.name = 'FusionError';
  }
}

export class NavigationIndexError extends PdfPipelineError {
  constructor(message, context = {}, cause = null) {
    super(message, { code: PDF_ERROR_CODES.NAVIGATION_INDEX, phase: PDF_PIPELINE_PHASES.FUSION, context, cause });
    this.name = 'NavigationIndexError';
  }
}

export function isPdfPipelineError(err) {
  return err instanceof PdfPipelineError;
}

export const isPdfError = isPdfPipelineError;
