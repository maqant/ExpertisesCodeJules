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

// v6.1.0 - Routeur Individuel : 1 appel par document, lecture complète, gpt-5.4-nano
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

        const systemPrompt = `Tu es un routeur intelligent chargé de trier des documents d'assurance et d'expertise sinistre.
Tu dois classer LE document fourni dans UNE OU PLUSIEURS des 4 catégories suivantes :
- "ADMIN" : Polices d'assurance, conditions générales, convocations d'expertise, documents officiels de couverture, et TOUT email ou document contenant un numéro de police, numéro de sinistre, nom de compagnie d'assurance, BCE, IBAN, date de sinistre ou données contractuelles.
- "SOCIAL" : Documents listant des personnes (noms, téléphones, emails), cartes d'identité, documents d'assurance personnels, échanges informels mentionnant des occupants ou propriétaires.
- "RECITS" : Rapports d'intervention, constats pompiers, chronologies des faits, déclarations circonstanciées de sinistre, descriptions techniques des dommages.
- "FINANCIER" : Devis, factures, tickets de caisse, justificatifs de paiement.

RÈGLES :
1. Analyse LE document en ENTIER (pas seulement le début).
2. Si le document contient des informations relevant de PLUSIEURS catégories (ex: un email qui contient un n° de police ET liste des noms ET décrit les circonstances), retourne TOUTES les catégories pertinentes.
3. Si le document ne relève que d'une seule catégorie, retourne quand même un tableau à 1 élément.
4. Les emails (.msg) contiennent quasi toujours des données ADMIN (références contractuelles) ET SOCIAL (noms, contacts).

Tu dois renvoyer STRICTEMENT un objet JSON valide qui mappe le nom exact du fichier à un TABLEAU de catégories.
Format attendu :
{
  "nom_du_fichier.msg": ["ADMIN", "SOCIAL", "RECITS"]
}
Ne renvoie aucun autre texte, juste le JSON.`;

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

                const payload = {
                    model: 'gpt-5.4-nano', // v6.1.0 - Ultra-rapide pour le triage
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: contentArray }
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.0 // Classification = déterministe
                };

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
