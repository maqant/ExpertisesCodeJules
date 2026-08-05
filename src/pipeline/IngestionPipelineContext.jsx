import React, { createContext, useContext, useReducer, useRef, useCallback, useEffect } from 'react';
import { pipelineReducer, initialPipelineState, STEPS, EVENTS } from './ingestionPipelineMachine';
import { extractDataFromDocument } from '../services/aiManager';
import { ExpertiseContext } from '../context/ExpertiseContext';

const PipelineCtx = createContext(null);

export const PROMPTS_DEFAUTS = {
  cp: `Tu es un assistant expert en extraction de données d'assurance. Extrais les informations du contrat d'assurance (Nom Compagnie, Produit, Police, N° Conditions Générales, Franchise, Pertes Indirectes, Nom Résidence).`,
  frais: `Tu es un assistant expert en extraction de factures et devis. Extrais le nom de l'entreprise, le type (Facture/Devis), le numéro de référence, la description des travaux, le montant réclamé et le régime TVA.`,
  cause: `Tu es un expert en bâtiment. Extrais la cause exacte et technique du sinistre, la localisation, les dommages constatés et les mesures conservatoires préconisées.`,
  annexe: `Lis ce document et donne-lui un titre concis et professionnel (max 1-2 lignes) destiné à servir de légende dans le rapport d'expertise.`
};

export function IngestionPipelineProvider({ children }) {
  const [state, dispatch] = useReducer(pipelineReducer, initialPipelineState);
  const sessionRef = useRef(0);
  const expertiseContext = useContext(ExpertiseContext);

  const start = useCallback(async ({ kind, file, files, aiConfig = {}, isAiModeActive = false, customPrompt = null, existingId = null }) => {
    const session = ++sessionRef.current;
    const prompt = customPrompt || PROMPTS_DEFAUTS[kind] || PROMPTS_DEFAUTS.frais;
    const targetFile = file || (files && files[0]);
    const targetFiles = files || (file ? [file] : []);

    // 1. Ouvre la Modale 1 IMMÉDIATEMENT (étape de revue/copie).
    dispatch({
      type: EVENTS.START,
      payload: {
        kind,
        file: targetFile,
        files: targetFiles,
        prompt,
        existingId,
        aiStatus: isAiModeActive ? 'running' : 'idle'
      }
    });

    // 2. Si l'IA est active, lancer l'extraction en tâche de fond.
    // Sa résolution enrichit le contexte de données mais NE MODIFIE PAS l'étape (HUMAN GATE).
    if (isAiModeActive && targetFiles.length > 0) {
      try {
        const result = await extractDataFromDocument(
          targetFiles,
          kind === 'cp' ? 'contrat' : kind,
          aiConfig.provider || 'openai',
          aiConfig.model || 'gpt-4o',
          aiConfig.apiKey || null
        );

        if (session !== sessionRef.current) return; // Invalider réponse orpheline

        if (result.success && result.data) {
          dispatch({ type: EVENTS.AI_READY, payload: result.data });
        } else {
          dispatch({ type: EVENTS.AI_ERROR, payload: result.error || "Échec de l'extraction IA" });
        }
      } catch (err) {
        if (session !== sessionRef.current) return;
        dispatch({ type: EVENTS.AI_ERROR, payload: err?.message || "Erreur réseau lors de l'analyse IA" });
      }
    }
  }, []);

  const confirmStep1 = useCallback(() => {
    dispatch({ type: EVENTS.USER_CONFIRM });
  }, []);

  // Écouter le passage à STEP2_VALIDATE pour ouvrir la Modale 2 (UniversalIngestionModal)
  useEffect(() => {
    if (state.step === STEPS.STEP2_VALIDATE && expertiseContext?.openIngestion) {
      const { kind, file, aiResult, existingId } = state.context;
      
      let initialData = aiResult;
      if (kind === 'frais' && aiResult?.expenses && aiResult.expenses.length > 0) {
        initialData = aiResult.expenses[0];
      } else if (kind === 'annexe' && aiResult?.title) {
        initialData = { customName: aiResult.title };
      }

      expertiseContext.openIngestion(file, kind, initialData, existingId);
    }
  }, [state.step, state.context, expertiseContext]);

  const back = useCallback(() => dispatch({ type: EVENTS.USER_BACK }), []);

  const cancel = useCallback(() => {
    sessionRef.current++; // Invalide toute réponse IA en vol
    dispatch({ type: EVENTS.USER_CANCEL });
  }, []);

  const commit = useCallback(async (formValues, persistFn) => {
    dispatch({ type: EVENTS.COMMIT, payload: formValues });
    try {
      if (persistFn) await persistFn(formValues);
      dispatch({ type: EVENTS.COMMIT_SUCCESS });
    } catch (err) {
      dispatch({ type: EVENTS.COMMIT_FAILURE, payload: err?.message || "Erreur lors de l'enregistrement" });
    }
  }, []);

  return (
    <PipelineCtx.Provider value={{ state, start, confirmStep1, back, cancel, commit, STEPS }}>
      {children}
    </PipelineCtx.Provider>
  );
}

export function useIngestionPipeline() {
  const ctx = useContext(PipelineCtx);
  if (!ctx) throw new Error('useIngestionPipeline doit être utilisé sous IngestionPipelineProvider');
  return ctx;
}
