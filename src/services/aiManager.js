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
const pdfToBase64Images = async (file, maxPagesOverride = 20) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const images = [];
    const maxPages = Math.min(pdf.numPages, maxPagesOverride); // Limite de sécurité à 20 pages par défaut

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
export const extractDataFromDocument = async (files, documentType = 'facture', provider = 'openai', model = 'gpt-4o', providedApiKey = null, onStatusChange = null) => {
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

/**
 * [v5.5.0] Étape 1 : Le Routeur (Triage)
 * Classe un ensemble de documents dans 4 catégories : ADMIN, SOCIAL, RECITS, FINANCIER.
 * Utilise gpt-4o-mini pour analyser rapidement un extrait ou la première page.
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
            mockResult[f.name || 'document_sans_nom'] = 'ADMIN';
        });
        return { success: true, data: mockResult };
    }

    try {
        if (onStatusChange) onStatusChange('routing');
        const contentArray = [{ type: "text", text: "Voici les documents à classifier." }];
        
        for (const item of fileArray) {
            const fileName = item.name || 'document_sans_nom';
            contentArray.push({ type: "text", text: `\n\n[DÉBUT DOCUMENT : ${fileName}]\n` });
            
            if (typeof item === 'string') {
                 // Si on a passé du texte brut
                 contentArray.push({ type: "text", text: item.substring(0, 1500) });
            } else {
                const fileNameLower = fileName.toLowerCase();
                if (fileNameLower.endsWith('.msg')) {
                    try {
                        const { bodyText } = await parseMsgFile(item);
                        // Extrait rapide pour l'email
                        contentArray.push({ type: "text", text: bodyText.substring(0, 1500) });
                    } catch (e) {
                        contentArray.push({ type: "text", text: "[Fichier MSG illisible]" });
                    }
                } else if (item.type === 'application/pdf') {
                    // Pour la classification, la première page suffit souvent (et ça coûte beaucoup moins cher)
                    const base64Images = await pdfToBase64Images(item, 1);
                    for (const img of base64Images) {
                        contentArray.push({ type: "image_url", image_url: { url: img } });
                    }
                } else if (item.type && item.type.startsWith('image/')) {
                    const base64Image = await fileToBase64(item);
                    contentArray.push({ type: "image_url", image_url: { url: base64Image } });
                } else {
                    contentArray.push({ type: "text", text: "[Format non supporté pour la vision]" });
                }
            }
            contentArray.push({ type: "text", text: `\n[FIN DOCUMENT : ${fileName}]\n` });
        }

        const systemPrompt = `Tu es un routeur intelligent chargé de trier des documents d'assurance et d'expertise sinistre.
Tu dois classer CHAQUE document fourni dans l'une des 4 catégories suivantes, et STRICTEMENT celles-ci :
- "ADMIN" : Polices d'assurance, conditions générales, convocations d'expertise, documents officiels de couverture.
- "SOCIAL" : Emails de syndic listant des noms, cartes d'identité, documents d'assurance personnels ou échanges informels.
- "RECITS" : Rapports d'intervention, constats pompiers, chronologies des faits, déclarations circonstanciées.
- "FINANCIER" : Devis, factures, tickets de caisse, justificatifs de paiement.

Analyse l'extrait (texte ou 1ère page) de chaque document et détermine sa catégorie.

Tu dois renvoyer STRICTEMENT un objet JSON valide qui mappe le nom exact de chaque fichier à sa catégorie.
Format attendu :
{
  "nomDuFichier1.pdf": "ADMIN",
  "email_syndic.msg": "SOCIAL",
  "facture_plombier.jpg": "FINANCIER"
}
Ne renvoie aucun autre texte, juste le JSON.`;

        const payload = {
            model: "gpt-4o-mini", // Modèle rapide, peu coûteux et pertinent pour le triage
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
        const parsedData = JSON.parse(data.choices[0].message.content);
        return { success: true, data: parsedData };

    } catch (error) {
        console.error("[aiManager] routeDocuments error :", error);
        return { success: false, error: error.message || "Erreur lors du routage des documents." };
    }
};

/**
 * [v5.5.1] Étape 2 : L'Agent Administratif
 * Extrait les données administratives, contractuelles et les coordonnées.
 * Ne reçoit que les documents taggués "ADMIN".
 */
export const extractAdministrativeData = async (files, providedApiKey = null, onStatusChange = null, model = 'gpt-4o') => {
    const fileArray = Array.isArray(files) ? files : [files];
    const apiKey = providedApiKey || import.meta.env.VITE_OPENAI_API_KEY;
    const mode = apiKey ? 'live' : 'mock';

    if (mode === 'mock') {
        if (onStatusChange) onStatusChange('extracting');
        await new Promise(resolve => setTimeout(resolve, 1500));
        return {
            success: true,
            data: {
                formData: {
                    dateExp: "2026-06-15", heureExp: "10:00", nomResidence: "Copropriété Les Acacias", adresse: "12 rue de la Paix, Paris", refPechard: "DOSS-2026-001", expertInfos: "M. Dupont", bureau: "Bureau Péchard",
                    dateSinistre: "2026-06-01", dateDeclaration: "2026-06-02", declarant: "Syndic ABC", nomCie: "AXA Belgium", nomContrat: "Top Habitation", numPolice: "POL-123", numSinistreCie: "SIN-999", 
                    numConditionsGenerales: "CG-2022", franchise: "250", pertesIndirectes: "10%", isAxa: true,
                    isContradictoire: false, cieContradictoire: "", bureauContradictoire: "", expertContradictoire: "", compteDeContradictoire: ""
                },
                references: [ { nom: "M. Martin", ref: "Réf Client 789" } ]
            }
        };
    }

    try {
        if (onStatusChange) onStatusChange('extracting');
        const contentArray = [{ type: "text", text: "Voici les documents administratifs à analyser." }];
        
        for (const item of fileArray) {
            const fileName = item.name || 'document_sans_nom';
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
                    // Pour l'agent administratif on analyse tout le PDF car les infos peuvent être éparpillées
                    const base64Images = await pdfToBase64Images(item); 
                    for (const img of base64Images) {
                        contentArray.push({ type: "image_url", image_url: { url: img } });
                    }
                } else if (item.type && item.type.startsWith('image/')) {
                    const base64Image = await fileToBase64(item);
                    contentArray.push({ type: "image_url", image_url: { url: base64Image } });
                } else {
                    contentArray.push({ type: "text", text: "[Format non supporté pour la vision]" });
                }
            }
            contentArray.push({ type: "text", text: `\n[FIN DOCUMENT : ${fileName}]\n` });
        }

        const systemPrompt = `Tu es un Agent Administratif expert en assurances et expertises sinistres. 
Ton rôle est d'analyser attentivement les documents fournis (polices d'assurance, conditions particulières, convocations, correspondances) et d'en extraire les informations contractuelles, les coordonnées de l'expertise et les références.

RÈGLES ABSOLUES :
1. N'invente AUCUNE information. Si l'information n'est pas explicitement présente dans le document, renvoie une chaîne vide "".
2. Remplis les champs avec précision.
3. Si la compagnie d'assurance (nomCie) est "AXA", ou une de ses filiales, tu DOIS ABSOLUMENT mettre le booléen "isAxa" à true. Sinon false.
4. "bureau" doit être "Bureau Péchard" par défaut si non spécifié, mais respecte la valeur si elle existe.
5. "pertesIndirectes" doit être un pourcentage (ex: "10%") ou "" si non trouvé.
6. Tu dois renvoyer STRICTEMENT et UNIQUEMENT un objet JSON valide, sans aucune introduction, sans formatage markdown additionnel autre que le JSON.

Voici le format EXACT attendu, avec tous les champs présents :
{
  "formData": {
    "dateExp": "", "heureExp": "", "nomResidence": "", "adresse": "", "refPechard": "", "expertInfos": "", "bureau": "Bureau Péchard",
    "dateSinistre": "", "dateDeclaration": "", "declarant": "", "nomCie": "", "nomContrat": "", "numPolice": "", "numSinistreCie": "", 
    "numConditionsGenerales": "", "franchise": "", "pertesIndirectes": "", "isAxa": false,
    "isContradictoire": false, "cieContradictoire": "", "bureauContradictoire": "", "expertContradictoire": "", "compteDeContradictoire": ""
  },
  "references": [ 
    { "nom": "", "ref": "" } 
  ]
}`;

        const payload = {
            model: model, // gpt-4o recommandé pour la précision de l'extraction
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
        const parsedData = JSON.parse(data.choices[0].message.content);
        return { success: true, data: parsedData };

    } catch (error) {
        console.error("[aiManager] extractAdministrativeData error :", error);
        return { success: false, error: error.message || "Erreur lors de l'extraction administrative." };
    }
};

