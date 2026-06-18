// v7.1.0 - Data-Driven Deduplication
/**
 * merger.js — Agent de Synthèse (Merge Agent)
 * Étape Finale du pipeline : Nettoie et déduplique les tableaux JSON (Occupants et Frais).
 * Force l'utilisation d'un modèle ultra-rapide et peu coûteux (ex: gpt-4o-mini).
 */

import { usePromptStore } from '../../store/promptStore.js';
import { buildAiPayload } from '../../ai/ai.resolver.js';
import { sanitizeAiConfig } from '../../ai/ai.config.js';
import { executeAiCall } from '../../ai/apiClient.js';

export const runMergeAgent = async (occupants, expenses, providedApiKey = null) => {
    // Si la liste est vide ou très petite, inutile de payer ou d'attendre
    if ((!occupants || occupants.length <= 1) && (!expenses || expenses.length <= 1)) {
        return { success: true, data: { occupants: occupants || [], expenses: expenses || [] } };
    }

    const configStr = localStorage.getItem('expertise_aiConfig_v3');
    const config = sanitizeAiConfig(configStr ? JSON.parse(configStr) : {});
    const apiKey = providedApiKey || config.apiKey || import.meta.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
        // Mode Mock / Pas de clé = on retourne tel quel (ou on pourrait faire un fallback JS)
        return { success: true, data: { occupants, expenses } };
    }

    const systemPrompt = usePromptStore.getState().getPrompt('MERGER');
    const payloadContent = JSON.stringify({ occupants, expenses }, null, 2);

    try {
        const payload = buildAiPayload(
            config,
            'agent_merger', // Utilise le modèle le plus rapide/cheap pour le nettoyage
            [
                { role: "system", content: systemPrompt },
                { role: "user", content: payloadContent }
            ],
            { forceJsonResponse: true, maxTokensOverride: 4096 }
        );

        const data = await executeAiCall({
            apiKey,
            payload,
            componentId: 'agent_merger'
        });

        const content = data.choices[0].message.content;
        const parsedData = JSON.parse(content);
        return { success: true, data: parsedData };

    } catch (error) {
        console.error("[merger] Erreur lors de la fusion :", error);
        // Fallback sécurisé : en cas de plantage IA ou JSON malformé, on renvoie les données d'origine (avec les doublons)
        return { success: false, data: { occupants, expenses }, error: error.message };
    }
};
