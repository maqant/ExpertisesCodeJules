// v6.1.1 - Fix React #31 : normalisation stricte du champ "cause" (string garanti)
/**
 * narrative.js — Agent Récits
 * Étape 4 du pipeline : extraction et synthèse du récit (cause, localisation, réparations).
 * Ne reçoit que les documents taggués "RECITS".
 * Traitement SÉQUENTIEL par lots avec accumulation incrémentale de la cause.
 * v6.1.0 - Modèle : gpt-5.4 (spécialiste extraction JSON)
 */

import { processInParallelBatches, buildContentArrayParallel } from '../utils/aiHelpers.js';
import { usePromptStore } from '../../store/promptStore.js';
import { buildAiPayload } from '../../ai/ai.resolver.js';
import { sanitizeAiConfig } from '../../ai/ai.config.js';
import { AI_ROLES } from '../../ai/ai.catalog.js';
import { executeAiCall } from '../../ai/apiClient.js';
import { parseAiJson } from '../utils/aiJsonParser.js';
import { normalizeAiTextField } from '../utils/aiFieldNormalizers.js';

// v5.5.3
/**
 * Étape 4 : L'Agent Récits (Texte libre)
 * Extrait et synthétise les données textuelles (cause, compte rendu, divers) 
 * à partir des fichiers taggués "RECITS".
 */
export const extractNarrativeData = async (files, providedApiKey = null, onStatusChange = null, existingCause = '') => {
    const fileArray = Array.isArray(files) ? files : [files];
    const configStr = localStorage.getItem('expertise_aiConfig_v3');
    const config = sanitizeAiConfig(configStr ? JSON.parse(configStr) : {});
    const apiKey = providedApiKey || config.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
    const mode = apiKey ? 'live' : 'mock';

    if (mode === 'mock') {
        if (onStatusChange) onStatusChange('extracting');
        await new Promise(resolve => setTimeout(resolve, 1500));
        return {
            success: true,
            data: {
                cause: "Fuite d'eau suite à la rupture d'une canalisation encastrée dans le mur de la salle de bain."
            }
        };
    }

    try {
        if (onStatusChange) onStatusChange('extracting');

        // v5.5.5 - Batching & Scalabilité : traitement SÉQUENTIEL par lots de 8
        // Chaque lot reçoit la cause du lot précédent comme contexte (prompt incrémental)
        let currentCause = existingCause;
        let allTechnicalFiles = [];

        for (let i = 0; i < fileArray.length; i += 8) {
            const batchFiles = fileArray.slice(i, i + 8);
            console.log(`[narrative] 📝 Agent Récits: lot ${Math.floor(i/8) + 1}/${Math.ceil(fileArray.length/8)} (${batchFiles.length} fichiers)`);
            
            const contentArray = await buildContentArrayParallel(batchFiles, "Voici les documents (récits, rapports, chronologies) à synthétiser.");

            // Prompt incrémental : au lot 2+, on passe la cause précédente
            const basePrompt = usePromptStore.getState().getPrompt('NARRATIVE_BASE');
            const accumulationRules = usePromptStore.getState().getPrompt('NARRATIVE_ACCUMULATION');
            const existingCauseBlock = existingCause && currentCause !== ''
                ? `\n\nCONTEXTE EXISTANT :\nVoici la cause actuelle rédigée jusqu'ici :\n"""\n${currentCause.trim()}\n"""\n\n${accumulationRules}`
                : '';
                
            const systemPrompt = `${basePrompt}${existingCauseBlock}

Voici le format EXACT attendu :
{
  "_raisonnement": "Analyse étape par étape des documents pour identifier l'origine, la localisation, les conséquences et les réparations.",
  "cause": "OBLIGATOIREMENT une chaîne de caractères unique (string) contenant l'analyse rédigée en paragraphes séparés par \\n — JAMAIS un objet ni un tableau — ou null si aucune information.",
  "technicalFilesToAttach": []
}`;

            const payload = buildAiPayload(
                config,
                'agent_narrative',
                [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: contentArray }
                ],
                { forceJsonResponse: true }
            );

            const data = await executeAiCall({
                apiKey,
                payload,
                componentId: 'agent_narrative'
            });

            const parsedData = parseAiJson(data.choices[0].message.content, { componentId: 'agent_narrative' });
            
            // Accumuler : la cause de ce lot devient le contexte du lot suivant
            const normalizedCause = normalizeAiTextField(parsedData.cause, {
                componentId: 'agent_narrative',
                fieldName: 'cause',
            });
            if (normalizedCause !== '') {
                currentCause = normalizedCause;
            }
            if (parsedData.technicalFilesToAttach && Array.isArray(parsedData.technicalFilesToAttach)) {
                allTechnicalFiles = allTechnicalFiles.concat(parsedData.technicalFilesToAttach);
            }
        }

        return { success: true, data: { cause: currentCause, technicalFilesToAttach: allTechnicalFiles } };

    } catch (error) {
        console.error("[narrative] extractNarrativeData error :", error);
        return { success: false, error: error.message || "Erreur lors de l'extraction narrative." };
    }
};
