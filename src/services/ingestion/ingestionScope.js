/**
 * Ingestion Scope — Étanchéité des contextes d'ingestion SmartBridge.
 *
 * ISOLATED : création d'un nouveau dossier. AUCUN contexte du dossier
 *            précédent ne doit atteindre l'IA (cause, attachedFiles, etc.).
 * MERGE    : enrichissement du dossier courant. Le contexte est passé
 *            EXPLICITEMENT par l'appelant, jamais lu depuis une closure.
 */

export const INGESTION_MODES = Object.freeze({
  ISOLATED: 'ISOLATED',
  MERGE: 'MERGE',
});

export function createIsolatedScope() {
  return Object.freeze({
    mode: INGESTION_MODES.ISOLATED,
    cause: '',
    attachedFiles: {},
  });
}

export function createMergeScope({ cause = '', attachedFiles = {} } = {}) {
  return Object.freeze({
    mode: INGESTION_MODES.MERGE,
    cause,
    attachedFiles: { ...attachedFiles }, // copie défensive : fige l'état au moment du geste
  });
}

export class SmartBridgeIsolationError extends Error {
  constructor(leakedKeys) {
    super(
      `[SmartBridge] VIOLATION D'ÉTANCHÉITÉ : documents de contexte détectés en mode ISOLATED : ${leakedKeys.join(', ')}`
    );
    this.name = 'SmartBridgeIsolationError';
    this.leakedKeys = leakedKeys;
  }
}

export function assertIsolation(scope, provenance) {
  if (scope.mode !== INGESTION_MODES.ISOLATED) return;
  const leaked = (provenance || [])
    .filter((p) => p.source === 'context')
    .map((p) => p.name);
  if (leaked.length > 0) {
    throw new SmartBridgeIsolationError(leaked);
  }
}
