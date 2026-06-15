// v6.1.0 - Pipeline Hardening
/**
 * aiManager.js — Orchestrateur & Barrel File
 * 
 * Point d'entrée unique pour toutes les opérations IA.
 * Importe et re-exporte les agents spécialisés depuis ./agents/ et les utilitaires depuis ./utils/.
 * 
 * Contient uniquement :
 *   - processGlobalIngestion (Chef d'Orchestre)
 *   - extractDataFromDocument (fonction legacy monolithique)
 *   - refineText, refineCauseWithInput, reformatCompteRendu (agents d'affinage)
 * 
 * Tous les consommateurs existants (Sidebar, GlobalValidationModal, GlobalAiAssistant, TerrainView)
 * continuent d'importer depuis ce fichier — zéro changement d'import nécessaire.
 */

// ═══════════════════════════════════════════════════════════════
// RE-EXPORTS — Les consommateurs importent tout depuis ici
// ═══════════════════════════════════════════════════════════════

// Utils
export { fileToBase64, pdfToBase64Images, pdfExtractHybrid } from './utils/pdfUtils.js';
export { extractValidAttachmentsFromMsg, parseMsgFile } from './utils/msgUtils.js';
export { normalizeDate, processInParallelBatches, buildContentArrayParallel, resolveFranchiseLegale, withRetry } from './utils/aiHelpers.js';

// Agents spécialisés
export { routeDocuments } from './agents/router.js';
export { extractAdministrativeData } from './agents/admin.js';
export { extractSocialData } from './agents/social.js';
export { extractNarrativeData } from './agents/narrative.js';
export { extractFinancialData } from './agents/financial.js';

// ═══════════════════════════════════════════════════════════════
// IMPORTS INTERNES pour l'orchestrateur et les fonctions locales
// ═══════════════════════════════════════════════════════════════

import { fileToBase64, pdfToBase64Images } from './utils/pdfUtils.js';
import { extractValidAttachmentsFromMsg, parseMsgFile } from './utils/msgUtils.js';
import { routeDocuments } from './agents/router.js';
import { extractAdministrativeData } from './agents/admin.js';
import { extractSocialData } from './agents/social.js';
import { extractNarrativeData } from './agents/narrative.js';
import { extractFinancialData } from './agents/financial.js';
import { withRetry } from './utils/aiHelpers.js'; // v5.9.3 - Smart Retry & Résilience