// v5.5.2
/**
 * Étape 3 : L'Agent Social (Générateur d'UUID)
 * Extrait les données sociales (experts, occupants) à partir des fichiers taggués "SOCIAL".
 */
export const extractSocialData = async (files, providedApiKey = null, onStatusChange = null, model = 'gpt-4o') => {
    const fileArray = Array.isArray(files) ? files : [files];
    const apiKey = providedApiKey || import.meta.env.VITE_OPENAI_API_KEY;
    const mode = apiKey ? 'live' : 'mock';

    if (mode === 'mock') {
        if (onStatusChange) onStatusChange('extracting');
        await new Promise(resolve => setTimeout(resolve, 1500));
        return {
            success: true,
            data: {
                experts: [{ nom: "Expert Mock", tel: "0499 99 99 99" }],
                occupants: [{
                    id: crypto.randomUUID(), nom: "Locataire Mock", prenom: "Jean", etage: "1er", statut: "Locataire", tel: "0499 88 88 88", email: "jean@mock.com",
                    rc: false, rcPolice: "", secAssurance: false, secCie: "", secPolice: "", secType: "", contreExpert: false
                }]
            }
        };
    }

    try {
        if (onStatusChange) onStatusChange('extracting');
        const contentArray = [{ type: "text", text: "Voici les documents sociaux à analyser." }];
        
        for (const item of fileArray) {
            const fileName = item.name || 'document_sans_nom';
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
                    const base64Images = await pdfToBase64Images(item); 
                    for (const img of base64Images) {
                        contentArray.push({ type: "image_url", image_url: { url: img } });
                    }
                } else if (item.type && item.type.startsWith('image/')) {
                    const base64Image = await fileToBase64(item);
                    contentArray.push({ type: "image_url", image_url: { url: base64Image } });
                } else {
                    contentArray.push({ type: "text", text: "[Format non supporté pour la vision]" });
                }
            }
            contentArray.push({ type: "text", text: `\n[FIN DOCUMENT : ${fileName}]\n` });
        }

        const systemPrompt = `Tu es un Agent Social expert dans l'analyse de documents liés aux expertises immobilières.
Ton rôle est de lire ces documents (emails de syndics, tableaux de contacts, baux de location) et d'en extraire TOUS les intervenants (experts et occupants).

RÈGLES ABSOLUES :
1. N'invente AUCUNE information. Si l'information n'est pas présente, renvoie une chaîne vide "" ou false pour les booléens.
2. Le champ "statut" de chaque occupant DOIT IMPÉRATIVEMENT être l'une de ces valeurs exactes : "Locataire", "Propriétaire occupant", "Propriétaire non occupant", ou "Autre". 
3. Tu dois renvoyer STRICTEMENT et UNIQUEMENT un objet JSON valide, sans aucune introduction, sans formatage markdown additionnel autre que le JSON.

Voici le format EXACT attendu, avec tous les champs présents :
{
  "experts": [ { "nom": "", "tel": "" } ],
  "occupants": [
    {
      "nom": "", "prenom": "", "etage": "", "statut": "Locataire", "tel": "", "email": "",
      "rc": false, "rcPolice": "", "secAssurance": false, "secCie": "", "secPolice": "", "secType": "", "contreExpert": false
    }
  ]
}`;

        const payload = {
            model: model,
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
        const parsedData = JSON.parse(data.choices[0].message.content);

        // Ajout OBLIGATOIRE du UUID via crypto.randomUUID() pour chaque occupant
        if (parsedData.occupants && Array.isArray(parsedData.occupants)) {
            parsedData.occupants = parsedData.occupants.map(occ => ({
                ...occ,
                id: crypto.randomUUID()
            }));
        }

        return { success: true, data: parsedData };

    } catch (error) {
        console.error("[aiManager] extractSocialData error :", error);
        return { success: false, error: error.message || "Erreur lors de l'extraction sociale." };
    }
};

