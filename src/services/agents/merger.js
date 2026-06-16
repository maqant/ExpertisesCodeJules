// v7.1.0 - Data-Driven Deduplication
/**
 * merger.js — Agent de Synthèse (Merge Agent)
 * Étape Finale du pipeline : Nettoie et déduplique les tableaux JSON (Occupants et Frais).
 * Force l'utilisation d'un modèle ultra-rapide et peu coûteux (ex: gpt-4o-mini).
 */

import { usePromptStore } from '../../store/promptStore.js';

export const runMergeAgent = async (occupants, expenses, providedApiKey = null, provider = 'openai') => {
    // Si la liste est vide ou très petite, inutile de payer ou d'attendre
    if ((!occupants || occupants.length <= 1) && (!expenses || expenses.length <= 1)) {
        return { success: true, data: { occupants: occupants || [], expenses: expenses || [] } };
    }

    const apiKey = providedApiKey || import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
        // Mode Mock / Pas de clé = on retourne tel quel (ou on pourrait faire un fallback JS)
        return { success: true, data: { occupants, expenses } };
    }

    // Le Merger utilise toujours le modèle le plus rapide/cheap possible.
    const mergeModel = provider === 'anthropic' ? 'claude-3-haiku-20240307' : 'gpt-4o-mini';

    const systemPrompt = usePromptStore.getState().getPrompt('MERGER');

    const payloadContent = JSON.stringify({ occupants, expenses }, null, 2);

    try {
        let endpoint = "https://api.openai.com/v1/chat/completions";
        let payload = {
            model: mergeModel,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: payloadContent }
            ],
            response_format: { type: "json_object" },
            temperature: 0.0 // Déterministe
        };

        let headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        };

        if (provider === 'anthropic') {
            endpoint = "https://api.anthropic.com/v1/messages";
            headers = {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerously-allow-browser": "true"
            };
            payload = {
                model: mergeModel,
                system: systemPrompt,
                messages: [{ role: "user", content: `Fusionne ce JSON et retourne uniquement un objet JSON (sans texte avant ou après) : \n${payloadContent}` }],
                max_tokens: 4096,
                temperature: 0.0
            };
        }

        const response = await fetch(endpoint, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `Erreur API HTTP ${response.status}`);
        }

        const data = await response.json();
        let content = "";
        
        if (provider === 'anthropic') {
            content = data.content[0].text;
            // Retrait manuel des backticks Markdown si présents (Haiku peut parfois les rajouter malgré les instructions)
            if (content.startsWith('```json')) content = content.replace(/^```json\s*/, '');
            if (content.endsWith('```')) content = content.replace(/\s*```$/, '');
        } else {
            content = data.choices[0].message.content;
        }

        const parsedData = JSON.parse(content);
        return { success: true, data: parsedData };

    } catch (error) {
        console.error("[merger] Erreur lors de la fusion :", error);
        // Fallback sécurisé : en cas de plantage IA ou JSON malformé, on renvoie les données d'origine (avec les doublons)
        return { success: false, data: { occupants, expenses }, error: error.message };
    }
};
