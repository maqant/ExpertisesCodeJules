import { buildAiPayload } from '../ai/ai.resolver.js';
import { sanitizeAiConfig } from '../ai/ai.config.js';
import { executeAiCall } from '../ai/apiClient.js';
import { isPdfDeep } from './utils/fileUtils.js';
import { pdfToBase64Images, fileToBase64 } from './utils/pdfUtils.js';

const FINANCIAL_DOC_SYSTEM_PROMPT = `Tu es un expert en assurance. Tu vas recevoir un document financier lié à un sinistre.
Ta tâche est de :
1. IDENTIFIER le type de document parmi : "DECOMPTE" (un tableau de décompte avec des postes de frais détaillés) ou "LETTRE_PAIEMENT" (une lettre de la compagnie confirmant un versement/règlement à un assuré, sans détail des postes).
2. EXTRAIRE les données pertinentes selon le type.

Retourne UNIQUEMENT un objet JSON avec la structure suivante :

Si c'est un DÉCOMPTE (tableau avec postes de frais détaillés) :
{
  "type": "DECOMPTE",
  "postes": [
    { "id": "uuid", "libelle": "Nom du poste", "montant": 760.00 }
  ]
}
- Extrais uniquement les lignes de frais individuelles, pas le total général.
- Le montant doit toujours être un nombre positif.

Si c'est une LETTRE DE PAIEMENT (confirmation de versement) :
{
  "type": "LETTRE_PAIEMENT",
  "paiement": {
    "montant": 3094.39,
    "beneficiaire": "Nom du bénéficiaire",
    "date": "2026-06-15",
    "reference": "SIN/2026/12345",
    "communication": "Texte de la communication structurée si disponible"
  }
}
- Le montant est le montant total versé (nombre positif).
- La date est au format ISO (YYYY-MM-DD).
- Si un champ n'est pas identifiable, mets null (pas une string vide).

IMPORTANT : Ne retourne RIEN d'autre que le JSON. Pas d'explication, pas de commentaire.`;

// Ancien prompt conservé pour rétrocompatibilité
const DECOMPTE_SYSTEM_PROMPT = `Tu es un expert en assurance. Tu vas recevoir le texte d'une lettre de règlement d'indemnité. 
Ta tâche est d'extraire uniquement les lignes de frais individuelles du tableau de décompte. 
Retourne UNIQUEMENT un objet JSON avec une clé "postes" contenant un tableau d'objets. Chaque objet doit avoir :
- "id" : un identifiant unique généré (uuid ou string aléatoire).
- "libelle" (string) : le nom exact du poste.
- "montant" (number) : le montant positif en euros.

Exemple de données que tu vas rencontrer : 'Frais de syndic 760,00' ou 'Bâtiment (Dommages au 1er étage M. Willems) 4.800,00'. Ne récupère pas le montant total général.`;

/**
 * Prépare le contenu multimodal (images PDF ou image brute) pour l'IA.
 * @param {File} file
 * @returns {Promise<Array>} contentArray
 */
async function prepareFileContent(file) {
    const contentArray = [{ type: "text", text: "Voici le document financier à analyser." }];

    if (await isPdfDeep(file)) {
        const base64Images = await pdfToBase64Images(file);
        for (const img of base64Images) {
            contentArray.push({
                type: "image_url",
                image_url: { url: img }
            });
        }
    } else if (file.type.startsWith('image/')) {
        const base64Image = await fileToBase64(file);
        contentArray.push({
            type: "image_url",
            image_url: { url: base64Image }
        });
    } else {
        throw new Error("Format de fichier non supporté. Veuillez glisser un PDF ou une image.");
    }

    return contentArray;
}

/**
 * Analyse un document financier et le classifie automatiquement.
 * @param {File} file 
 * @param {string} [providedApiKey=null]
 * @returns {Promise<{ type: 'DECOMPTE' | 'LETTRE_PAIEMENT', postes?: Array, paiement?: Object }>}
 */
