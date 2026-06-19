export const makeSuccess = (fileName, pdfBytes) => ({
  fileName,
  status: 'success',
  pdfBytes,
  error: null,
});

export const makeError = (fileName, error) => ({
  fileName,
  status: 'error',
  pdfBytes: null,
  error: typeof error === 'string' ? error : (error?.message ?? 'Erreur inconnue'),
});