// ═══════════════════════════════════════════════════════════════
// AGENT BALAI (Phase 2)
// ═══════════════════════════════════════════════════════════════
const runFallbackAgent = async (documentText, missingKeysList, apiKey, fallbackModel = 'gpt-5.5') => {
    const prompt = `Tu es un Super-Réviseur Premium (Agent Balai). Un premier passage d'extraction a échoué à trouver certaines informations cruciales dans le document ci-dessous.

TA MISSION : 
Recherche ces informations spécifiques : ${missingKeysList.join(', ')}.

RÈGLES ANTI-HALLUCINATION ABSOLUES :
1. Utilise le champ "_raisonnement" en premier dans ton JSON pour réfléchir étape par étape. Pour chaque information demandée, cherche une PREUVE exacte dans le texte.
2. Si tu trouves l'information, extrais-la fidèlement.
3. Si l'information est absente, déduite, ou incertaine, tu DOIS OBLIGATOIREMENT renvoyer la chaîne "INTROUVABLE". C'est une réponse parfaitement valide et attendue ! N'invente JAMAIS rien.
4. Renvoie UNIQUEMENT un objet JSON valide. 
5. Les clés du JSON (en dehors de "_raisonnement") doivent être exactement les noms des informations listées ci-dessus.

Document :
${documentText.substring(0, 30000)} // Sécurité pour ne pas exploser le contexte
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey || process.env.VITE_OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: fallbackModel,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.0,
            response_format: { type: "json_object" }
        })
    });

    if (!response.ok) throw new Error("Erreur API Agent Balai");
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
};

// ═══════════════════════════════════════════════════════════════
// FONCTIONS LOCALES — Legacy extractor, refine, orchestrateur
// ═══════════════════════════════════════════════════════════════

/**
 * Fonction principale d'extraction de données (LEGACY).
 * Utilisée par les dropzones ciblées (ex: drop une facture directement sur le tableau des frais).
 * @param {File} file Le document (ex: Facture, Devis) sous forme d'objet File
 * @param {string} documentType Le type de document ("facture", "devis", "contrat")
 * @returns {Promise<Object>} Un objet JSON formaté pour financeStore.js
 */
export const extractDataFromDocument = async (files, documentType = 'facture', provider = 'openai', model = 'gpt-5.4', providedApiKey = null, onStatusChange = null) => {
    // Ensure files is an array
    const fileArray = Array.isArray(files) ? files : [files];

    // Determine the actual mode: Force "live" if an API key is available, otherwise fallback to "mock"
    const apiKey = providedApiKey || import.meta.env.VITE_OPENAI_API_KEY;
    const mode = apiKey ? 'live' : 'mock';

    if (mode === 'mock') {
        if (onStatusChange) onStatusChange('extracting');
        console.log(`[AI Mock] Aucune clé API trouvée. Extraction simulée pour un document de type: ${documentType}...`);

        // Simulation d'étapes (2s au total)
        await new Promise(resolve => setTimeout(resolve, 500));
        if (onStatusChange) onStatusChange('sending');
        await new Promise(resolve => setTimeout(resolve, 500));
        if (onStatusChange) onStatusChange('thinking');
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (onStatusChange) onStatusChange('attaching');

        console.log(`[AI Mock] Extraction terminée avec succès.`);

        if (documentType === 'annexe') {
            return {
                success: true,
                data: { title: "Justificatif de remplacement de la chaudière" }
            };
        } else if (documentType === 'cause') {
            return {
                success: true,
                data: {
                    cause: "Le sinistre trouve son origine dans la rupture d'un joint d'étanchéité au niveau du raccordement du lave-vaisselle dans la cuisine. Cette rupture, consécutive à l'usure normale, a entraîné un écoulement d'eau lent et continu sous les meubles encastrés, endommageant la chape et les revêtements de sol."
                }
            };
        } else if (documentType === 'dossier_global') {
            return {
                success: true,
                data: {
                    formData: { dateSinistre: "2026-05-15", dateDeclaration: "2026-05-16", declarant: "Syndic ABC", nomCie: "AXA Belgium", nomContrat: "Top Habitation", numPolice: "POL-MOCK-001", numSinistreCie: "SIN-2026-9999", adresse: "Rue de la Loi 42, 1000 Bruxelles", cause: "" },
                    experts: [{ nom: "GABER Lionel", tel: "04XX XX XX" }],
                    occupants: [
                        { etage: "3ème", statut: "Locataire", nom: "Dupont Jean", tel: "0471 00 00 00", email: "jean.dupont@test.be", rc: "Non", rcPolice: "", secAssurance: "Non", secType: "", secPolice: "", secCie: "" },
                        { etage: "2ème", statut: "Propriétaire occupant", nom: "Martin Sophie", tel: "0472 00 00 00", email: "", rc: "Non", rcPolice: "", secAssurance: "Non", secType: "", secPolice: "", secCie: "" }
                    ],
                    expenses: [
                        { prestataire: "Plomberie Dubois", type: "Devis", ref: "DEV-001", desc: "Recherche de fuite et réparation", compteDe: "unassigned", montant: "450,00", typeMontant: "HTVA", sourceFileName: "" },
                        { prestataire: "Peintures Martin", type: "Devis", ref: "DEV-002", desc: "Remise en peinture plafond et murs", compteDe: "unassigned", montant: "1250,00", typeMontant: "HTVA", sourceFileName: "" }
                    ]
                },
                extractedFiles: [] // En mode mock, pas de vrais fichiers extraits
            };
        }

        // Faux JSON formaté parfaitement pour la base de données
        if (documentType === 'contrat') {
            return {
                success: true,
                data: {
                    nomCie: "Assurances ABC",
                    nomContrat: "Top Habitation Idéal",
                    numPolice: "POL-123456789",
                    numConditionsGenerales: "CG-2023-V2",
                    franchise: "250",
                    nomResidence: "Résidence Les Fleurs",
                    pertesIndirectes: "10%"
                }
            };
        } else {
            return {
                success: true,
                data: {
                    expenses: [
                        {
                            id: crypto.randomUUID(),
                            prestataire: "Plomberie Dubois & Fils",
                            type: documentType === 'facture' ? 'Facture' : 'Devis',
                            ref: "FAC-2026-042",
                            desc: "Recherche de fuite et réparation provisoire",
                            compteDe: "unassigned",
                            montantReclame: "450.50",
                            typeMontant: "HTVA"
                        }
                    ]
                }
            };
        }
    }

    if (mode === 'live') {
        try {
            if (onStatusChange) onStatusChange('extracting');
            console.log(`[AI Live] Envoi de la requête à l'API OpenAI pour un document de type: ${documentType}...`);

            // Multi-files logic for vision — supports strings, .msg, PDF, images
            const contentArray = [{ type: "text", text: "Voici le(s) document(s) à analyser." }];
            const allExtractedFiles = []; // Files extracted from MSG for Magic Drop auto-attach
            const validFileNames = []; // On liste les fichiers autorisés

            for (const item of fileArray) {
                // Plain text string (pasted notes, raw text)
                if (typeof item === 'string') {
                    if (item.trim()) {
                        contentArray.push({ type: "text", text: item });
                    }
                    continue;
                }

                // File object
                const file = item;
                const fileName = file.name || 'document_sans_nom';
                validFileNames.push(fileName);
                const fileNameLower = fileName.toLowerCase();

                contentArray.push({ type: "text", text: `\n\n==================================================\n[DÉBUT DE LA PIÈCE JOINTE : ${fileName}]\n` });

                if (fileNameLower.endsWith('.msg')) {
                    // Outlook .msg — parse body + extract attachments
                    try {
                        const { bodyText, attachments } = await parseMsgFile(file);
                        if (bodyText.trim()) {
                            contentArray.push({ type: "text", text: `[Email Outlook: ${file.name}]\n${bodyText}` });
                        }
                        // Process extracted attachments (PDFs & images go to vision)
                        for (const att of attachments) {
                            allExtractedFiles.push(att);
                            const attName = att.name || 'piece_jointe_sans_nom';
                            validFileNames.push(attName);
                            
                            contentArray.push({ type: "text", text: `\n\n==================================================\n[DÉBUT DE LA PIÈCE JOINTE : ${attName}]\n` });

                            if (att.type === 'application/pdf') {
                                const base64Images = await pdfToBase64Images(att);
                                for (const img of base64Images) {
                                    contentArray.push({ type: "image_url", image_url: { url: img } });
                                }
                            } else if (att.type.startsWith('image/')) {
                                const base64Image = await fileToBase64(att);
                                contentArray.push({ type: "image_url", image_url: { url: base64Image } });
                            }
                            // Other attachment types (doc, xls) — just mention their name
                            else {
                                contentArray.push({ type: "text", text: `[Pièce jointe non analysable visuellement: ${attName}]` });
                            }
                            
                            contentArray.push({ type: "text", text: `\n[FIN DE LA PIÈCE JOINTE : ${attName}]\n==================================================\n\n` });
                        }
                    } catch (e) {
                        console.warn(`[aiManager] Impossible de lire le fichier MSG ${file.name}:`, e);
                        contentArray.push({ type: "text", text: `[Fichier MSG illisible: ${file.name}]` });
                    }
                } else if (file.type === 'application/pdf') {
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
                     return {
                        success: false,
                        error: `Format de fichier non supporté: ${file.name}. Utilisez un PDF, une image ou un .msg.`
                    };
                }

                contentArray.push({ type: "text", text: `\n[FIN DE LA PIÈCE JOINTE : ${fileName}]\n==================================================\n\n` });
            }

            // System prompt par type de document
            const getSystemPrompt = () => {
                if (documentType === 'annexe') {
                    return `Tu es un assistant administratif. Lis ce document et donne-lui un titre clair, professionnel et très concis (maximum 1 ou 2 lignes). Ce titre servira de légende dans un rapport d'expertise. Ne réponds QUE par le texte du titre, sans guillemets, sans introduction ni formules de politesse.`;
                }
                if (documentType === 'cause') {
                    return `Tu es un expert en assurance spécialisé dans le bâtiment. Ton rôle est de lire ces documents techniques (rapports de recherche de fuite, rapports de pompiers, etc.) et d'en extraire UNIQUEMENT les faits techniques.

Ignore totalement les lettres de couverture, les formules de politesse, les noms des gestionnaires ou l'historique des rendez-vous.

Consignes de formatage :
- Si UN SEUL rapport est fourni, rédige un paragraphe concis répondant aux 4 points ci-dessous.
- Si PLUSIEURS rapports ou avis différents sont fournis (ex: deux rapports d'entreprises différentes), sépare obligatoirement ton analyse. Utilise des sauts de ligne et introduis chaque partie par le nom de l'intervenant (ex: "Rapport 1 (Nom de l'entreprise) :" puis "Rapport 2 (Nom de l'entreprise) :").

Dans tous les cas, pour chaque document analysé, tu dois extraire et répondre uniquement à ceci :
1. Quelle est l'origine exacte et technique du sinistre (la cause matérielle) ?
2. Où est-elle localisée avec précision ?
3. Quelles sont les conséquences matérielles directes constatées (ex: matériaux saturés) ?
4. Quelles sont les réparations conservatoires ou définitives préconisées par le technicien ?

Ne fais aucune introduction générale, va droit au but.`;
                }
                if (documentType === 'dossier_global') {
                    return `Tu es un assistant expert en extraction de données pour l'encodage de dossiers d'expertise incendie. Ton objectif est d'analyser des données brutes (notes, emails, documents) et d'en extraire TOUTES les entités pertinentes selon un schéma JSON strict.

MÉTHODE DE TRAVAIL OBLIGATOIRE :
1. LECTURE GLOBALE : Analyse silencieusement tout le document. Identifie chaque acteur et chaque réclamation financière.
2. RÈGLE DU HTVA STRICT : Tous les montants insérés DOIVENT IMPÉRATIVEMENT être Hors TVA (HTVA). Si le texte fournit un montant TVAC, extrais le HTVA ou déduis-le mathématiquement.
3. FORMATAGE DES NOMBRES : Les montants doivent être au format texte avec une virgule (ex: "350,00"). Jamais de point. Jamais de sigle €.
4. CONTRAINTES DE VALEURS :
   - "statut" (occupants) DOIT être : "Locataire", "Propriétaire occupant", "Propriétaire non occupant", ou "Syndic / Autre".
   - "typeMontant" (dépenses) DOIT TOUJOURS être "HTVA".
5. AUTO-ATTACHEMENT (Magic Drop) : Pour chaque dépense (expense) identifiée provenant d'une pièce jointe ou d'un document fourni, ajoute obligatoirement la clé "sourceFileName" contenant le nom exact du fichier. Sinon, laisse vide.

FORMAT JSON ATTENDU :
{
  "formData": { "dateSinistre": "", "dateDeclaration": "", "declarant": "", "nomCie": "", "nomContrat": "", "numPolice": "", "numSinistreCie": "", "adresse": "", "cause": "" },
  "experts": [ { "nom": "", "tel": "" } ],
  "occupants": [ { "etage": "", "statut": "Locataire", "nom": "", "tel": "", "email": "", "rc": "Non", "rcPolice": "", "secAssurance": "Non", "secType": "", "secPolice": "", "secCie": "" } ],
  "expenses": [ { "prestataire": "", "type": "Facture", "ref": "", "desc": "", "compteDe": "Nom exact de la personne facturée (ou laisse vide si inconnu)", "montant": "", "typeMontant": "HTVA", "sourceFileName": "" } ]
}`;
                }
                // Default: facture/devis/contrat
                return `Tu es un assistant expert en extraction de données pour l'expertise incendie.
Extrais les informations de ce document (${documentType}) et renvoie STRICTEMENT un JSON valide respectant ce format :
${documentType === 'contrat' ? `{
  "nomCie": "Nom de la compagnie d'assurance",
  "nomContrat": "Nom du produit d'assurance (ex: Top Habitation)",
  "numPolice": "Numéro de police ou numéro du contrat",
  "numConditionsGenerales": "Numéro ou référence exacte des Conditions Générales appliquées au contrat",
  "franchise": "Montant ou règle de la franchise",
  "nomResidence": "Nom du preneur ou de la résidence",
  "pertesIndirectes": "Pourcentage des pertes indirectes (Doit être STRICTEMENT '0%', '5%', '10%', ou '' si non trouvé)"
}` : `{
  "expenses": [
    {
      "prestataire": "Nom de l'entreprise",
      "type": "Facture ou Devis",
      "ref": "Numéro de référence",
      "desc": "Description courte des travaux",
      "montantReclame": "Montant sous format texte avec point (ex: 450.50)",
      "typeMontant": "HTVA, TVA ou FORFAIT"
    }
  ]
}`}
Ne renvoie aucun autre texte, juste le JSON.`;
            };

            const antiHallucinationPrompt = `\n\n⚠️ RÈGLE ABSOLUE POUR LA SOURCE (sourceFileName) ⚠️ :
Tu as accès UNIQUEMENT à ces pièces jointes : [${validFileNames.join(', ')}].
Pour le champ \`sourceFileName\` dans ton JSON, tu DOIS OBLIGATOIREMENT choisir une valeur exacte dans cette liste stricte.
Il t'est STRICTEMENT INTERDIT d'inventer un nom de fichier, de croiser les sources, ou d'utiliser un fichier qui n'est pas dans cette liste (comme un ancien .doc ignoré).
Si l'information que tu extrais provient du texte encadré par [DÉBUT DE LA PIÈCE JOINTE : X], alors \`sourceFileName\` doit être EXACTEMENT "X".
Si l'information se trouve dans l'email principal et pas dans une pièce jointe, laisse \`sourceFileName\` totalement vide ("").`;

            // Payload générique pour un modèle multimodal (ex: gpt-5.4)
            const payload = {
                model: model,
                messages: [
                    { role: "system", content: getSystemPrompt() + antiHallucinationPrompt },
                    { role: "user", content: contentArray }
                ],
                response_format: (documentType === 'cause' || documentType === 'annexe') ? { type: "text" } : { type: "json_object" },
                max_tokens: documentType === 'dossier_global' ? 4096 : 500,
                temperature: 0.1
            };

            if (onStatusChange) onStatusChange('sending');
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
            const contentString = data.choices[0].message.content;
            if (onStatusChange) onStatusChange('thinking');

            if (documentType === 'annexe') {
                return {
                    success: true,
                    data: { title: contentString.trim() }
                };
            } else if (documentType === 'cause') {
                return {
                    success: true,
                    data: { cause: contentString.trim() }
                };
            } else {
                // Parse le JSON de la réponse
                const parsedData = JSON.parse(contentString);

                // S'assurer de générer un UUID pour chaque frais retourné par l'IA
                if (parsedData.expenses && Array.isArray(parsedData.expenses)) {
                    parsedData.expenses = parsedData.expenses.map(exp => ({
                        ...exp,
                        id: crypto.randomUUID(),
                        compteDe: exp.compteDe || "unassigned" // Sécurité
                    }));
                }

                // UUID pour les occupants (dossier_global)
                if (parsedData.occupants && Array.isArray(parsedData.occupants)) {
                    parsedData.occupants = parsedData.occupants.map(occ => ({
                        ...occ,
                        id: crypto.randomUUID()
                    }));
                }

                if (onStatusChange) onStatusChange('attaching');
                return {
                    success: true,
                    data: parsedData,
                    extractedFiles: allExtractedFiles || []
                };
            }

        } catch (error) {
            console.error("[aiManager] AI Live extraction error :", error);
            return {
                success: false,
                error: error.message || "Une erreur inconnue est survenue lors de l'appel à l'IA."
            };
        }
    }

    // Fallback de sécurité
    return {
        success: false,
        error: "Le mode IA (VITE_AI_MODE) n'est ni 'mock' ni 'live'."
    };
};

