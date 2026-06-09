/**
 * aiManager.js
 * Facade pour toutes les requêtes d'Intelligence Artificielle.
 * Gère le mode "mock" et "live" pour l'isolation complète des appels API.
 */

import * as pdfjsLib from 'pdfjs-dist';
import MsgReader from '@kenjiuno/msgreader';

// Configurer le worker PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Utilitaire de conversion File -> Base64
const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
};

// Utilitaire d'extraction du texte + pièces jointes d'un fichier .msg (Outlook)
const MIME_MAP = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', tiff: 'image/tiff', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
const getMimeType = (filename) => { const ext = (filename || '').split('.').pop().toLowerCase(); return MIME_MAP[ext] || 'application/octet-stream'; };

export const extractValidAttachmentsFromMsg = async (msgFile) => {
    const arrayBuffer = await msgFile.arrayBuffer();
    const msgReader = new MsgReader(arrayBuffer);
    const fileData = msgReader.getFileData();
    const validFilesArray = [];

    if (fileData.attachments && fileData.attachments.length > 0) {
        for (let i = 0; i < fileData.attachments.length; i++) {
            const att = fileData.attachments[i];
            const attName = att.fileName || att.name || `attachment_${i}`;
            const ext = attName.split('.').pop().toLowerCase();

            if (['doc', 'docx', 'xls', 'xlsx'].includes(ext)) {
                console.warn(`Le fichier ${attName} a été ignoré car seuls les PDF et Images sont supportés.`);
                continue;
            }

            try {
                const attData = msgReader.getAttachment(i);
                if (attData && attData.content) {
                    const mime = getMimeType(attName);
                    // On ne convertit que si c'est un pdf ou image
                    if (mime === 'application/pdf' || mime.startsWith('image/')) {
                        const blob = new Blob([new Uint8Array(attData.content)], { type: mime });
                        const extractedFile = new File([blob], attName, { type: mime });
                        validFilesArray.push(extractedFile);
                    }
                }
            } catch (e) {
                console.warn(`[aiManager] Impossible d'extraire la pièce jointe ${attName}:`, e);
            }
        }
    }

    return validFilesArray;
};

const parseMsgFile = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const msgReader = new MsgReader(arrayBuffer);
    const fileData = msgReader.getFileData();
    
    // Extract text body
    const parts = [];
    if (fileData.subject) parts.push(`Sujet: ${fileData.subject}`);
    if (fileData.senderName) parts.push(`De: ${fileData.senderName}`);
    if (fileData.body) parts.push(fileData.body);
    const bodyText = parts.join('\n');

    // Extract attachments as File objects using the new function
    const attachments = await extractValidAttachmentsFromMsg(file);

    return { bodyText, attachments };
};

// Utilitaire pour extraire les pages d'un PDF sous forme d'images Base64
const pdfToBase64Images = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const images = [];
    const maxPages = Math.min(pdf.numPages, 20); // Limite de sécurité à 20 pages

    for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const scale = 1.5;
        const viewport = page.getViewport({ scale });

        // Créer un canvas HTML
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Rendre la page sur le canvas
        await page.render({ canvasContext: context, viewport: viewport }).promise;

        // Convertir en base64
        images.push(canvas.toDataURL('image/jpeg', 0.8));
    }
    return images;
};

/**
 * Fonction principale d'extraction de données.
 * @param {File} file Le document (ex: Facture, Devis) sous forme d'objet File
 * @param {string} documentType Le type de document ("facture", "devis", "contrat")
 * @returns {Promise<Object>} Un objet JSON formaté pour financeStore.js
 */
export const extractDataFromDocument = async (files, documentType = 'facture', provider = 'openai', model = 'gpt-4o', providedApiKey = null) => {
    // Ensure files is an array
    const fileArray = Array.isArray(files) ? files : [files];

    // Determine the actual mode: Force "live" if an API key is available, otherwise fallback to "mock"
    const apiKey = providedApiKey || import.meta.env.VITE_OPENAI_API_KEY;
    const mode = apiKey ? 'live' : 'mock';

    if (mode === 'mock') {
        console.log(`[AI Mock] Aucune clé API trouvée. Extraction simulée pour un document de type: ${documentType}...`);

        // Simulation d'un délai réseau (2s)
        await new Promise(resolve => setTimeout(resolve, 2000));

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
  "expenses": [ { "prestataire": "", "type": "Facture", "ref": "", "desc": "", "compteDe": "unassigned", "montant": "", "typeMontant": "HTVA", "sourceFileName": "" } ]
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

            // Payload générique pour un modèle multimodal (ex: gpt-4o)
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
export const reformatCompteRendu = async (rawNotes, provider = 'openai', model = 'gpt-4o', providedApiKey = null) => {
    const apiKey = providedApiKey || import.meta.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
        // Mode Mock si pas de clé API
        await new Promise(resolve => setTimeout(resolve, 1500));
        return {
            success: true,
            data: `Chronologie : (Mock) Intervention sur place à 10h.
Paroles de l'expert : (Mock) "Les dégâts sont importants."
Actions de l'expert : (Mock) Prise de photos et mesures de l'humidité.
Remarques du courtier : (Mock) Le client était très stressé.
Décisions & Actions : (Mock) Attente du devis du plombier d'ici vendredi.`
        };
    }

    try {
        const payload = {
            model: model,
            messages: [
                {
                    role: "system",
                    content: `Tu es un assistant expert en expertise sinistre. Ton rôle est de transformer des notes brutes (souvent tapées rapidement sur le terrain) en un compte rendu structuré, professionnel et lisible.
Voici le contexte strict :
- L'auteur des notes (celui qui tape) est TOUJOURS le courtier.
- Les expertises se font toujours en présence de l'expert de la compagnie d'assurance, et du client (qui peut être la copropriété, le syndic, et/ou un simple propriétaire).
- Le rapport final est à destination des syndics et des copropriétaires. Le ton doit donc être formel, rassurant et objectif, en utilisant la troisième personne ou le "nous" professionnel.

Utilise ce format exact pour la restitution :
- Chronologie : (ce qu'il s'est passé)
- Constats et Paroles de l'expert : (ce que l'expert a constaté ou dit)
- Actions menées : (ce qui a été fait/vérifié sur place)
- Remarques du courtier : (observations du courtier, conseils donnés)
- Décisions & Suites à donner : (Qui fait quoi ? Quels devis sont attendus ?)
- Ventilation financière : (Si des montants sont mentionnés, ventile-les en Garantie Principale, Garantie Complémentaire, Pertes Indirectes et Franchise. Sinon, indique "À compléter après fixation.")`
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