export async function analyzeFinancialDocument(file, providedApiKey = null) {
    if (!file) throw new Error("Aucun fichier fourni pour l'analyse.");

    const configStr = localStorage.getItem('expertise_aiConfig_v3');
    const config = sanitizeAiConfig(configStr ? JSON.parse(configStr) : {});

    const apiKey = providedApiKey || config.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) throw new Error("Clé API non configurée.");

    const contentArray = await prepareFileContent(file);

    const payload = buildAiPayload(
        config,
        'decompte_extraction',
        [
            { role: "system", content: FINANCIAL_DOC_SYSTEM_PROMPT },
            { role: "user", content: contentArray }
        ],
        { forceJsonResponse: true }
    );

    const data = await executeAiCall({
        apiKey,
        payload,
        componentId: 'decompte_extraction'
    });

    const contentString = data.choices[0].message.content;
    
    let parsed;
    try {
        parsed = typeof contentString === 'string' ? JSON.parse(contentString) : contentString;
    } catch (e) {
        throw new Error("Réponse IA illisible : JSON invalide.");
    }

    // Validation de la structure
    if (!parsed || !parsed.type) {
        throw new Error("Structure IA inattendue : la clé 'type' est manquante.");
    }

    if (parsed.type === 'DECOMPTE') {
        if (!Array.isArray(parsed.postes)) {
            throw new Error("Structure IA inattendue : la clé 'postes' est manquante ou n'est pas un tableau.");
        }
        return { type: 'DECOMPTE', postes: parsed.postes };
    }

    if (parsed.type === 'LETTRE_PAIEMENT') {
        if (!parsed.paiement || typeof parsed.paiement.montant !== 'number') {
            throw new Error("Structure IA inattendue : données de paiement invalides.");
        }
        return { type: 'LETTRE_PAIEMENT', paiement: parsed.paiement };
    }

    // Fallback : si le type n'est pas reconnu, on tente le mode décompte
    if (Array.isArray(parsed.postes)) {
        return { type: 'DECOMPTE', postes: parsed.postes };
    }

    throw new Error(`Type de document non reconnu : ${parsed.type}`);
}

/**
 * Extrait les postes financiers d'une lettre de décompte PDF (rétrocompatibilité).
 * @param {File} file 
 * @param {string} [providedApiKey=null] 
 * @returns {Promise<Array<{libelle:string, montant:number}>>}
 */
export async function extractDecomptePostes(file, providedApiKey = null) {
    if (!file) throw new Error("Aucun fichier fourni pour l'extraction.");

    const configStr = localStorage.getItem('expertise_aiConfig_v3');
    const config = sanitizeAiConfig(configStr ? JSON.parse(configStr) : {});

    const apiKey = providedApiKey || config.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) throw new Error("Clé API non configurée.");

    const contentArray = await prepareFileContent(file);

    const payload = buildAiPayload(
        config,
        'decompte_extraction',
        [
            { role: "system", content: DECOMPTE_SYSTEM_PROMPT },
            { role: "user", content: contentArray }
        ],
        { forceJsonResponse: true }
    );

    const data = await executeAiCall({
        apiKey,
        payload,
        componentId: 'decompte_extraction'
    });

    const contentString = data.choices[0].message.content;
    
    let parsed;
    try {
        parsed = typeof contentString === 'string' ? JSON.parse(contentString) : contentString;
    } catch (e) {
        throw new Error("Réponse IA illisible : JSON invalide.");
    }

    if (!parsed || !Array.isArray(parsed.postes)) {
        throw new Error("Structure IA inattendue : la clé 'postes' est manquante ou n'est pas un tableau.");
    }

    return parsed.postes;
}

/**
 * Convertit les postes extraits par l'IA en expenses compatibles avec le splitter.
 * @param {Array<{libelle:string, montant:number}>} postes 
 * @returns {Array<Object>}
 */
export function mapPostesToExpenses(postes) {
    return postes.map(p => {
        // Formate le montant en string avec virgule, ex: "450,00"
        const montantStr = Number(p.montant || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return {
            id: p.id || crypto.randomUUID(),
            desc: p.libelle || "Poste inconnu",
            montantReclame: montantStr,
            montantValide: montantStr, // Initialement, le montant validé est identique
            typeMontant: 'HTVA', // Par défaut
            source: 'ia_decompte'
        };
    });
}