/**
 * Reformate les notes brutes du courtier en un compte rendu structuré.
 */
export const reformatCompteRendu = async (rawNotes, provider = 'openai', model = 'gpt-5.4', providedApiKey = null) => {
    const apiKey = providedApiKey || import.meta.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
        // Mode Mock si pas de clé API
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true, data: "# Compte Rendu de l'Expertise\n\n## Présences\n- Expert : M. Dupont\n- Courtier : Bureau Péchard\n\n## Constatations\n(À rédiger à partir des notes manuscrites)\n\n## Décisions & Suites à donner\n- Attente devis de remise en état" };
    }

    try {
        const payload = {
            model: model,
            messages: [
                {
                    role: "system",
                    content: `Tu es un rédacteur professionnel spécialisé dans les comptes rendus d'expertise sinistre. Tu reçois des notes brutes prises pendant une expertise. Ta mission est de les transformer en un compte rendu structuré, clair et professionnel. Utilise le format suivant :

# Compte Rendu de l'Expertise

## Présences
- (Liste des personnes présentes : expert, courtier, occupants, etc.)

## Visite des lieux & Constatations
- (Observations techniques pièce par pièce ou par zone. Sois exhaustif.)

## Origine probable du sinistre
- (Résumé de la cause, si mentionnée dans les notes)

## Remarques du courtier
- (observations du courtier, conseils donnés)

## Décisions & Suites à donner
- (Qui fait quoi ? Quels devis sont attendus ?)

## Ventilation financière
- (Si des montants sont mentionnés, ventile-les en Garantie Principale, Garantie Complémentaire, Pertes Indirectes et Franchise. Sinon, indique "À compléter après fixation.")`
                },
                {
                    role: "user",
                    content: rawNotes
                }
            ],
            response_format: { type: "text" },
            temperature: 0.3
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
        return {
            success: true,
            data: data.choices[0].message.content.trim()
        };
    } catch (error) {
        console.error("[aiManager] reformatCompteRendu error :", error);
        return {
            success: false,
            error: error.message || "Erreur lors du formatage du compte rendu."
        };
    }
};

