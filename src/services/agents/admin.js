// v6.1.0 - Pipeline Hardening
/**
 * admin.js — Agent Administratif
 * Étape 2 du pipeline : extraction des données contractuelles, coordonnées, franchise.
 * Ne reçoit que les documents taggués "ADMIN".
 * v6.1.0 - Modèle : gpt-5.4 (spécialiste extraction JSON)
 */

import { processInParallelBatches, buildContentArrayParallel, normalizeDate } from '../utils/aiHelpers.js';
import { usePromptStore } from '../../store/promptStore.js';

/**
 * [v5.5.1] Étape 2 : L'Agent Administratif
 * Extrait les données administratives, contractuelles et les coordonnées.
 * Ne reçoit que les documents taggués "ADMIN".
 */
export const extractAdministrativeData = async (files, providedApiKey = null, onStatusChange = null, model = 'gpt-5.4') => {
    const fileArray = Array.isArray(files) ? files : [files];
    const apiKey = providedApiKey || import.meta.env.VITE_OPENAI_API_KEY;
    const mode = apiKey ? 'live' : 'mock';

    if (mode === 'mock') {
        if (onStatusChange) onStatusChange('extracting');
        await new Promise(resolve => setTimeout(resolve, 1500));
        return {
            success: true,
            data: {
                formData: {
                    dateExp: "2026-06-15", heureExp: "10:00", nomResidence: "Copropriété Les Acacias", adresse: "12 rue de la Paix, Paris", expertInfos: "M. Dupont",
                    dateSinistre: "2026-06-01", dateDeclaration: "2026-06-02", declarant: "Syndic ABC", nomCie: "AXA Belgium", nomContrat: "Top Habitation", numPolice: "POL-123", numSinistreCie: "SIN-999", 
                    numConditionsGenerales: "CG-2022", franchise: "Légale", pertesIndirectes: "10%", isAxa: true,
                    isContradictoire: false, cieContradictoire: "", bureauContradictoire: "", expertContradictoire: "", compteDeContradictoire: ""
                },
                references: [ { nom: "M. Martin", ref: "Réf Client 789" } ]
            }
        };
    }

    try {
        if (onStatusChange) onStatusChange('extracting');

        // v5.5.5 - Batching & Scalabilité : lots de 8 fichiers en parallèle
        const processBatch = async (batchFiles) => {
            const contentArray = await buildContentArrayParallel(batchFiles, "Voici les documents administratifs à analyser.");

            const systemPrompt = usePromptStore.getState().getPrompt('ADMIN');

            const payload = {
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: contentArray }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1
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
        
            // Post-traitement des dates et franchise dans le batch
            if (parsedData.formData) {
                const dateFields = ['dateExp', 'dateSinistre', 'dateDeclaration'];
                dateFields.forEach(field => {
                    const val = parsedData.formData[field];
                    if (val && typeof val === 'string' && val.trim() !== '') {
                        parsedData.formData[field] = normalizeDate(val);
                    }
                });

                if (!parsedData.formData.franchise || String(parsedData.formData.franchise).trim() === '') {
                    parsedData.formData.franchise = '';
                }
            }
            return parsedData;
        };

        const batchResults = await processInParallelBatches(fileArray, 8, processBatch);

        // v5.9.0 - Fusion intelligente : "plus spécifique gagne" pour les champs critiques
        const PRIORITY_FIELDS = new Set(['franchise', 'pertesIndirectes', 'numPolice', 'numSinistreCie', 'numConditionsGenerales', 'nomContrat']);
        const isMoreSpecific = (newVal, existingVal) => {
            if (!existingVal || existingVal === '') return true;
            if (!newVal || newVal === '') return false;
            const newHasNumbers = /\d/.test(String(newVal));
            const existingHasNumbers = /\d/.test(String(existingVal));
            if (newHasNumbers && !existingHasNumbers) return true;
            if (String(newVal).length > String(existingVal).length * 1.5) return true;
            return false;
        };

        let mergedFormData = {};
        let mergedReferences = [];

        for (const res of batchResults) {
            if (res.formData) {
                for (const key of Object.keys(res.formData)) {
                    const val = res.formData[key];
                    if (!val || val === '' || val === false) continue;
                    
                    if (PRIORITY_FIELDS.has(key)) {
                        // Champs critiques : la valeur la plus spécifique (avec chiffres, plus longue) gagne
                        if (isMoreSpecific(val, mergedFormData[key])) {
                            mergedFormData[key] = val;
                        }
                    } else if (!mergedFormData[key]) {
                        // Autres champs : premier non-vide gagne
                        mergedFormData[key] = val;
                    }
                }
            }
            if (res.references && Array.isArray(res.references)) {
                mergedReferences = mergedReferences.concat(res.references);
            }
        }
        
        return { success: true, data: { formData: mergedFormData, references: mergedReferences } };

    } catch (error) {
        console.error("[admin] extractAdministrativeData error :", error);
        return { success: false, error: error.message || "Erreur lors de l'extraction administrative." };
    }
};
