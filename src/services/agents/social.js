// v6.1.0 - Pipeline Hardening
/**
 * social.js — Agent Social (Générateur d'UUID)
 * Étape 3 du pipeline : extraction des personnes (occupants, experts, intervenants).
 * Ne reçoit que les documents taggués "SOCIAL".
 * v6.1.0 - Modèle : gpt-5.4 (spécialiste extraction JSON)
 */

import { processInParallelBatches, buildContentArrayParallel } from '../utils/aiHelpers.js';
import { usePromptStore } from '../../store/promptStore.js';
import { buildAiPayload } from '../../ai/ai.resolver.js';
import { sanitizeAiConfig } from '../../ai/ai.config.js';
import { AI_ROLES } from '../../ai/ai.catalog.js';

// v5.5.2
/**
 * Étape 3 : L'Agent Social (Générateur d'UUID)
 * Extrait les données sociales (experts, occupants) à partir des fichiers taggués "SOCIAL".
 */
export const extractSocialData = async (files, providedApiKey = null, onStatusChange = null) => {
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
                experts: [{ nom: "Expert Mock", tel: "0499 99 99 99" }],
                occupants: [{
                    id: crypto.randomUUID(), nom: "Locataire Mock", prenom: "Jean", etage: "1er", statut: "Locataire", tel: "0499 88 88 88", email: "jean@mock.com",
                    rc: false, rcPolice: "", secAssurance: false, secCie: "", secPolice: "", secType: "", contreExpert: false
                }],
                intervenants: [{
                    id: crypto.randomUUID(), nom: "Plombier Mock", prenom: "Pierre", role: "Plombier", societe: "ABC Plomberie", email: "", tel: "0470 00 00 00"
                }]
            }
        };
    }

    try {
        if (onStatusChange) onStatusChange('extracting');

        // v5.5.5 - Batching & Scalabilité : lots de 8 fichiers en parallèle
        const processBatch = async (batchFiles) => {
            const contentArray = await buildContentArrayParallel(batchFiles, "Voici les documents sociaux à analyser.");

            const systemPrompt = usePromptStore.getState().getPrompt('SOCIAL');

            const payload = buildAiPayload(
                config,
                'agent_social',
                [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: contentArray }
                ],
                { forceJsonResponse: true }
            );

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

            // Ajout UUID pour chaque occupant et intervenant
            if (parsedData.occupants && Array.isArray(parsedData.occupants)) {
                parsedData.occupants = parsedData.occupants.map(occ => ({ ...occ, id: crypto.randomUUID() }));
            }
            if (parsedData.intervenants && Array.isArray(parsedData.intervenants)) {
                parsedData.intervenants = parsedData.intervenants.map(inter => ({ ...inter, id: crypto.randomUUID() }));
            } else {
                parsedData.intervenants = [];
            }
            return parsedData;
        };

        const batchResults = await processInParallelBatches(fileArray, 8, processBatch);

        // Fusion : concaténer tous les tableaux
        let mergedExperts = [];
        let mergedOccupants = [];
        let mergedIntervenants = [];

        for (const res of batchResults) {
            if (res.experts && Array.isArray(res.experts)) mergedExperts = mergedExperts.concat(res.experts);
            if (res.occupants && Array.isArray(res.occupants)) mergedOccupants = mergedOccupants.concat(res.occupants);
            if (res.intervenants && Array.isArray(res.intervenants)) mergedIntervenants = mergedIntervenants.concat(res.intervenants);
        }

        // v5.9.0 - Déduplication par nom (case-insensitive) avec fusion des champs non-vides
        const deduplicateByName = (items) => {
            const seen = new Map();
            const result = [];
            for (const item of items) {
                const key = (item.nom || '').toLowerCase().trim();
                if (!key) { result.push(item); continue; }
                if (seen.has(key)) {
                    const existing = seen.get(key);
                    Object.keys(item).forEach(k => {
                        if (k !== 'id' && item[k] && item[k] !== '' && item[k] !== false && (!existing[k] || existing[k] === '' || existing[k] === false)) {
                            existing[k] = item[k];
                        }
                    });
                } else {
                    seen.set(key, item);
                    result.push(item);
                }
            }
            return result;
        };

        mergedOccupants = deduplicateByName(mergedOccupants);
        mergedExperts = deduplicateByName(mergedExperts);
        mergedIntervenants = deduplicateByName(mergedIntervenants);
        console.log(`[social] 👥 Social dédupliqué: ${mergedOccupants.length} occupants, ${mergedExperts.length} experts, ${mergedIntervenants.length} intervenants`);

        return { success: true, data: { experts: mergedExperts, occupants: mergedOccupants, intervenants: mergedIntervenants } };

    } catch (error) {
        console.error("[social] extractSocialData error :", error);
        return { success: false, error: error.message || "Erreur lors de l'extraction sociale." };
    }
};
