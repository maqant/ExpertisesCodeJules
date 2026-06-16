// v6.1.0 - Pipeline Hardening
/**
 * narrative.js — Agent Récits
 * Étape 4 du pipeline : extraction et synthèse du récit (cause, localisation, réparations).
 * Ne reçoit que les documents taggués "RECITS".
 * Traitement SÉQUENTIEL par lots avec accumulation incrémentale de la cause.
 * v6.1.0 - Modèle : gpt-5.4 (spécialiste extraction JSON)
 */

import { processInParallelBatches, buildContentArrayParallel } from '../utils/aiHelpers.js';
import { usePromptStore } from '../../store/promptStore.js';

// v5.5.3
/**
 * Étape 4 : L'Agent Récits (Texte libre)
 * Extrait et synthétise les données textuelles (cause, compte rendu, divers) 
 * à partir des fichiers taggués "RECITS".
 */
export const extractNarrativeData = async (files, providedApiKey = null, onStatusChange = null, model = 'gpt-5.4', existingCause = '') => {
    const fileArray = Array.isArray(files) ? files : [files];
    const apiKey = providedApiKey || import.meta.env.VITE_OPENAI_API_KEY;
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
  "cause": null,
  "technicalFilesToAttach": []
}`;

            const payload = {
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: contentArray }
                ],
                response_format: { type: "json_object" },
                temperature: 0.0
            };

            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Erreur API HTTP ${response.status}`);
            }

            const data = await response.json();
            const parsedData = JSON.parse(data.choices[0].message.content);
            
            // Accumuler : la cause de ce lot devient le contexte du lot suivant
            if (parsedData.cause) {
                currentCause = parsedData.cause;
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
