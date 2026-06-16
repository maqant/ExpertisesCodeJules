// v6.1.0 - Pipeline Hardening
/**
 * social.js — Agent Social (Générateur d'UUID)
 * Étape 3 du pipeline : extraction des personnes (occupants, experts, intervenants).
 * Ne reçoit que les documents taggués "SOCIAL".
 * v6.1.0 - Modèle : gpt-5.4 (spécialiste extraction JSON)
 */

import { processInParallelBatches, buildContentArrayParallel } from '../utils/aiHelpers.js';

// v5.5.2
/**
 * Étape 3 : L'Agent Social (Générateur d'UUID)
 * Extrait les données sociales (experts, occupants) à partir des fichiers taggués "SOCIAL".
 */
export const extractSocialData = async (files, providedApiKey = null, onStatusChange = null, model = 'gpt-5.4') => {
    const fileArray = Array.isArray(files) ? files : [files];
    const apiKey = providedApiKey || import.meta.env.VITE_OPENAI_API_KEY;
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

            const systemPrompt = `Tu es un Agent Social expert dans l'analyse de documents liés aux expertises immobilières.
Ton rôle est de lire ces documents (emails de syndics, tableaux de contacts, baux de location) et d'identifier TOUTES les personnes mentionnées.

MÉTHODE DE TRAVAIL (Chain of Thought) :
Avant de formater le JSON, utilise le champ "_raisonnement" pour :
1. Lister mentalement TOUTES les personnes physiques et morales mentionnées.
2. Déterminer leur RÔLE exact (occupant ou intervenant extérieur).
3. Classer chaque personne dans le bon tableau.

RÈGLES ABSOLUES :
1. RÈGLE D'EXHAUSTIVITÉ : Si une information est introuvable (ex: pas d'email, pas de téléphone), tu DOIS obligatoirement renvoyer la valeur null (pas de chaîne vide "", pas de "N/A"). N'omets aucune clé.
2. N'invente AUCUNE information.
3. Le champ "statut" de chaque occupant DOIT IMPÉRATIVEMENT être l'une de ces 5 valeurs EXACTES : "Locataire", "Propriétaire occupant", "Propriétaire non occupant", "Propriétaire (occupation inconnue)", "ACP".
4. SÉPARATION STRICTE DES TABLEAUX : Les tableaux "occupants", "intervenants" et "experts" sont MUTUELLEMENT EXCLUSIFS.
5. SÉPARATION STRICTE EXPERTS / INTERVENANTS : Distingue rigoureusement le tableau "experts" du tableau "intervenants".
6. EXCLUSION ABSOLUE : Le Bureau Péchard et ses employés NE SONT JAMAIS des experts ni des intervenants. Tu dois impérativement les IGNORER.
7. PRÉCISION DU RÔLE ET DE L'IDENTITÉ : Précise de quel lot/appartement s'occupe un syndic. Inclus la civilité (M., Mme) si elle est connue.
8. Tu dois renvoyer STRICTEMENT et UNIQUEMENT un objet JSON valide.

v7.0.0 - RÈGLE DE NORMALISATION DES NOMS (CRITIQUE) :
- Le champ "nom" doit TOUJOURS contenir UNIQUEMENT le NOM DE FAMILLE, en MAJUSCULES, sans civilité.
  ✅ Correct : nom: "DUPONT", prenom: "Jean-Pierre"
  ❌ Interdit : nom: "M. Jean-Pierre Dupont", nom: "dupont", nom: "DUPONT Jean-Pierre"
- Enlevez toujours la civilité (M., Mme, Mr, Mlle, Dr) du nom, et mettez-la en majuscule.

v7.0.0 - RÈGLE ANTI-DOUBLON (CRITIQUE) :
- Si la MÊME personne apparaît plusieurs fois dans un fil de discussion (signature, CC, corps du mail),
  ne la liste QU'UNE SEULE FOIS. La clé d'unicité est le NOM DE FAMILLE normalisé.
- Si une personne est mentionnée avec des détails complémentaires dans plusieurs messages,
  fusionne les informations dans une seule entrée (ex: email trouvé dans le 1er message + téléphone dans le 2ème → une entrée avec les deux).

v7.0.0 - EXTRACTION IBAN :
- Si un IBAN ou des coordonnées bancaires (compte bancaire, numéro de compte) sont mentionnés
  pour un occupant, extrais-les dans le champ "iban".

Voici le format EXACT attendu, avec tous les champs présents :
{
  "_raisonnement": "Ta réflexion étape par étape sur les personnes identifiées, leur rôle et leur rattachement avant de formater les tableaux",
  "experts": [ { "nom": null, "tel": null } ],
  "occupants": [
    {
      "nom": null, "prenom": null, "etage": null, "statut": "Locataire", "tel": null, "email": null,
      "iban": null, "rc": false, "rcPolice": null, "secAssurance": false, "secCie": null, "secPolice": null, "secType": null, "contreExpert": false
    }
  ],
  "intervenants": [
    {
      "nom": null, "prenom": null, "role": null, "societe": null, "email": null, "tel": null
    }
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
