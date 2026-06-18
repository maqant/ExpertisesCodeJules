// v6.1.0 - Pipeline Hardening
/**
 * router.js — Agent Routeur
 * Étape 1 du pipeline : Triage Multi-Catégories.
 * Classe chaque document INDIVIDUELLEMENT dans 1 ou PLUSIEURS catégories : ADMIN, SOCIAL, RECITS, FINANCIER.
 *
 * v6.1.0 - Refonte complète :
 * - 1 fichier = 1 appel API indépendant (Promise.all, pas de batching aveugle)
 * - Lecture COMPLÈTE du document (suppression de la troncature maxPdfPages/maxTextLength)
 * - Modèle : gpt-5.4-nano (ultra-rapide, suffisant pour classifier)
 */

import { buildContentArrayParallel } from '../utils/aiHelpers.js';
import { usePromptStore } from '../../store/promptStore.js';
import { buildAiPayload } from '../../ai/ai.resolver.js';
import { sanitizeAiConfig } from '../../ai/ai.config.js';
import { AI_ROLES } from '../../ai/ai.catalog.js';

// v6.1.0 - Routeur Individuel : 1 appel par document, lecture complète, gpt-5.4-nano
export const routeDocuments = async (files, providedApiKey = null, onStatusChange = null) => {
    const fileArray = Array.isArray(files) ? files : [files];
    const configStr = localStorage.getItem('expertise_aiConfig_v3');
    const config = sanitizeAiConfig(configStr ? JSON.parse(configStr) : {});
    const apiKey = providedApiKey || config.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
    const mode = apiKey ? 'live' : 'mock';

    if (mode === 'mock') {
        if (onStatusChange) onStatusChange('routing');
        await new Promise(resolve => setTimeout(resolve, 1000));
        const mockResult = {};
        fileArray.forEach(f => {
            mockResult[f.name || 'document_sans_nom'] = ['ADMIN'];
        });
        return { success: true, data: mockResult };
    }

    try {
        if (onStatusChange) onStatusChange('routing');

        const systemPrompt = usePromptStore.getState().getPrompt('ROUTER');

        // v6.1.0 - 1 appel par fichier en parallèle (pas de batching, lecture complète)
        const promises = fileArray.map(async (file) => {
            const fileName = file.name || 'document_sans_nom';
            
            // v6.3.2 - Skip API pour les images (goulot d'étranglement réseau)
            if (file.type && file.type.startsWith('image/')) {
                console.log(`[router v6.3.2] ⚡ Skip vision, routage local "${fileName}" → ["RECITS"]`);
                return { [fileName]: ['RECITS'] };
            }

            try {
                // Lecture COMPLÈTE : pas de maxPdfPages, pas de maxTextLength
                const contentArray = await buildContentArrayParallel([file], `Analyse et classe ce document : ${fileName}`);

                const payload = buildAiPayload(
                    config,
                    'agent_router', // Utilise le modèle nano/rapide pour le routage
                    [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: contentArray }
                    ],
                    { forceJsonResponse: true }
                );

                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    console.error(`[router v6.1.0] ❌ Erreur API pour "${fileName}":`, errorData);
                    // Fallback : MSG → ADMIN+SOCIAL+RECITS, PDF → ADMIN, autre → ADMIN
                    const fallback = fileName.toLowerCase().endsWith('.msg')
                        ? ['ADMIN', 'SOCIAL', 'RECITS']
                        : ['ADMIN'];
                    return { [fileName]: fallback };
                }

                const data = await response.json();
                let parsed = JSON.parse(data.choices[0].message.content);

                // Normaliser : si l'IA renvoie un string au lieu d'un tableau, le convertir
                for (const key of Object.keys(parsed)) {
                    if (typeof parsed[key] === 'string') {
                        parsed[key] = [parsed[key]];
                    }
                }

                console.log(`[router v6.1.0] ✅ "${fileName}" → ${JSON.stringify(parsed[fileName] || parsed[Object.keys(parsed)[0]])}`);
                return parsed;

            } catch (err) {
                console.error(`[router v6.1.0] ❌ Erreur pour "${fileName}":`, err);
                // Fallback sécurisé
                const fallback = fileName.toLowerCase().endsWith('.msg')
                    ? ['ADMIN', 'SOCIAL', 'RECITS']
                    : ['ADMIN'];
                return { [fileName]: fallback };
            }
        });

        // Attendre tous les scouts en parallèle
        const results = await Promise.all(promises);

        // Fusionner tous les résultats en un seul objet
        const parsedData = {};
        for (const result of results) {
            Object.assign(parsedData, result);
        }

        console.log(`[router v6.1.0] 🗺️ Routage complet:`, parsedData);
        return { success: true, data: parsedData };

    } catch (error) {
        console.error('[router v6.1.0] routeDocuments error :', error);
        return { success: false, error: error.message || 'Erreur lors du routage des documents.' };
    }
};
