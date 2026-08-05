import React from 'react';
import { useIngestionPipeline } from './IngestionPipelineContext';
import { STEPS } from './ingestionPipelineMachine';
import { PromptReviewModal } from '../components/modals/PromptReviewModal';

/**
 * SmartBridgeOrchestrator :
 * Garantit l'ordre strict des modales.
 * Modale 1 (Revue / Copie / Attente IA) -> Modale 2 (Formulaire & Aperçu Document)
 */
export function SmartBridgeOrchestrator() {
  const { state, confirmStep1, cancel } = useIngestionPipeline();

  if (state.step === STEPS.STEP1_REVIEW) {
    return (
      <PromptReviewModal
        kind={state.context.kind}
        file={state.context.file}
        prompt={state.context.prompt}
        aiStatus={state.context.aiStatus}
        aiResult={state.context.aiResult}
        aiError={state.context.aiError}
        onConfirm={confirmStep1}
        onCancel={cancel}
      />
    );
  }

  return null;
}