// v5.6.1 - Mini-Agent de Refining (Affinage de texte assisté par IA)
// Utilisé dans le SAS pour affiner les champs narratifs (cause, divers, compteRendu)
const ANTI_HALLUCINATION_DATES = "RÈGLE ABSOLUE : NE JAMAIS inventer de dates (jours, mois, années). Si aucune date n'est explicitement fournie dans le texte d'origine, n'en invente absolument aucune.";

const REFINE_DIRECTIVES = {
    DEVELOP: `Tu reçois un texte technique d'expertise sinistre. Développe-le : allonge-le, rends-le plus rédigé, explicatif et professionnel. Conserve tous les faits, ajoute des transitions et des précisions techniques. Ne change pas le sens. Renvoie UNIQUEMENT le texte réécrit, sans introduction ni commentaire.\n\n${ANTI_HALLUCINATION_DATES}`,
    SUMMARIZE: `Tu reçois un texte technique d'expertise sinistre. Résume-le drastiquement : va droit au but, élimine les redondances. Tu peux utiliser des tirets/bullet points. Conserve les faits critiques (cause, localisation, montants). Renvoie UNIQUEMENT le texte résumé, sans introduction ni commentaire.\n\n${ANTI_HALLUCINATION_DATES}`,
    TECH_FOCUS: `Tu reçois un texte d'expertise sinistre. Réécris-le dans un ton hyper-factuel et technique. Utilise le vocabulaire du bâtiment et de l'assurance (infiltration, désordre, sinistre, dommages consécutifs, vétusté, etc.). Élimine toute émotion, contexte humain inutile ou formule de politesse. Renvoie UNIQUEMENT le texte réécrit, sans introduction ni commentaire.\n\n${ANTI_HALLUCINATION_DATES}`,
    CONTEXT_FOCUS: `Tu reçois un texte d'expertise sinistre. Réécris-le en mettant l'accent sur la chronologie des événements, les raisons de l'intervention et le contexte circonstanciel. Précise les dates, les intervenants et l'enchaînement des faits. Renvoie UNIQUEMENT le texte réécrit, sans introduction ni commentaire.\n\n${ANTI_HALLUCINATION_DATES}`,
    REWRITE: `Tu reçois un texte d'expertise sinistre (probablement issu de l'accumulation de plusieurs notes ou rapports). Ton objectif est de le RÉÉCRIRE COMPLÈTEMENT de manière globale. Fusionne les idées de façon naturelle et fluide. Le résultat final doit se lire comme un seul récit structuré et cohérent, comme si tu avais eu toutes les informations dès le départ. N'ajoute aucune information qui n'est pas dans le texte original, mais restructure-le totalement pour la lisibilité. Renvoie UNIQUEMENT le texte réécrit, sans introduction ni commentaire.\n\n${ANTI_HALLUCINATION_DATES}`
};

