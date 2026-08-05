/**
 * Smart Bridge Workflow — Machine à états finis du pipeline d'ingestion.
 * Logique 100% pure : testable sans DOM, sans React, sans mock.
 *
 * INVARIANT #1 : une seule modale visible à la fois (step est un scalaire).
 * INVARIANT #2 : AI_READY / AI_ERROR ne modifient JAMAIS `step` (human gate).
 * INVARIANT #3 : toute transition non déclarée est ignorée (pas de throw en prod,
 *                mais loguée pour observabilité).
 */

export const STEPS = Object.freeze({
  IDLE: 'IDLE',
  STEP1_REVIEW: 'STEP1_REVIEW',       // Modale 1 : revue prompt / analyse, copie
  STEP2_VALIDATE: 'STEP2_VALIDATE',   // Modale 2 : formulaire + aperçu document
  COMMITTING: 'COMMITTING',           // Écriture dossier en cours
});

export const EVENTS = Object.freeze({
  START: 'START',
  AI_READY: 'AI_READY',
  AI_ERROR: 'AI_ERROR',
  USER_CONFIRM: 'USER_CONFIRM',       // ← Le HUMAN GATE (bouton "Suivant/Analyser")
  USER_BACK: 'USER_BACK',
  USER_CANCEL: 'USER_CANCEL',
  COMMIT: 'COMMIT',
  COMMIT_SUCCESS: 'COMMIT_SUCCESS',
  COMMIT_FAILURE: 'COMMIT_FAILURE',
});

export const initialPipelineState = Object.freeze({
  step: STEPS.IDLE,
  context: {
    kind: null,          // 'contrat' | 'devis' | 'cause' | 'annexe' | ...
    file: null,
    files: [],
    prompt: null,        // Prompt présenté/copiable en Modale 1
    aiStatus: 'idle',    // 'idle' | 'running' | 'ready' | 'error'
    aiResult: null,      // Résultat Map-Reduce, PARQUÉ, jamais navigateur
    aiError: null,
    formDraft: null,     // Brouillon éditable en Modale 2
    commitError: null,
  },
});

/* Table de transitions : { [step]: { [event]: handler(state, action) } }
 * Ce qui n'est pas ici N'EXISTE PAS. Fin des race conditions. */
const transitions = {
  [STEPS.IDLE]: {
    [EVENTS.START]: (s, a) => ({
      step: STEPS.STEP1_REVIEW,
      context: {
        ...initialPipelineState.context,
        kind: a.payload.kind,
        file: a.payload.file ?? null,
        files: a.payload.files ?? (a.payload.file ? [a.payload.file] : []),
        prompt: a.payload.prompt,
        aiStatus: a.payload.aiStatus || 'running',
        aiResult: a.payload.aiResult || null
      },
    }),
  },

  [STEPS.STEP1_REVIEW]: {
    // ⚠️ CŒUR DU FIX : l'IA enrichit le contexte, le step NE BOUGE PAS.
    [EVENTS.AI_READY]: (s, a) => ({
      ...s,
      context: { ...s.context, aiStatus: 'ready', aiResult: a.payload },
    }),
    [EVENTS.AI_ERROR]: (s, a) => ({
      ...s,
      context: { ...s.context, aiStatus: 'error', aiError: a.payload },
    }),
    // Seul l'humain franchit le pont.
    [EVENTS.USER_CONFIRM]: (s) => ({
      step: STEPS.STEP2_VALIDATE,
      context: { ...s.context, formDraft: s.context.aiResult ?? {} },
    }),
    [EVENTS.USER_CANCEL]: () => initialPipelineState,
  },

  [STEPS.STEP2_VALIDATE]: {
    [EVENTS.USER_BACK]: (s) => ({ ...s, step: STEPS.STEP1_REVIEW }),
    [EVENTS.USER_CANCEL]: () => initialPipelineState,
    [EVENTS.COMMIT]: (s, a) => ({
      step: STEPS.COMMITTING,
      context: { ...s.context, formDraft: a.payload, commitError: null },
    }),
    // Résultat IA tardif arrivé après passage manuel : on le parque quand même.
    [EVENTS.AI_READY]: (s, a) => ({
      ...s,
      context: { ...s.context, aiStatus: 'ready', aiResult: a.payload },
    }),
  },

  [STEPS.COMMITTING]: {
    [EVENTS.COMMIT_SUCCESS]: () => initialPipelineState,
    [EVENTS.COMMIT_FAILURE]: (s, a) => ({
      step: STEPS.STEP2_VALIDATE,
      context: { ...s.context, commitError: a.payload },
    }),
  },
};

export function pipelineReducer(state, action) {
  const handler = transitions[state.step]?.[action.type];
  if (!handler) {
    if (import.meta.env.DEV) {
      console.warn(
        `[SmartBridge] Transition ignorée : "${action.type}" en étape "${state.step}".`
      );
    }
    return state; // Transition illégale = no-op. Robustesse absolue.
  }
  return handler(state, action);
}
