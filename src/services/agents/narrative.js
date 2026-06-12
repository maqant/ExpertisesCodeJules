// v6.1.0 - Pipeline Hardening
/**
 * narrative.js — Agent Récits
 * Étape 4 du pipeline : extraction et synthèse du récit (cause, localisation, réparations).
 * Ne reçoit que les documents taggués "RECITS".
 * Traitement SÉQUENTIEL par lots avec accumulation incrémentale de la cause.
 * v6.1.0 - Modèle : gpt-5.4 (spécialiste extraction JSON)
 */

import { buildContentArrayParallel } from '../utils/aiHelpers.js';

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
            const existingCauseBlock = currentCause && currentCause.trim()
                ? `\n\nCONTEXTE EXISTANT :\nVoici la cause actuelle rédigée jusqu'ici :\n"""\n${currentCause.trim()}\n"""\n\nRÈGLES D'ACCUMULATION :\n1. Si les nouveaux documents ne contiennent AUCUNE information technique pertinente, renvoie la cause actuelle À L'IDENTIQUE dans le champ "cause".\n2. Si les documents apportent des précisions, INTÈGRE-LES de manière fluide dans la cause existante sans détruire l'information précédente.\n3. Si les documents CONTREDISENT la cause actuelle, CONSERVE le constat initial ET fais état de la contradiction (ex: "Cependant, un second rapport de [intervenant] indique que...").\n4. Tu es un ACCUMULATEUR DE FAITS : tu ne supprimes JAMAIS d'informations valides.`
                : '';

            const systemPrompt = `Tu es un Agent Rédacteur spécialisé dans les expertises sinistres.
Ton rôle est d'analyser des documents narratifs (rapports de recherche de fuite, constats pompiers, emails circonstanciés, chronologies) et de rédiger une analyse structurée.

RÈGLES ABSOLUES :
1. RÈGLE D'EXHAUSTIVITÉ : Si aucune information pertinente n'est trouvée pour la cause, renvoie null. Si aucun document technique n'est à attacher, renvoie un tableau vide [].
2. Rédige une analyse concise et professionnelle. Ne fais pas d'introduction.
3. Si UN SEUL rapport est fourni, rédige un texte unique répondant aux 4 points ci-dessous.
4. Si PLUSIEURS rapports/avis sont fournis, sépare OBLIGATOIREMENT ton analyse avec des sauts de ligne et le nom de l'intervenant.
5. Tu dois extraire et répondre UNIQUEMENT à ces 4 questions :
   a) Quelle est l'origine exacte et technique du sinistre (la cause matérielle) ?
   b) Où est-elle localisée avec précision ?
   c) Quelles sont les conséquences matérielles directes constatées ?
   d) Quelles sont les réparations conservatoires ou définitives préconisées par le technicien ?
6. IMPORTANT (MAGIC DROP) : Détecte les fichiers sources techniques. Renvoie la liste EXACTE de leurs noms dans "technicalFilesToAttach". Si aucun, renvoie [].
7. ANTI-HALLUCINATION : NE JAMAIS inventer de dates.
8. Tu dois renvoyer STRICTEMENT et UNIQUEMENT un objet JSON valide.
${existingCauseBlock}

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
