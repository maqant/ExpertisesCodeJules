import { buildAiPayload } from '../ai/ai.resolver.js';
import { sanitizeAiConfig } from '../ai/ai.config.js';
import { executeAiCall } from '../ai/apiClient.js';
import { isPdfDeep } from './utils/fileUtils.js';
import { pdfToBase64Images, fileToBase64 } from './utils/pdfUtils.js';

const EXTRACTION_PROMPT = `Tu es un expert en assurance. Tu vas recevoir un document financier (décompte, lettre de paiement, relevé, etc.).

Ta tâche est d'extraire TOUTES les informations financières utiles.

Retourne UNIQUEMENT un objet JSON avec cette structure :
{
  "postes": [
    { "id": "uuid-unique", "libelle": "Nom du poste ou description", "montant": 760.00 }
  ],
  "beneficiaire": {
    "nom": "Nom complet du bénéficiaire/assuré si visible",
    "iban": "IBAN si visible (sinon null)"
  },
  "reference": "Numéro de référence sinistre ou dossier si visible (sinon null)",
  "date": "Date du document au format YYYY-MM-DD si visible (sinon null)"
}

Règles d'extraction des POSTES :
- Extrais CHAQUE ligne de frais individuelle du document (pas le total général).
- Si le document ne contient qu'un seul montant global (ex: "Nous vous versons 3.094,39€"), crée UN SEUL poste avec ce montant et un libellé descriptif.
- Le montant doit toujours être un NOMBRE POSITIF.
- Exemples de postes : "Frais de syndic 760,00", "Bâtiment (Dommages au 1er étage M. Willems) 4.800,00"

Règles pour le BÉNÉFICIAIRE :
- C'est la personne physique ou morale à qui le paiement est destiné.
- Si tu ne trouves pas de bénéficiaire clair, mets null pour les deux champs.

IMPORTANT : Ne retourne RIEN d'autre que le JSON. Pas d'explication, pas de commentaire.`;

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
 * Extrait les postes financiers ET les métadonnées d'un document.
 * Prompt unique : pas de classification, juste extraction maximale.
 * 
 * @param {File} file 
 * @param {string} [providedApiKey=null]
 * @returns {Promise<{ postes: Array<{id:string, libelle:string, montant:number}>, beneficiaire?: {nom:string|null, iban:string|null}, reference?: string|null, date?: string|null }>}
 */
export async function extractFinancialData(file, providedApiKey = null) {
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
            { role: "system", content: EXTRACTION_PROMPT },
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

    return {
        postes: parsed.postes,
        beneficiaire: parsed.beneficiaire || null,
        reference: parsed.reference || null,
        date: parsed.date || null
    };
}

/**
 * Convertit les postes extraits par l'IA en expenses compatibles avec le splitter.
 * @param {Array<{libelle:string, montant:number}>} postes 
 * @returns {Array<Object>}
 */
export function mapPostesToExpenses(postes) {
    return postes.map(p => {
        const montantStr = Number(p.montant || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return {
            id: p.id || crypto.randomUUID(),
            desc: p.libelle || "Poste inconnu",
            montantReclame: montantStr,
            montantValide: montantStr,
            typeMontant: 'HTVA',
            source: 'ia_decompte'
        };
    });
}
