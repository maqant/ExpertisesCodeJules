// v6.0.0 - Context Vault & Mail Generator
import { buildDeclarationPrompt } from './templates/declarationMail.js';
import { withRetry } from '../utils/aiHelpers.js';

/**
 * Registre des templates disponibles.
 * Pour ajouter un nouveau type de document, il suffit d'ajouter une entrée ici.
 */
const TEMPLATES = {
    declaration: buildDeclarationPrompt,
};

/**
 * generateDocument — Moteur de génération documentaire scalable.
 * 
 * Appelle OpenAI avec le bon template pour produire un document formaté
 * à partir des données du dossier et du Context Vault.
 * 
 * @param {string} type - Le type de document à générer (ex: 'declaration')
 * @param {Object} dossierState - { formData, rawContexts, references }
 * @param {string} apiKey - Clé API OpenAI
 * @param {string} [model='gpt-5.4'] - Modèle à utiliser (v6.1.0 : gpt-5.4)
 * @returns {Promise<string>} Le texte généré
 */
export const generateDocument = async (type, dossierState, apiKey, model = 'gpt-5.4') => {
    const builder = TEMPLATES[type];
    if (!builder) {
        throw new Error(`[Generator] Template inconnu : "${type}". Templates disponibles : ${Object.keys(TEMPLATES).join(', ')}`);
    }

    const { systemPrompt, userContent } = builder(dossierState);

    console.log(`[Generator] 📝 Génération type="${type}" avec modèle=${model}`);
    console.log(`[Generator] Context Vault : ${(dossierState.rawContexts || []).length} entrée(s)`);

    // v5.9.3 - Smart Retry & Résilience
    const callApi = async () => {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userContent }
                ],
                temperature: 0.3,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`API ${response.status}: ${errBody}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;

        if (!text) {
            throw new Error('[Generator] Réponse vide de l\'API.');
        }

        return text;
    };

    return withRetry(callApi, 1, 2000);
};
