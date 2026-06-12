// v5.9.2 - Modularisation aiManager
/**
 * router.js — Agent Routeur
 * Étape 1 du pipeline : Triage Multi-Catégories.
 * Classe un ensemble de documents dans 1 ou PLUSIEURS catégories : ADMIN, SOCIAL, RECITS, FINANCIER.
 */

import { processInParallelBatches, buildContentArrayParallel } from '../utils/aiHelpers.js';

/**
 * [v5.5.11] Étape 1 : Le Routeur (Triage Multi-Catégories)
 * Classe un ensemble de documents dans 1 ou PLUSIEURS catégories : ADMIN, SOCIAL, RECITS, FINANCIER.
 * Un document mixte (ex: email contenant des noms ET un récit) peut être classé dans ["SOCIAL", "RECITS"].
 * Utilise gpt-4o pour analyser rapidement un extrait ou la 1ère page.
 */
export const routeDocuments = async (files, providedApiKey = null, onStatusChange = null) => {
    const fileArray = Array.isArray(files) ? files : [files];
    const apiKey = providedApiKey || import.meta.env.VITE_OPENAI_API_KEY;
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

        // v5.5.5 - Batching & Scalabilité : lots de 10 fichiers en parallèle
        const processBatch = async (batchFiles) => {
            const contentArray = await buildContentArrayParallel(batchFiles, "Voici les documents à classifier.", { maxPdfPages: 1, maxTextLength: 5000 });

            const systemPrompt = `Tu es un routeur intelligent chargé de trier des documents d'assurance et d'expertise sinistre.
Tu dois classer CHAQUE document fourni dans UNE OU PLUSIEURS des 4 catégories suivantes :
- "ADMIN" : Polices d'assurance, conditions générales, convocations d'expertise, documents officiels de couverture.
- "SOCIAL" : Emails de syndic listant des noms, cartes d'identité, documents d'assurance personnels ou échanges informels.
- "RECITS" : Rapports d'intervention, constats pompiers, chronologies des faits, déclarations circonstanciées.
- "FINANCIER" : Devis, factures, tickets de caisse, justificatifs de paiement.

RÈGLES :
1. Analyse l'extrait (texte ou premières pages) de chaque document et détermine ses catégories.
2. Si un document contient des informations relevant de PLUSIEURS catégories (ex: un email qui liste des noms ET décrit les circonstances du sinistre), tu DOIS retourner un TABLEAU contenant toutes les catégories pertinentes.
3. Si un document ne relève que d'une seule catégorie, retourne quand même un tableau à 1 élément.

Tu dois renvoyer STRICTEMENT un objet JSON valide qui mappe le nom exact de chaque fichier à un TABLEAU de catégories.
Format attendu :
{
  "police_axa.pdf": ["ADMIN"],
  "email_syndic.msg": ["SOCIAL", "RECITS"],
  "facture_plombier.jpg": ["FINANCIER"]
}
Ne renvoie aucun autre texte, juste le JSON.`;

            const payload = {
                model: "gpt-4o",
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
            return JSON.parse(data.choices[0].message.content);
        };

        const batchResults = await processInParallelBatches(fileArray, 10, processBatch);
        
        // Fusion des résultats de tous les lots
        let parsedData = {};
        for (const batchResult of batchResults) {
            Object.assign(parsedData, batchResult);
        }
        
        // v5.5.11 - Normaliser : si l'IA renvoie un string au lieu d'un tableau, le convertir
        for (const key of Object.keys(parsedData)) {
            if (typeof parsedData[key] === 'string') {
                parsedData[key] = [parsedData[key]];
            }
        }
        
        return { success: true, data: parsedData };

    } catch (error) {
        console.error("[router] routeDocuments error :", error);
        return { success: false, error: error.message || "Erreur lors du routage des documents." };
    }
};