// v5.5.3
/**
 * Étape 4 : L'Agent Récits (Texte libre)
 * Extrait et synthétise les données textuelles (cause, compte rendu, divers) 
 * à partir des fichiers taggués "RECITS".
 */
export const extractNarrativeData = async (files, providedApiKey = null, onStatusChange = null, model = 'gpt-4o') => {
    const fileArray = Array.isArray(files) ? files : [files];
    const apiKey = providedApiKey || import.meta.env.VITE_OPENAI_API_KEY;
    const mode = apiKey ? 'live' : 'mock';

    if (mode === 'mock') {
        if (onStatusChange) onStatusChange('extracting');
        await new Promise(resolve => setTimeout(resolve, 1500));
        return {
            success: true,
            data: {
                cause: "Fuite d'eau suite à la rupture d'une canalisation encastrée dans le mur de la salle de bain.",
                divers: "Présence de moisissures constatée. Locataire coopératif.",
                compteRendu: "Visite sur place à 10h. Constat des dégâts dans la salle de bain et le couloir adjacent. Prise de mesures d'humidité."
            }
        };
    }

    try {
        if (onStatusChange) onStatusChange('extracting');
        const contentArray = [{ type: "text", text: "Voici les documents (récits, rapports, chronologies) à synthétiser." }];
        
        for (const item of fileArray) {
            const fileName = item.name || 'document_sans_nom';
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
                    const base64Images = await pdfToBase64Images(item); 
                    for (const img of base64Images) {
                        contentArray.push({ type: "image_url", image_url: { url: img } });
                    }
                } else if (item.type && item.type.startsWith('image/')) {
                    const base64Image = await fileToBase64(item);
                    contentArray.push({ type: "image_url", image_url: { url: base64Image } });
                } else {
                    contentArray.push({ type: "text", text: "[Format non supporté pour la vision]" });
                }
            }
            contentArray.push({ type: "text", text: `\n[FIN DOCUMENT : ${fileName}]\n` });
        }

        const systemPrompt = `Tu es un Agent Rédacteur spécialisé dans les expertises sinistres.
Ton rôle est d'analyser des documents narratifs (rapports de recherche de fuite, constats pompiers, emails circonstanciés, chronologies) et de rédiger une synthèse professionnelle, claire et factuelle.

RÈGLES ABSOLUES :
1. Reste 100% neutre et objectif. Ne fais aucune supposition.
2. Si un champ ne peut pas être rempli grâce aux documents fournis, renvoie une chaîne vide "".
3. Ne casse pas la logique métier : la cause doit être technique et précise. Le compte rendu doit refléter l'ordre des événements ou la chronologie de la visite.
4. Tu dois renvoyer STRICTEMENT et UNIQUEMENT un objet JSON valide, sans aucune introduction, ni markdown autre que la structure demandée.

Voici le format EXACT attendu :
{
  "cause": "Paragraphe expliquant l'origine technique et la description des dommages (ex: rupture de canalisation, engorgement).",
  "divers": "Remarques diverses, points d'attention particuliers, ou informations qui ne rentrent pas ailleurs.",
  "compteRendu": "Compte-rendu chronologique factuel de la visite ou de la succession des événements."
}`;

        const payload = {
            model: model, // gpt-4o recommandé pour la rédaction et la synthèse de texte
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: contentArray }
            ],
            response_format: { type: "json_object" },
            temperature: 0.2 // Légèrement plus haut (0.2) pour permettre une rédaction fluide, tout en restant factuel
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
        return { success: true, data: parsedData };

    } catch (error) {
        console.error("[aiManager] extractNarrativeData error :", error);
        return { success: false, error: error.message || "Erreur lors de l'extraction narrative." };
    }
};