/**
 * [v5.6.1] Mini-Agent Refine : affine un texte selon une directive.
 * @param {string} currentText - Le texte à affiner
 * @param {'DEVELOP'|'SUMMARIZE'|'TECH_FOCUS'|'CONTEXT_FOCUS'} directive - La directive d'affinage
 * @param {string|null} providedApiKey - Clé API optionnelle
 * @returns {Promise<{success: boolean, text?: string, error?: string}>}
 */
export const refineText = async (currentText, directive, providedApiKey = null) => {
    if (!currentText || currentText.trim() === '') {
        return { success: false, error: "Aucun texte à affiner." };
    }

    const apiKey = providedApiKey || import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
        return { success: false, error: "Clé API non configurée." };
    }

    const systemPrompt = REFINE_DIRECTIVES[directive];
    if (!systemPrompt) {
        return { success: false, error: `Directive inconnue : ${directive}` };
    }

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-5.4-nano",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: currentText }
                ],
                temperature: 0.0,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `Erreur API HTTP ${response.status}`);
        }

        const data = await response.json();
        const refinedText = data.choices[0].message.content.trim();
        return { success: true, text: refinedText };

    } catch (error) {
        console.error("[aiManager] refineText error:", error);
        return { success: false, error: error.message || "Erreur lors de l'affinage." };
    }
};

/**
 * [v5.6.5] Agent d'Affinage Intelligent de la Cause
 * Tunnel d'entrée de données pour le fil chronologique.
 */
export const refineCauseWithInput = async (existingCause, newInput, providedApiKey = null) => {
    const apiKey = providedApiKey || import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) return { success: false, error: "Clé API non configurée." };
    if (!newInput || newInput.trim() === '') return { success: true, cause: existingCause, changed: false };

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-5.4-nano",
                messages: [
                    {
                        role: "system",
                        content: `Tu es un agent de gestion de texte expert dans les dossiers d'expertise sinistre.

CONTEXTE :
Tu gères le champ "cause" d'un dossier. Ce champ contient un texte technique décrivant l'origine et les circonstances du sinistre.
L'utilisateur t'envoie un NOUVEL APPORT : cela peut être un texte à intégrer, un email collé, des notes brutes, ou une correction.

TA MISSION :
1. Si le champ cause actuel est VIDE et que le nouvel apport contient des infos sur la cause du sinistre → RÉDIGE une cause propre à partir du nouvel apport.
2. Si le champ cause actuel contient DÉJÀ du texte et que le nouvel apport est pertinent → FUSIONNE intelligemment. Intègre les nouvelles informations au bon endroit, sans créer de doublons.
3. Si le nouvel apport n'a AUCUN rapport avec la cause du sinistre (ex: simple salutation, question administrative) → RENVOIE la cause actuelle sans modification.

RÈGLES :
- N'invente JAMAIS d'informations. Tu ne peux que reformuler et structurer les données fournies.
- Le texte résultant doit être professionnel, technique et concis.
- Renvoie UNIQUEMENT un JSON : { "cause": "le texte final", "changed": true/false }
- "changed" = true si tu as modifié/enrichi la cause, false si tu l'as laissée identique.`
                    },
                    {
                        role: "user",
                        content: `CAUSE ACTUELLE :\n"""${existingCause || '(vide)'}"""\n\nNOUVEL APPORT :\n"""${newInput}"""`
                    }
                ],
                response_format: { type: "json_object" },
                temperature: 0.0,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `Erreur API HTTP ${response.status}`);
        }

        const data = await response.json();
        const parsed = JSON.parse(data.choices[0].message.content);
        return {
            success: true,
            cause: (parsed.cause || existingCause).trim(),
            changed: parsed.changed === true
        };

    } catch (error) {
        console.error("[aiManager] refineCauseWithInput error:", error);
        // Fallback en cas d'erreur : concaténation simple
        return { success: true, cause: existingCause + '\n\n' + newInput.trim(), changed: true };
    }
};

