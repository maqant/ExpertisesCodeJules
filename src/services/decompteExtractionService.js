import { buildAiPayload } from '../ai/ai.resolver.js';
import { sanitizeAiConfig } from '../ai/ai.config.js';
import { executeAiCall } from '../ai/apiClient.js';
import { isPdfDeep } from './utils/fileUtils.js';
import { pdfToBase64Images, fileToBase64 } from './utils/pdfUtils.js';

const DECOMPTE_SYSTEM_PROMPT = `Tu es un expert en assurance. Extrais tous les postes d'indemnisation de ce document. Retourne UNIQUEMENT un objet JSON avec une clé "postes" contenant un tableau d'objets. Chaque objet doit avoir :
- "libelle" (string) : le nom exact du poste (ex: Frais de syndic, Bâtiment (Dommages))
- "montant" (number) : le montant positif en euros (sans le symbole).

Ignore les totaux généraux, je ne veux que les lignes individuelles. Le format doit être strictement un JSON valide, sans markdown, sans autre texte.`;

/**
 * Extrait les postes financiers d'une lettre de décompte PDF.
 * @param {File} file 
 * @param {string} [providedApiKey=null] 
 * @returns {Promise<Array<{libelle:string, montant:number}>>}
 */
export async function extractDecomptePostes(file, providedApiKey = null) {
    if (!file) throw new Error("Aucun fichier fourni pour l'extraction.");

    const apiKey = providedApiKey || import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) throw new Error("Clé API non configurée.");

    const configStr = localStorage.getItem('expertise_aiConfig_v3');
    const config = sanitizeAiConfig(configStr ? JSON.parse(configStr) : {});

    const contentArray = [{ type: "text", text: "Voici le décompte de la compagnie à analyser." }];

    // Préparation de l'image / PDF
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
            id: crypto.randomUUID(),
            desc: p.libelle || "Poste inconnu",
            montantReclame: montantStr,
            montantValide: montantStr, // Initialement, le montant validé est identique
            typeMontant: 'HTVA', // Par défaut
            source: 'ia_decompte'
        };
    });
}