// v5.5.4
/**
 * Étape 5 : L'Agent Financier
 * Extrait les données financières (devis, factures) et les rattache aux occupants.
 * Ne reçoit que les documents taggués "FINANCIER".
 */
export const extractFinancialData = async (files, occupantsList = [], providedApiKey = null, onStatusChange = null, model = 'gpt-4o') => {
    const fileArray = Array.isArray(files) ? files : [files];
    const apiKey = providedApiKey || import.meta.env.VITE_OPENAI_API_KEY;
    const mode = apiKey ? 'live' : 'mock';

    if (mode === 'mock') {
        if (onStatusChange) onStatusChange('extracting');
        await new Promise(resolve => setTimeout(resolve, 1500));
        return {
            success: true,
            data: {
                expenses: [{
                    id: crypto.randomUUID(),
                    prestataire: "Plombier Mock", type: "Devis", ref: "DEV-MOCK-001", desc: "Recherche de fuite",
                    compteDe: "unassigned", montantReclame: "450.00", montantValide: "450.00",
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
        const contentArray = [{ type: "text", text: "Voici les documents financiers (devis, factures) à analyser." }];
        const validFileNames = [];
        
        for (const item of fileArray) {
            const fileName = item.name || 'document_sans_nom';
            validFileNames.push(fileName);
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
                    const base64Images = await pdfToBase64Images(item); 
                    for (const img of base64Images) {
                        contentArray.push({ type: "image_url", image_url: { url: img } });
                    }
                } else if (item.type && item.type.startsWith('image/')) {
                    const base64Image = await fileToBase64(item);
                    contentArray.push({ type: "image_url", image_url: { url: base64Image } });
                } else {
                    contentArray.push({ type: "text", text: "[Format non supporté pour la vision]" });
                }
            }
            contentArray.push({ type: "text", text: `\n[FIN DOCUMENT : ${fileName}]\n` });
        }

        const occupantsContext = occupantsList.map(o => `Nom/Prénom: ${o.nom} ${o.prenom} | ID: ${o.id}`).join('\\n');

        const systemPrompt = `Tu es un Agent Financier expert en comptabilité et expertise sinistres.
Ton rôle est d'analyser des documents financiers (devis, factures, tickets) et d'extraire les réclamations financières.

RÈGLES ABSOLUES :
1. RÈGLE DU HTVA STRICT : TOUS les montants extraits (montantReclame, montantDevis, montantFacture, montantValide) DOIVENT IMPÉRATIVEMENT être Hors TVA (HTVA). Si le texte fournit un montant TVAC, extrais le HTVA ou déduis-le mathématiquement avec le taux de TVA indiqué. Formate les montants sous forme de texte avec un point (ex: "450.00").
2. "typeMontant" DOIT TOUJOURS être "HTVA".
3. RÈGLE DES DEVIS ET FACTURES : Si le document est un DEVIS, remplis "montantDevis", "refDevis", "prestataireDevis" et "descDevis". Si c'est une FACTURE, remplis "montantFacture", "refFacture", "prestataireFacture" et "descFacture". Copie la valeur la plus pertinente dans "montantReclame" et "montantValide". "type" doit valoir "Devis" ou "Facture".
4. SOURCE FILE NAME : Remplis "sourceFileName" avec le nom EXACT du fichier parmi cette liste : [${validFileNames.join(', ')}]. Il est interdit d'inventer un nom.
5. COMPTE DE (DESTINATAIRE) : Essaie de trouver à qui est adressée la facture parmi cette liste de personnes : 
${occupantsContext ? occupantsContext : "(Aucun occupant fourni)"}
Si tu trouves une correspondance claire, mets l'ID exact de cette personne dans "compteDe". Sinon, écris STRICTEMENT "unassigned".
6. Tu dois renvoyer STRICTEMENT un JSON valide, sans introduction, ni markdown.

Format EXACT attendu :
{
  "expenses": [
    {
      "prestataire": "", "type": "Devis ou Facture", "ref": "", "desc": "", 
      "compteDe": "UUID_DE_L_OCCUPANT_MATCHÉ (ou unassigned)", "montantReclame": "", "montantValide": "", 
      "typeMontant": "HTVA", "categorieGarantie": "Principale ou Complémentaire", "tauxTVA": 0, 
      "factureRecue": false, "pourcentageVetuste": 0, "motifRefus": "", "avisCouverture": "Oui", "noteCouverture": "",
      "montantDevis": "", "refDevis": "", "prestataireDevis": "", "descDevis": "",
      "montantFacture": "", "refFacture": "", "prestataireFacture": "", "descFacture": "",
      "sourceFileName": "NOM_EXACT_DU_FICHIER"
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

        // Ajout OBLIGATOIRE du UUID via crypto.randomUUID() pour chaque ligne de frais
        if (parsedData.expenses && Array.isArray(parsedData.expenses)) {
            parsedData.expenses = parsedData.expenses.map(exp => ({
                ...exp,
                id: crypto.randomUUID(),
                compteDe: exp.compteDe || "unassigned"
            }));
        }

        return { success: true, data: parsedData };

    } catch (error) {
        console.error("[aiManager] extractFinancialData error :", error);
        return { success: false, error: error.message || "Erreur lors de l'extraction financière." };
    }
};

// v5.5.5
/**
 * Étape 6 : Le Chef d'Orchestre & Dropzones
 * Orchestre l'ingestion globale de fichiers via le Routeur, distribue aux agents spécialisés,
 * et assemble le JSON final pour la modale globale.
 */
export const processGlobalIngestion = async (files, providedApiKey = null, onStatusChange = null, model = 'gpt-4o') => {
    try {
        if (onStatusChange) onStatusChange('routing');
        
        // On convertit les `files` en Array
        let rawFiles = Array.isArray(files) ? files : Array.from(files);
        
        let allExtractedFiles = [];
        let filesToRoute = [];
        let msgFiles = [];

        // Extraction automatique des PJ des fichiers MSG
        for (const file of rawFiles) {
            if (file.name && file.name.toLowerCase().endsWith('.msg')) {
                msgFiles.push(file);
                try {
                    const attachments = await extractValidAttachmentsFromMsg(file);
                    allExtractedFiles.push(...attachments);
                    filesToRoute.push(...attachments);
                } catch (e) {
                    console.error("Erreur extraction PJ MSG:", e);
                }
            } else {
                filesToRoute.push(file);
            }
        }

        // 1. Triage via le Routeur (uniquement pour les fichiers non-MSG)
        const routeResult = await routeDocuments(filesToRoute, providedApiKey, onStatusChange);
        if (!routeResult.success) throw new Error(routeResult.error || "Échec du routage.");
        
        const routeMap = routeResult.data;

        // 2. Séparation des fichiers
        const adminFiles = [];
        const socialFiles = [];
        const narrativeFiles = [];
        const financialFiles = [];

        // Les fichiers MSG contiennent souvent de TOUT (contrat, occupants, récit). On les force dans les 3 agents principaux.
        for (const msgFile of msgFiles) {
            adminFiles.push(msgFile);
            socialFiles.push(msgFile);
            narrativeFiles.push(msgFile);
        }

        for (const file of filesToRoute) {
            const fileName = file.name || 'document_sans_nom';
            const category = routeMap[fileName] || 'ADMIN';
            
            if (category === 'ADMIN') adminFiles.push(file);
            else if (category === 'SOCIAL') socialFiles.push(file);
            else if (category === 'RECITS') narrativeFiles.push(file);
            else if (category === 'FINANCIER') financialFiles.push(file);
        }

        if (onStatusChange) onStatusChange('extracting');

        // 3. Lancer les agents indépendants en parallèle
        const adminPromise = adminFiles.length > 0 
            ? extractAdministrativeData(adminFiles, providedApiKey, null, model)
            : Promise.resolve({ success: true, data: {} });
            
        const narrativePromise = narrativeFiles.length > 0
            ? extractNarrativeData(narrativeFiles, providedApiKey, null, model)
            : Promise.resolve({ success: true, data: {} });
            
        const socialPromise = socialFiles.length > 0
            ? extractSocialData(socialFiles, providedApiKey, null, model)
            : Promise.resolve({ success: true, data: { occupants: [], experts: [] } });

        // On attend la résolution des premiers agents
        const [adminRes, narrativeRes, socialRes] = await Promise.all([adminPromise, narrativePromise, socialPromise]);

        // 4. Récupérer les occupants (pour l'agent financier)
        let occupants = [];
        if (socialRes.success && socialRes.data && socialRes.data.occupants) {
            occupants = socialRes.data.occupants;
        }

        // 5. Lancer l'agent financier avec la liste des occupants injectée
        let financialRes = { success: true, data: { expenses: [] } };
        if (financialFiles.length > 0) {
            financialRes = await extractFinancialData(financialFiles, occupants, providedApiKey, null, model);
        }

        // 6. Fusion et assemblage
        const finalJson = {
            formData: {
                ...(adminRes.data?.formData || {}),
                cause: narrativeRes.data?.cause || "",
                divers: narrativeRes.data?.divers || "",
                compteRendu: narrativeRes.data?.compteRendu || ""
            },
            references: adminRes.data?.references || [],
            experts: socialRes.data?.experts || [],
            occupants: occupants,
            expenses: financialRes.data?.expenses || []
        };

        if (onStatusChange) onStatusChange('attaching'); // Fini
        
        return { success: true, data: finalJson, extractedFiles: allExtractedFiles };

    } catch (error) {
        console.error("[aiManager] processGlobalIngestion error:", error);
        return { success: false, error: error.message || "Erreur lors de l'ingestion globale." };
    }
};
