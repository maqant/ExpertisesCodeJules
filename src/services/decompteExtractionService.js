import { buildAiPayload } from '../ai/ai.resolver.js';
import { sanitizeAiConfig } from '../ai/ai.config.js';
import { executeAiCall } from '../ai/apiClient.js';
import { isPdfDeep } from './utils/fileUtils.js';
import { pdfToBase64Images, fileToBase64 } from './utils/pdfUtils.js';
import { checkFinancialIntegrity } from './financialIntegrityChecker.js';
import { processIngestedFile } from './utils/filePreprocessor.js';

const EXTRACTION_PROMPT = `Tu es un expert comptable en assurance. Tu vas recevoir un document financier (décompte, lettre de versement, décompte de sinistre, etc.).

Ta tâche est d'extraire TOUTES les informations financières avec une FIDÉLITÉ MATHEMATIQUE ABSOLUE.

Retourne UNIQUEMENT un objet JSON avec cette structure :
{
  "postes": [
    { "libelle": "Description exacte du poste", "montant": 760.00 }
  ],
  "beneficiaire": {
    "nom": "Nom complet du bénéficiaire/assuré si visible",
    "iban": "IBAN si visible (sinon null)"
  },
  "totalDocument": 65223.12,
  "reference": "Numéro de référence sinistre ou dossier si visible (sinon null)",
  "date": "Date du document au format YYYY-MM-DD si visible (sinon null)"
}

Règles d'extraction des POSTES et des SIGNES :
- Extrais CHAQUE ligne de frais individuelle du tableau ou du détail (pas le total général).
- RÈGLE CAPITALES SUR LES SIGNES : Conserve IMPÉRATIVEMENT les montants NÉGATIFS s'il s'agit d'une déduction, d'un acompte antérieur versé, d'une franchise, d'une réserve, d'une vêtusté ou d'un ajustement négatif.
  * Exemple 1 : Si la ligne indique "Autres -230.000,00", le montant JSON doit être -230000.00 (NÉGATIF !).
  * Exemple 2 : Si la ligne indique "Franchise contractuelle -321,35", le montant JSON doit être -321.35 (NÉGATIF !).
- "totalDocument" est le montant total net versé ou à payer indiqué sur la lettre (ex: 65223.12).

Règles pour le BÉNÉFICIAIRE :
- C'est la personne physique ou morale à qui le versement est destiné (ex: "RESIDENCE CROISETTE").
- Si non trouvé, mets null pour les deux champs.

IMPORTANT : Ne retourne RIEN d'autre que le JSON. Pas d'explication, pas de commentaire.`;

async function prepareFileContent(rawFile) {
    const file = await processIngestedFile(rawFile);
    const contentArray = [{ type: "text", text: "Voici le document financier à analyser." }];

    if (await isPdfDeep(file)) {
        const base64Images = await pdfToBase64Images(file);
        for (const img of base64Images) {
            contentArray.push({
                type: "image_url",
                image_url: { url: img }
            });
        }
    } else if (file.type && file.type.startsWith('image/')) {
        const base64Image = await fileToBase64(file);
        contentArray.push({
            type: "image_url",
            image_url: { url: base64Image }
        });
    } else {
        throw new Error("Format de fichier non supporté. Veuillez utiliser un PDF, une image, un fichier EDI, TXT, DOCX ou MSG.");
    }

    return contentArray;
}

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

    // Réconciliation & Vérification d'intégrité comptable immédiate
    const rawPostes = parsed.postes.map(p => ({
        id: crypto.randomUUID(),
        libelle: p.libelle || "Poste inconnu",
        montant: p.montant
    }));

    const integrity = checkFinancialIntegrity({
        postes: rawPostes,
        totalDocument: parsed.totalDocument ?? null
    });

    return {
        postes: integrity.postes,
        beneficiaire: parsed.beneficiaire || null,
        totalDocument: parsed.totalDocument ?? null,
        reference: parsed.reference || null,
        date: parsed.date || null,
        integrity: integrity
    };
}

export function mapPostesToExpenses(postes) {
    return postes.map(p => {
        const montantStr = p.montantStr || (typeof p.montant === 'number' 
            ? p.montant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "0,00");
        return {
            id: p.id || crypto.randomUUID(),
            desc: p.libelle || "Poste inconnu",
            montantReclame: montantStr,
            montantValide: montantStr,
            typeMontant: 'HTVA',
            source: 'ia_decompte',
            wasAutoCorrected: !!p.wasAutoCorrected
        };
    });
}
