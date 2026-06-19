import { create } from 'zustand';

export const STEPS = {
  IDLE: 'IDLE',
  BRIDGE: 'BRIDGE',
  BRIO: 'BRIO',
  GENERAL: 'GENERAL',
  DONE: 'DONE'
};

const makeDeferred = () => ({
  status: 'idle',
  value: null,
  error: null,
  initialText: ''
});

export const useIngestionFlowStore = create((set, get) => ({
  step: STEPS.IDLE,
  brioDeferred: makeDeferred(),
  sessionId: null,
  files: [],

  setStep: (step) => set({ step }),
  setFiles: (files) => set({ files }),

  startIngestion: async (files, aiConfig, context = {}) => {
    // Generate a unique session ID to prevent race conditions
    const sessionId = Date.now().toString() + '_' + Math.random().toString(36).substring(2);
    
    set({
      step: STEPS.BRIDGE,
      sessionId,
      files,
      brioDeferred: { status: 'pending', value: null, error: null, initialText: '' }
    });

    if (!files || files.length === 0) {
        if (get().sessionId === sessionId) {
            set({ brioDeferred: makeDeferred() });
        }
        return;
    }

    try {
      // 0. Verser TOUS les fichiers dans la bibliothèque globale
      const { useDocumentStore } = await import('./useDocumentStore.js');
      const allFiles = Array.isArray(files) ? files : [files];
      
      // On fera la sauvegarde documentaire globale avec les fichiers originaux + les pièces jointes
      // mais on peut déjà sauvegarder les originaux.
      useDocumentStore.getState().addDocuments(allFiles);

      // 1. Extraire le texte (comme dans handleAutoBrioPrep)
      const msgFile = allFiles.find(f => f.name.toLowerCase().endsWith('.msg'));
      
      if (!msgFile) {
          if (get().sessionId === sessionId) {
              set({ brioDeferred: makeDeferred() });
          }
          return;
      }
      
      const { parseMsgFile } = await import('../services/utils/msgUtils.js');
      const { buildContentArrayParallel } = await import('../services/utils/aiHelpers.js');
      
      const { bodyText, attachments } = await parseMsgFile(msgFile);
      let fullText = bodyText ? `[Email principal]\n${bodyText}\n\n` : '';
      
      // Ajouter les pièces jointes MSG à la bibliothèque globale
      if (attachments && attachments.length > 0) {
          useDocumentStore.getState().addDocuments(attachments);
      }
      
      const filesToExtract = [...attachments];
      for (const f of allFiles) {
          if (f !== msgFile) filesToExtract.push(f);
      }
      
      if (filesToExtract.length > 0) {
          const extractedContent = await buildContentArrayParallel(filesToExtract, "", { forceVision: false, maxPdfPages: 10, maxTextLength: 15000 });
          const extractedText = extractedContent.filter(c => c.type === 'text').map(c => c.text).join('\n');
          if (extractedText.trim()) {
              fullText += `[TEXTE EXTRAIT DES PIÈCES JOINTES ET AUTRES DOCUMENTS]\n${extractedText}`;
          }
      }
      
      fullText = fullText.trim();
      
      // Update intermediate state (useful if we want to show the text in Brio while it loads)
      if (get().sessionId === sessionId) {
          set(s => ({ brioDeferred: { ...s.brioDeferred, initialText: fullText } }));
      }

      if (!fullText) {
          if (get().sessionId === sessionId) {
              set({ brioDeferred: { status: 'idle', value: null, error: null, initialText: '' } });
          }
          return;
      }

      // 2. Appel IA Brio (Prefetch !)
      const { runBrioPrepAnalysis } = await import('../services/generators/generatorEngine.js');
      const { usePromptStore } = await import('./promptStore.js');
      
      const apiKey = aiConfig?.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
          throw new Error("Clé API manquante. Veuillez configurer l'IA dans les paramètres.");
      }

      const promptTemplate = usePromptStore.getState().getPrompt('prompt_brio_prep');
      const data = await runBrioPrepAnalysis(fullText, apiKey, promptTemplate);

      // Validation de la date (avec contexte)
      const { resolveSinistreDate } = await import('../services/dates/dateResolver.js');
      const { date, source } = resolveSinistreDate({ 
          aiDate: data.date, 
          declarationDate: context.declarationDate 
      });
      data.date = date;
      data.dateSource = source;

      if (get().sessionId === sessionId) {
         set({ brioDeferred: { status: 'fulfilled', value: data, error: null, initialText: fullText } });
      }

    } catch (err) {
      if (get().sessionId === sessionId) {
         set({ brioDeferred: { status: 'rejected', value: null, error: err.message, initialText: get().brioDeferred.initialText } });
      }
    }
  },

  resetIngestion: () => set({ step: STEPS.IDLE, brioDeferred: makeDeferred(), sessionId: null, files: [] })
}));
