// v5.9.2 - Modularisation aiManager
/**
 * financial.js — Agent Financier
 * Étape 5 du pipeline : extraction des données financières (devis, factures).
 * Ne reçoit que les documents taggués "FINANCIER".
 * Parallélisation massive : 1 micro-agent par fichier.
 */

import { fileToBase64, pdfExtractHybrid } from '../utils/pdfUtils.js';
import { parseMsgFile } from '../utils/msgUtils.js';

// v5.5.4
/**
 * Étape 5 : L'Agent Financier
 * Extrait les données financières (devis, factures) et les rattache aux occupants.
 * Ne reçoit que les documents taggués "FINANCIER".
 */
export const extractFinancialData = async (files, providedApiKey = null, onStatusChange = null, model = 'gpt-4o', occupantsList = []) => {
    const fileArray = Array.isArray(files) ? files : [files];
    const apiKey = providedApiKey || import.meta.env.VITE_OPENAI_API_KEY;
    const mode = apiKey ? 'live' : 'mock';

    // v5.9.0 - Construire le contexte occupants pour le rattachement des factures
    const occupantsContext = occupantsList.length > 0
        ? `\nLISTE DES OCCUPANTS CONNUS (avec leurs UUID) :\n${occupantsList.map(o => `Nom/Prénom: ${o.nom || ''} ${o.prenom || ''} | Étage: ${o.etage || '?'} | ID: ${o.id}`).join('\n')}\n\nPour le champ "compteDe", si la facture est adressée à l'un de ces occupants, utilise son ID exact. Sinon, écris "unassigned".`
        : '';

    if (mode === 'mock') {
        if (onStatusChange) onStatusChange('extracting');
        await new Promise(resolve => setTimeout(resolve, 1500));
        return {
            success: true,
            data: {
                expenses: [{
                    id: crypto.randomUUID(),
                    prestataire: "Plombier Mock", type: "Devis", ref: "DEV-MOCK-001", desc: "Recherche de fuite",
                    compteDe: "unassigned", destinataireFacture: "Locataire Mock", montantReclame: "450.00", montantValide: "450.00",
                    typeMontant: "HTVA", categorieGarantie: "Principale", tauxTVA: 21,
                    factureRecue: false, pourcentageVetuste: 0, motifRefus: "", avisCouverture: "Oui", noteCouverture: "",
                    montantDevis: "450.00", refDevis: "DEV-MOCK-001", prestataireDevis: "Plombier Mock", descDevis: "Recherche de fuite",
                    montantFacture: "", refFacture: "", prestataireFacture: "", descFacture: "",
                    sourceFileName: fileArray[0]?.name || "document.pdf"
                }]
            }
        };
    }

    try {
        if (onStatusChange) onStatusChange('extracting');

        // v5.7.0 - Parallélisation massive : 1 micro-agent par fichier
        const promises = fileArray.map(async (item) => {
            const fileName = item.name || 'document_sans_nom';
            const contentArray = [{ type: "text", text: "Voici le document financier à analyser." }];
            contentArray.push({ type: "text", text: `\n\n[DÉBUT DOCUMENT : ${fileName}]\n` });
            
            if (typeof item === 'string') {
                 contentArray.push({ type: "text", text: item });
            } else {
                const fileNameLower = fileName.toLowerCase();
                if (fileNameLower.endsWith('.msg')) {
                    try {
                        const { bodyText } = await parseMsgFile(item);
                        contentArray.push({ type: "text", text: bodyText });
                    } catch (e) {
                        contentArray.push({ type: "text", text: "[Fichier MSG illisible]" });
                    }
                } else if (item.type === 'application/pdf') {
                    // v5.9.1 - Optimisation Hybride PDF : texte si facture numérique, vision si scan
                    const hybrid = await pdfExtractHybrid(item);
                    if (hybrid.mode === 'text') {
                        contentArray.push({ type: "text", text: hybrid.text });
                    } else {
                        for (const img of (hybrid.images || [])) {
                            contentArray.push({ type: "image_url", image_url: { url: img } });
                        }
                    }
                } else if (item.type && item.type.startsWith('image/')) {
                    const base64Image = await fileToBase64(item);
                    contentArray.push({ type: "image_url", image_url: { url: base64Image } });
                } else {
                    contentArray.push({ type: "text", text: "[Format non supporté pour la vision]" });
                }
            }
            contentArray.push({ type: "text", text: `\n[FIN DOCUMENT : ${fileName}]\n` });

            const systemPrompt = `Tu es un Agent Financier expert en comptabilité et expertise sinistres.
Ton rôle est d'analyser des documents financiers (devis, factures, tickets) et d'extraire les réclamations financières.

RÈGLES ABSOLUES :
1. RÈGLE DU HTVA STRICT : TOUS les montants extraits (montantReclame, montantDevis, montantFacture, montantValide) DOIVENT IMPÉRATIVEMENT être Hors TVA (HTVA). Si le texte fournit un montant TVAC, extrais le HTVA ou déduis-le mathématiquement avec le taux de TVA indiqué. Formate les montants sous forme de texte avec un point (ex: "450.00").
2. "typeMontant" DOIT TOUJOURS être "HTVA".
3. RÈGLE DES DEVIS ET FACTURES : Si le document est un DEVIS, remplis "montantDevis", "refDevis", "prestataireDevis" et "descDevis". Si c'est une FACTURE, remplis "montantFacture", "refFacture", "prestataireFacture" et "descFacture". Copie la valeur la plus pertinente dans "montantReclame" et "montantValide". "type" doit valoir "Devis" ou "Facture".
4. SOURCE FILE NAME : Remplis "sourceFileName" avec le nom EXACT du fichier suivant : [${fileName}]. Il est interdit d'inventer un nom.
5. DESTINATAIRE & RATTACHEMENT : Extrait le NOM et PRÉNOM EXACT de la personne à qui la facture est adressée dans "destinataireFacture".${occupantsContext}
6. Tu dois renvoyer STRICTEMENT un JSON valide, sans introduction, ni markdown.

Format EXACT attendu :
{
  "expenses": [
    {
      "prestataire": "", "type": "Devis ou Facture", "ref": "", "desc": "", "compteDe": "ID_OCCUPANT ou unassigned", 
      "destinataireFacture": "Nom du destinataire", "montantReclame": "", "montantValide": "", 
      "typeMontant": "HTVA", "categorieGarantie": "Principale ou Complémentaire", "tauxTVA": 0, 
      "factureRecue": false, "pourcentageVetuste": 0, "motifRefus": "", "avisCouverture": "Oui", "noteCouverture": "",
      "montantDevis": "", "refDevis": "", "prestataireDevis": "", "descDevis": "",
      "montantFacture": "", "refFacture": "", "prestataireFacture": "", "descFacture": "",
      "sourceFileName": "${fileName}"
    }
  ]
}`;

            const payload = {
                model: model, // gpt-4o recommandé pour les calculs mathématiques HTVA
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: contentArray }
                ],
                response_format: { type: "json_object" },
                temperature: 0.1
            };

            try {
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
                    console.error(`[Agent Financier] Erreur API pour le fichier ${fileName}:`, errorData);
                    return { expenses: [] }; // On ne casse pas Promise.all pour un fichier échoué
                }

                const data = await response.json();
                return JSON.parse(data.choices[0].message.content);
            } catch (err) {
                console.error(`[Agent Financier] Erreur d'analyse pour le fichier ${fileName}:`, err);
                return { expenses: [] };
            }
        });

        // Attente de la résolution de tous les micro-agents
        const results = await Promise.all(promises);

        // Fusion des résultats
        let allExpenses = [];
        for (const res of results) {
            if (res && res.expenses && Array.isArray(res.expenses)) {
                res.expenses.forEach(exp => {
                    allExpenses.push({
                        ...exp,
                        id: crypto.randomUUID(),
                        compteDe: exp.compteDe || "unassigned",
                        destinataireFacture: exp.destinataireFacture || ""
                    });
                });
            }
        }

        return { success: true, data: { expenses: allExpenses } };

    } catch (error) {
        console.error("[financial] extractFinancialData error :", error);
        return { success: false, error: error.message || "Erreur lors de l'extraction financière." };
    }
};
