// v6.1.0 - Pipeline Hardening
/**
 * admin.js — Agent Administratif
 * Étape 2 du pipeline : extraction des données contractuelles, coordonnées, franchise.
 * Ne reçoit que les documents taggués "ADMIN".
 * v6.1.0 - Modèle : gpt-5.4 (spécialiste extraction JSON)
 */

import { processInParallelBatches, buildContentArrayParallel, normalizeDate, resolveFranchiseLegale } from '../utils/aiHelpers.js';

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

            const systemPrompt = `Tu es un Agent Administratif expert en assurances et expertises sinistres. 
Ton rôle est d'analyser attentivement les documents fournis (polices d'assurance, conditions particulières, convocations, correspondances) et d'en extraire les informations contractuelles, les coordonnées de l'expertise et les références.

CONTEXTE IMPORTANT :
- Le bureau d'expertise en charge est toujours "Bureau Péchard". N'essaie pas d'extraire notre nom ou notre référence de dossier (refPechard) car nous le connaissons déjà en interne. Concentre-toi sur les données du sinistre et de la compagnie d'assurance.

RÈGLES ABSOLUES :
1. RÈGLE D'EXHAUSTIVITÉ : Si une information est introuvable dans le texte, tu DOIS obligatoirement renvoyer la valeur null (pas de chaîne vide "", pas de "N/A", et tu ne dois pas omettre la clé).
2. N'invente AUCUNE information.
3. Remplis les champs avec précision.
4. Si la compagnie d'assurance (nomCie) est "AXA", ou une de ses filiales, tu DOIS ABSOLUMENT mettre le booléen "isAxa" à true. Sinon false.
5. "pertesIndirectes" doit être un pourcentage (ex: "10%") ou null si non trouvé.
6. FRANCHISE - Tu dois extraire DEUX informations distinctes :
   a) "franchiseBrute" : le montant ou texte brut de la franchise tel qu'il apparaît dans le document (ex: "250", "600€", "indice 119", "franchise anglaise de 500€", "franchise x3").
   b) "typeFranchise" : déduis le TYPE de franchise selon ces règles :
      - "Legale" si le montant est inférieur à 400€ OU s'il y a une référence à un indice IPC/abex.
      - "Speciale" si c'est un gros forfait OU un multiplicateur.
      - "Anglaise" si le texte mentionne "franchise anglaise".
      - null si aucune franchise n'est mentionnée.
7. Tu dois renvoyer STRICTEMENT et UNIQUEMENT un objet JSON valide, sans aucune introduction.

Voici le format EXACT attendu, avec tous les champs présents :
{
  "_raisonnement": "Ta réflexion étape par étape sur les entités, dates et chiffres identifiés avant de remplir le reste du JSON",
  "formData": {
    "dateExp": null, "heureExp": null, "nomResidence": null, "adresse": null, "expertInfos": null,
    "dateSinistre": null, "dateDeclaration": null, "declarant": null, "nomCie": null, "nomContrat": null, "numPolice": null, "numSinistreCie": null, 
    "numConditionsGenerales": null, "franchiseBrute": null, "typeFranchise": null, "pertesIndirectes": null, "isAxa": false,
    "isContradictoire": false, "cieContradictoire": null, "bureauContradictoire": null, "expertContradictoire": null, "compteDeContradictoire": null
  },
  "references": [ 
    { "nom": null, "ref": null } 
  ]
}`;

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

                try {
                    const typeFranchise = (parsedData.formData.typeFranchise || '').trim();
                    const franchiseBrute = (parsedData.formData.franchiseBrute || '').trim();
                    
                    if (typeFranchise && franchiseBrute) {
                        if (typeFranchise === 'Legale') {
                            const dateSinistre = parsedData.formData.dateSinistre;
                            if (dateSinistre && dateSinistre.trim() !== '') {
                                const resolved = resolveFranchiseLegale(dateSinistre);
                                if (resolved !== null) {
                                    parsedData.formData.franchise = `${resolved}€`;
                                } else {
                                    parsedData.formData.franchise = 'Légale';
                                }
                            } else {
                                parsedData.formData.franchise = '⚠️ À calculer (Date de sinistre requise)';
                            }
                        } else if (typeFranchise === 'Speciale') {
                            const montantMatch = franchiseBrute.match(/[\d.,]+/);
                            const montantStr = montantMatch ? montantMatch[0].replace(',', '.') : franchiseBrute;
                            parsedData.formData.franchise = `Spéciale : ${montantStr}€`;
                        } else if (typeFranchise === 'Anglaise') {
                            const montantMatch = franchiseBrute.match(/[\d.,]+/);
                            const montantStr = montantMatch ? montantMatch[0].replace(',', '.') : franchiseBrute;
                            parsedData.formData.franchise = `${montantStr}€ Anglaise`;
                        } else {
                            parsedData.formData.franchise = franchiseBrute;
                        }
                    } else if (franchiseBrute && !typeFranchise) {
                        parsedData.formData.franchise = franchiseBrute;
                    } else {
                        parsedData.formData.franchise = parsedData.formData.franchise || '';
                    }
                } catch (franchiseErr) {
                    parsedData.formData.franchise = parsedData.formData.franchiseBrute || parsedData.formData.franchise || '';
                }
                
                delete parsedData.formData.franchiseBrute;
                delete parsedData.formData.typeFranchise;
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