// ═══════════════════════════════════════════════════════════════
// CHEF D'ORCHESTRE — Pipeline global d'ingestion
// ═══════════════════════════════════════════════════════════════

// v5.5.5
/**
 * Étape 6 : Le Chef d'Orchestre & Dropzones
 * Orchestre l'ingestion globale de fichiers via le Routeur, distribue aux agents spécialisés,
 * et assemble le JSON final pour la modale globale.
 */
// v6.3.2 - Mode Lourd vs Mode Rapide via isDeepThinkingMode
export const processGlobalIngestion = async (files, providedApiKey = null, onStatusChange = null, model = 'gpt-5.4', existingContext = {}, addDebugLog = null, isDeepThinkingMode = true) => {
    
    // Stratégie de modèles
    const agentsModel = isDeepThinkingMode ? 'gpt-5.4' : 'gpt-5.4-mini';
    const fallbackModel = isDeepThinkingMode ? 'gpt-5.5' : 'gpt-5.4';

    let originalConsole = null;
    
    // Interception des logs F12 pour les envoyer dans la Console Développeur
    if (addDebugLog) {
        originalConsole = { log: console.log, warn: console.warn, error: console.error, info: console.info };
        const createInterceptor = (type) => (...args) => {
            originalConsole[type](...args); // Conserver le log original F12
            
            const message = args.map(a => {
                if (a instanceof Error) return a.message || String(a);
                if (typeof a === 'object') {
                    try { return JSON.stringify(a); } catch(e) { return String(a); }
                }
                return String(a);
            }).join(' ');

            let status = type === 'error' ? 'ERROR' : (type === 'warn' ? 'WARNING' : 'INFO');
            if (message.includes('✅') || message.includes('SUCCESS') || message.includes('✅')) status = 'SUCCESS';
            if (message.includes('❌') || message.includes('Erreur') || message.includes('fatal')) status = 'ERROR';

            let step = 'SYSTEM';
            if (message.includes('[MSG Parser]') || message.includes('MSG')) step = 'EXTRACTOR_MSG';
            else if (message.includes('[PDF')) step = 'EXTRACTOR_PDF';
            else if (message.includes('[Smart Bridge]')) step = 'SMART_BRIDGE';
            else if (message.includes('[aiHelpers]')) step = 'AI_HELPER';
            else if (message.includes('[aiManager]')) step = 'ORCHESTRATOR';
            else step = 'LOG';

            addDebugLog(step, status, message);
        };

        console.log = createInterceptor('log');
        console.warn = createInterceptor('warn');
        console.error = createInterceptor('error');
        console.info = createInterceptor('info');
    }

    try {
        if (addDebugLog) {
            addDebugLog('INGESTION_START', 'INFO', `Début du traitement de ${Array.from(files).length} fichier(s).`);
            addDebugLog('MODE_STRATEGY', 'INFO', `Mode Lourd (Deep Thinking) : ${isDeepThinkingMode ? 'ACTIF' : 'INACTIF'} | Agents: ${agentsModel} | Balai: ${fallbackModel}`);
        }
        if (onStatusChange) onStatusChange('routing');
        
        // On convertit les `files` en Array
        let rawFiles = Array.isArray(files) ? files : Array.from(files);
        
        let allExtractedFiles = [];
        let filesToRoute = [];

        // Extraction automatique des PJ des fichiers MSG
        for (const file of rawFiles) {
            if (file.name && file.name.toLowerCase().endsWith('.msg')) {
                // v5.5.5 - Les MSG passent AUSSI par le routeur (au lieu d'être forcés dans 3 agents)
                filesToRoute.push(file);
                try {
                    const { files: attachments } = await extractValidAttachmentsFromMsg(file);
                    allExtractedFiles.push(...attachments);
                    filesToRoute.push(...attachments);
                } catch (e) {
                    console.error("Erreur extraction PJ MSG:", e);
                }
            } else {
                filesToRoute.push(file);
            }
        }

        // 1. Triage via le Routeur (TOUS les fichiers, y compris MSG)
        if (addDebugLog) addDebugLog('ROUTEUR', 'INFO', 'Analyse et routage en cours...');
        const routeResult = await routeDocuments(filesToRoute, providedApiKey, onStatusChange);
        if (!routeResult.success) throw new Error(routeResult.error || "Échec du routage.");
        
        const routeMap = routeResult.data;
        if (addDebugLog) addDebugLog('ROUTEUR', 'SUCCESS', routeMap);

        // 2. Séparation des fichiers
        const adminFiles = [];
        const socialFiles = [];
        const narrativeFiles = [];
        const financialFiles = [];

        // v6.1.0 - Pipeline Hardening : dispatch avec forçage intelligent
        const dispatchLog = { ADMIN: [], SOCIAL: [], RECITS: [], FINANCIER: [] };
        for (const file of filesToRoute) {
            const fileName = file.name || 'document_sans_nom';
            const isMsg = fileName.toLowerCase().endsWith('.msg');
            // v6.1.0 - Détecter les PJ extraites des MSG (pas dans les fichiers originaux)
            const isExtractedFromMsg = !rawFiles.includes(file) && file.type === 'application/pdf';
            let categories = routeMap[fileName];
            
            if (!categories && isMsg) {
                categories = ['ADMIN', 'SOCIAL', 'RECITS'];
                console.warn(`[aiManager v6.1.0] ⚠️ MSG "${fileName}" non classé → fallback ADMIN+SOCIAL+RECITS`);
            } else if (!categories) {
                categories = ['ADMIN'];
                console.warn(`[aiManager v6.1.0] ⚠️ "${fileName}" non classé → fallback ADMIN`);
            }
            
            const cats = Array.isArray(categories) ? categories : [categories];
            
            // v6.1.0 - Les MSG contiennent quasi toujours ADMIN + SOCIAL + RECITS
            // (données contractuelles, noms, et circonstances du sinistre)
            if (isMsg) {
                ['ADMIN', 'SOCIAL', 'RECITS'].forEach(c => {
                    if (!cats.includes(c)) {
                        cats.push(c);
                        console.log(`[aiManager v6.1.0] 📌 MSG "${fileName}" → ${c} forcé`);
                    }
                });
            }

            // v6.1.0 - Les PJ PDF extraites d'un MSG sont très probablement des factures/devis
            if (isExtractedFromMsg && !cats.includes('FINANCIER')) {
                cats.push('FINANCIER');
                console.log(`[aiManager v6.1.0] 💶 PJ PDF "${fileName}" extraite de MSG → FINANCIER forcé`);
            }
            
            for (const cat of cats) {
                if (cat === 'ADMIN') { adminFiles.push(file); dispatchLog.ADMIN.push(fileName); }
                else if (cat === 'SOCIAL') { socialFiles.push(file); dispatchLog.SOCIAL.push(fileName); }
                else if (cat === 'RECITS') { narrativeFiles.push(file); dispatchLog.RECITS.push(fileName); }
                else if (cat === 'FINANCIER') { financialFiles.push(file); dispatchLog.FINANCIER.push(fileName); }
            }
        }
        
        console.log(`[aiManager] 📊 Dispatch final:`);
        console.log(`  ADMIN (${dispatchLog.ADMIN.length}):`, dispatchLog.ADMIN);
        console.log(`  SOCIAL (${dispatchLog.SOCIAL.length}):`, dispatchLog.SOCIAL);
        console.log(`  RECITS (${dispatchLog.RECITS.length}):`, dispatchLog.RECITS);
        console.log(`  FINANCIER (${dispatchLog.FINANCIER.length}):`, dispatchLog.FINANCIER);

        if (onStatusChange) onStatusChange('extracting');

        // 3. Phase 1 : Admin + Social + Récits en PARALLÈLE (v5.9.0 — cascade)
        if (addDebugLog) addDebugLog('PHASE_1_AGENTS', 'INFO', 'Lancement Admin, Social, Récits en parallèle...');
        // v5.9.3 - Smart Retry & Résilience : chaque agent est enveloppé dans withRetry.
        // Si un agent échoue définitivement, il renvoie un objet vide structuré → le pipeline continue.
        const adminPromise = adminFiles.length > 0
            ? withRetry(() => extractAdministrativeData(adminFiles, providedApiKey, null, agentsModel))
                .catch(err => { 
                    console.error('[aiManager] ❌ Agent Admin KO après retries:', err); 
                    if (addDebugLog) addDebugLog('AGENT_ADMIN', 'ERROR', null, err.message);
                    return { success: false, data: {} }; 
                })
            : Promise.resolve({ success: true, data: {} });

        const narrativePromise = narrativeFiles.length > 0
            ? withRetry(() => extractNarrativeData(narrativeFiles, providedApiKey, null, agentsModel, existingContext.cause || ''))
                .catch(err => { 
                    console.error('[aiManager] ❌ Agent Récits KO après retries:', err); 
                    if (addDebugLog) addDebugLog('AGENT_RECITS', 'ERROR', null, err.message);
                    return { success: false, data: {} }; 
                })
            : Promise.resolve({ success: true, data: {} });

        const socialPromise = socialFiles.length > 0
            ? withRetry(() => extractSocialData(socialFiles, providedApiKey, null, agentsModel))
                .catch(err => { 
                    console.error('[aiManager] ❌ Agent Social KO après retries:', err); 
                    if (addDebugLog) addDebugLog('AGENT_SOCIAL', 'ERROR', null, err.message);
                    return { success: false, data: { occupants: [], experts: [], intervenants: [] } }; 
                })
            : Promise.resolve({ success: true, data: { occupants: [], experts: [], intervenants: [] } });

        // Attente des 3 agents de Phase 1
        const [adminRes, narrativeRes, socialRes] = await Promise.all([
            adminPromise, narrativePromise, socialPromise
        ]);
        if (addDebugLog) addDebugLog('PHASE_1_AGENTS', 'SUCCESS', 'Phase 1 terminée.');

        // 4. Phase 2 : Agent Financier AVEC la liste des occupants (cascade v5.9.0)
        // L'agent reçoit les UUIDs des occupants pour rattacher les factures directement
        const occupantsForFinancial = (socialRes.success && socialRes.data?.occupants) || [];
        console.log(`[aiManager] 💰 Agent Financier: ${financialFiles.length} fichiers, ${occupantsForFinancial.length} occupants connus`);
        if (addDebugLog) addDebugLog('AGENT_FINANCIER', 'INFO', `Lancement Financier (${financialFiles.length} fichiers, ${occupantsForFinancial.length} occupants connus)`);

        // v5.9.3 - Smart Retry & Résilience
        const financialRes = financialFiles.length > 0
            ? await withRetry(() => extractFinancialData(financialFiles, providedApiKey, null, agentsModel, occupantsForFinancial))
                .catch(err => { 
                    console.error('[aiManager] ❌ Agent Financier KO après retries:', err); 
                    if (addDebugLog) addDebugLog('AGENT_FINANCIER', 'ERROR', null, err.message);
                    return { success: false, data: { expenses: [] } }; 
                })
            : { success: true, data: { expenses: [] } };

        // --- DÉBUT DU BLOC : AGENT BALAI (Phase 2) ---
        const missingVitalData = [];
        
        // 1. Scanner les données administratives vitales
        if (adminRes.data?.formData) {
            if (adminRes.data.formData.numPolice === null) missingVitalData.push('Numéro de Police (numPolice)');
            if (adminRes.data.formData.dateSinistre === null) missingVitalData.push('Date du Sinistre (dateSinistre)');
        }
        
        // 2. Scanner les causes narratives
        if (narrativeRes.data && narrativeRes.data.cause === null) missingVitalData.push('Origine technique du sinistre (cause)');

        if (missingVitalData.length > 0) {
            if (addDebugLog) addDebugLog('AGENT_BALAI', 'WARNING', `Trous détectés : ${missingVitalData.join(', ')}. Lancement de GPT-5.5 en renfort...`);
            
            try {
                // Utilisation du texte complet pour le rattrapage
                console.log(`[aiManager] 🧹 Lancement de l'Agent Balai (Fallback)... Mode: ${fallbackModel}`);
                if (addDebugLog) addDebugLog('AGENT_BALAI', 'INFO', `Lancement Agent Balai... Modèle: ${fallbackModel}`);
                
                const contentArray = await buildContentArrayParallel(filesToRoute, "");
                const globalText = contentArray.map(c => c.text || "").join('\n');
                
                const fallbackResults = await withRetry(() => runFallbackAgent(globalText, missingVitalData, providedApiKey, fallbackModel));
                if (addDebugLog) addDebugLog('AGENT_BALAI', 'SUCCESS', fallbackResults);

                // Fusion des trouvailles du Balai dans l'objet principal
                if (fallbackResults['Numéro de Police (numPolice)'] && fallbackResults['Numéro de Police (numPolice)'] !== 'INTROUVABLE') {
                    if (adminRes.data.formData) adminRes.data.formData.numPolice = fallbackResults['Numéro de Police (numPolice)'];
                }
                if (fallbackResults['Date du Sinistre (dateSinistre)'] && fallbackResults['Date du Sinistre (dateSinistre)'] !== 'INTROUVABLE') {
                    if (adminRes.data.formData) adminRes.data.formData.dateSinistre = fallbackResults['Date du Sinistre (dateSinistre)'];
                }
                if (fallbackResults['Origine technique du sinistre (cause)'] && fallbackResults['Origine technique du sinistre (cause)'] !== 'INTROUVABLE') {
                    if (narrativeRes.data) narrativeRes.data.cause = fallbackResults['Origine technique du sinistre (cause)'];
                }
                
            } catch (fallbackError) {
                if (addDebugLog) addDebugLog('AGENT_BALAI', 'ERROR', null, fallbackError.message);
                // On ne throw pas l'erreur ! Si le balai échoue, le dossier continue avec ses trous.
            }
        } else {
            if (addDebugLog) addDebugLog('AGENT_BALAI', 'INFO', 'Aucune donnée vitale manquante. Passage direct à la fusion.');
        }
        // --- FIN DU BLOC : AGENT BALAI ---

        // 4. Récupérer les occupants
        let occupants = [];
        if (socialRes.success && socialRes.data && socialRes.data.occupants) {
            occupants = socialRes.data.occupants;
        }

        // 5. Post-traitement : Rattacher les frais financiers aux occupants (fallback fuzzy matching)
        let expenses = financialRes.data?.expenses || [];
        if (expenses.length > 0 && occupants.length > 0) {
            expenses.forEach(exp => {
                if (exp.destinataireFacture && exp.destinataireFacture.trim() !== '') {
                    const destLower = exp.destinataireFacture.toLowerCase();
                    // Recherche d'une correspondance dans les noms/prénoms des occupants
                    const matchedOcc = occupants.find(o => {
                        const nom = (o.nom || '').toLowerCase();
                        const prenom = (o.prenom || '').toLowerCase();
                        return destLower.includes(nom) || nom.includes(destLower) || 
                               (prenom && (destLower.includes(prenom) || prenom.includes(destLower)));
                    });
                    if (matchedOcc) {
                        exp.compteDe = matchedOcc.id;
                    }
                }
            });
        }

        // 6. Fusion et assemblage
        const finalJson = {
            formData: {
                ...(adminRes.data?.formData || {}),
                cause: narrativeRes.data?.cause || "",
                divers: narrativeRes.data?.divers || ""
            },
            references: adminRes.data?.references || [],
            experts: socialRes.data?.experts || [],
            occupants: occupants,
            intervenants: socialRes.data?.intervenants || [],
            expenses: expenses,
            technicalFilesToAttach: narrativeRes.data?.technicalFilesToAttach || []
        };

        if (onStatusChange) onStatusChange('attaching'); // Fini
        
        if (addDebugLog) addDebugLog('PIPELINE_GLOBAL', 'SUCCESS', 'Fusion et assemblage terminés.');
        return { success: true, data: finalJson, extractedFiles: allExtractedFiles };

    } catch (error) {
        console.error("[aiManager] processGlobalIngestion error:", error);
        if (addDebugLog) addDebugLog('PIPELINE_GLOBAL', 'ERROR', null, error.message || "Erreur inconnue");
        return { success: false, error: error.message || "Erreur lors de l'ingestion globale." };
    } finally {
        if (originalConsole) {
            console.log = originalConsole.log;
            console.warn = originalConsole.warn;
            console.error = originalConsole.error;
            console.info = originalConsole.info;
        }
    }
};
