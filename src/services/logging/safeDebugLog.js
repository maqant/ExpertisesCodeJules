/**
 * Garantit qu'un log de debug ne peut JAMAIS crasher l'ingestion,
 * ni passer silencieusement si l'appelant fournit un mauvais type.
 * Conforme à la contrainte "zéro erreur silencieuse".
 */
export const makeSafeDebugLog = (candidate) => {
  if (candidate == null) {
    // Pas de logger fourni : no-op explicite, c'est un choix valide.
    return () => {};
  }
  if (typeof candidate !== 'function') {
    // Mauvais type fourni : on ne crash pas l'ingestion,
    // mais on signale bruyamment en console (pas de silence).
    // eslint-disable-next-line no-console
    console.error(
      '[safeDebugLog] addDebugLog reçu n\'est pas une fonction:',
      typeof candidate,
      candidate
    );
    return () => {};
  }
  // Wrapping défensif : un throw dans le log ne doit pas tuer l'ingestion.
  return (...args) => {
    try {
      candidate(...args);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[safeDebugLog] le logger fourni a levé une exception:', e);
    }
  };
};
