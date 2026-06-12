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
Avant de formater le JSON, réfléchis en suivant ces étapes :
1. Liste mentalement TOUTES les personnes physiques et morales mentionnées dans les documents.
2. Pour chaque personne, détermine son RÔLE exact : est-ce un occupant du bien (locataire, propriétaire) ou un intervenant extérieur (plombier, syndic, courtier, expert, proche, etc.) ?
3. Pour les propriétaires : est-il EXPLICITEMENT dit qu'il occupe le bien ("propriétaire occupant", "habite sur place") ou qu'il ne l'occupe pas ("propriétaire bailleur", "ne réside pas") ? Si rien n'est précisé, utilise "Propriétaire (occupation inconnue)".
4. Classe chaque personne dans le bon tableau (occupants OU intervenants) puis formate le JSON.

RÈGLES ABSOLUES :
1. N'invente AUCUNE information. Si l'information n'est pas présente, renvoie une chaîne vide "" ou false pour les booléens.
2. Le champ "statut" de chaque occupant DOIT IMPÉRATIVEMENT être l'une de ces 5 valeurs EXACTES :
   - "Locataire"
   - "Propriétaire occupant"
   - "Propriétaire non occupant"
   - "Propriétaire (occupation inconnue)" ← SI le document dit juste "propriétaire" sans préciser s'il habite sur place
   - "ACP" ← Pour l'Association des Copropriétaires
3. SÉPARATION STRICTE DES TABLEAUX : Les tableaux "occupants", "intervenants" et "experts" sont MUTUELLEMENT EXCLUSIFS. 
   - Une personne ne peut exister QUE DANS UN SEUL tableau.
   - Si une personne est propriétaire, locataire ou ACP, elle va dans "occupants" et NE DOIT ABSOLUMENT PAS se retrouver dans "intervenants".
   - TOUTE autre personne (syndic, plombier, courtier, proche, etc.) va dans "intervenants".
4. SÉPARATION STRICTE EXPERTS / INTERVENANTS : Distingue rigoureusement le tableau "experts" du tableau "intervenants".
   - Un "expert" est STRICTEMENT un expert interne de compagnie d'assurance ou un membre d'un bureau d'expertise reconnu (ex: CED, Dekra, Ebex, Lexa, Aube Immo, Mosa).
   - Les entreprises de recherche de fuite (Visiotherm, Verdetec, Polygon), les artisans, courtiers, plombiers, syndics NE SONT ABSOLUMENT PAS des experts et doivent aller dans "intervenants".
5. EXCLUSION ABSOLUE : Le Bureau Péchard (ou Bureau Yves Péchard) et ses employés NE SONT JAMAIS des experts ni des intervenants. C'est le bureau de gestion mandaté. Tu dois impérativement les IGNORER et les EXCLURE de tous les tableaux (experts, occupants, intervenants).
6. PRÉCISION DU RÔLE ET DE L'IDENTITÉ :
   - Pour les gestionnaires, agences immobilières ou syndics, le champ "role" doit préciser EXACTEMENT de quel appartement/lot/propriétaire ils s'occupent. Par exemple, au lieu de juste "Gestionnaire", écris "Gestionnaire (appartement de M. Dupont)" ou "Agence immobilière (représente le proprio du 3ème)".
   - Si une civilité est précisée (M., Mme, Monsieur, Madame), inclus-la avec le nom de famille (ex: "Mme Borremans"). N'invente pas le genre, mais s'il est connu, précise-le.
7. Tu dois renvoyer STRICTEMENT et UNIQUEMENT un objet JSON valide, sans aucune introduction, sans formatage markdown additionnel autre que le JSON.

Voici le format EXACT attendu, avec tous les champs présents :
{
  "experts": [ { "nom": "", "tel": "" } ],
  "occupants": [
    {
      "nom": "", "prenom": "", "etage": "", "statut": "Locataire", "tel": "", "email": "",
      "rc": false, "rcPolice": "", "secAssurance": false, "secCie": "", "secPolice": "", "secType": "", "contreExpert": false
    }
  ],
  "intervenants": [
    {
      "nom": "", "prenom": "", "role": "", "societe": "", "email": "", "tel": ""
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
