// src/services/pdf/useDossierPdfPipeline.js
import { useState, useRef, useCallback, useEffect } from 'react';
import { buildAnnexManifest } from './annexManifest.js';
import { PdfAssemblerEngine } from './PdfAssemblerEngine.js';
import { PdfPipelineError, isPdfError } from './errors.js';

export const PIPELINE_STATUS = Object.freeze({
  IDLE: 'IDLE',
  BUILDING_MANIFEST: 'BUILDING_MANIFEST',
  ASSEMBLING: 'ASSEMBLING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
});

export function useDossierPdfPipeline(options = {}) {
  const [status, setStatus] = useState(PIPELINE_STATUS.IDLE);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const objectUrlRef = useRef(null);
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);

  const revokeCurrentUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      revokeCurrentUrl();
    };
  }, [revokeCurrentUrl]);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    revokeCurrentUrl();
    setStatus(PIPELINE_STATUS.IDLE);
    setProgress(null);
    setResult(null);
    setError(null);
  }, [revokeCurrentUrl]);

  const assembleFinal = useCallback(
    async ({ mainDocumentSource, rawAnnexes = [], metadata = {} }) => {
      const runId = ++runIdRef.current;
      const isStale = () => runIdRef.current !== runId || !mountedRef.current;

      revokeCurrentUrl();
      setError(null);
      setResult(null);
      setProgress(null);

      try {
        // 1. Manifest
        setStatus(PIPELINE_STATUS.BUILDING_MANIFEST);
        const manifest = buildAnnexManifest(rawAnnexes, {
          allowEmpty: options.allowEmptyAnnexes !== false,
        });
        if (isStale()) return null;

        // 2. Assemblage
        setStatus(PIPELINE_STATUS.ASSEMBLING);
        const engine = new PdfAssemblerEngine({
          fetchTimeoutMs: options.fetchTimeoutMs,
          addPageNumbers: options.addPageNumbers,
          addSeparatorPages: options.addSeparatorPages,
          onProgress: (evt) => {
            if (!isStale()) setProgress(evt);
          },
        });

        const assembled = await engine.assemble({
          mainDocumentSource,
          manifest,
          metadata,
        });
        if (isStale()) return null;

        // 3. Résultat final
        const objectUrl = URL.createObjectURL(assembled.blob);
        objectUrlRef.current = objectUrl;

        const finalResult = {
          blob: assembled.blob,
          bytes: assembled.bytes,
          objectUrl,
          totalPages: assembled.totalPages,
          manifest: assembled.manifest,
          generatedAt: new Date().toISOString(),
        };

        setResult(finalResult);
        setStatus(PIPELINE_STATUS.SUCCESS);
        return finalResult;
      } catch (err) {
        if (isStale()) return null;
        const pipelineError = isPdfError?.(err)
          ? err
          : new PdfPipelineError(`Erreur inattendue du pipeline : ${err.message}`, {
              cause: err,
            });
        setError(pipelineError);
        setStatus(PIPELINE_STATUS.ERROR);
        return null;
      }
    },
    [
      options.allowEmptyAnnexes,
      options.fetchTimeoutMs,
      options.addPageNumbers,
      options.addSeparatorPages,
      revokeCurrentUrl,
    ]
  );

  const downloadResult = useCallback(
    (filename = 'dossier-final.pdf') => {
      if (!result?.objectUrl) return false;
      const link = document.createElement('a');
      link.href = result.objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    },
    [result]
  );

  return {
    status,
    progress,
    result,
    error,
    isBusy:
      status === PIPELINE_STATUS.BUILDING_MANIFEST ||
      status === PIPELINE_STATUS.ASSEMBLING,
    assembleFinal,
    downloadResult,
    reset,
  };
}

export default useDossierPdfPipeline;
