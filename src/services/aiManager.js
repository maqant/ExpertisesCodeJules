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
const MIME_MAP = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', tiff: 'image/tiff', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', msg: 'application/vnd.ms-outlook' };
const getMimeType = (filename) => { const ext = (filename || '').split('.').pop().toLowerCase(); return MIME_MAP[ext] || 'application/octet-stream'; };

// v5.5.15 - Table de référence des franchises légales (IPC/ABEX Belgique)
// Clé = "YYYY" (année), valeur = montant de la franchise légale pour cette année.
// Pour une résolution mensuelle plus fine, on pourra étendre avec "YYYY-MM" comme clé.
// Source : indices officiels publiés par le SPF Économie / Assuralia.
// ⚠️ À COMPLÉTER avec les montants exacts de votre référentiel métier.
const FRANCHISE_LEGALE_INDEX = {
    '2020': 282.77,
    '2021': 289.48,
    '2022': 297.47,
    '2023': 322.23,
    '2024': 328.14,
    '2025': 335.87,
    '2026': 341.52,
};

/**
 * Résout le montant exact de la franchise légale à partir d'une date de sinistre (YYYY-MM-DD).
 * Retourne le montant (number) ou null si la date est hors index.
 */
const _resolveFranchiseLegale = (dateSinistreStr) => {
    try {
        const date = new Date(dateSinistreStr);
        if (isNaN(date.getTime())) return null;
        const year = String(date.getFullYear());
        // D'abord chercher par année-mois (pour une résolution mensuelle future)
        const monthKey = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (FRANCHISE_LEGALE_INDEX[monthKey]) return FRANCHISE_LEGALE_INDEX[monthKey];
        // Sinon par année
        if (FRANCHISE_LEGALE_INDEX[year]) return FRANCHISE_LEGALE_INDEX[year];
        return null;
    } catch (e) {
        console.warn('[aiManager] Erreur résolution franchise légale:', e);
        return null;
    }
};

// v5.5.13 - Extraction RÉCURSIVE des pièces jointes d'un fichier .msg (Outlook)
// Fix: détection des sous-mails via OLE magic bytes (D0 CF 11 E0) + attachMethod === 5
// Inclut les images inline (CID) > 20KB, génère des noms pour les PJ sans nom.

const MIN_INLINE_IMAGE_SIZE = 20 * 1024; // 20 KB — en-dessous c'est un logo de signature

// OLE Compound Document magic bytes : D0 CF 11 E0 A1 B1 1A E1
const isOleCompoundDoc = (bytes) => {
    if (!bytes || bytes.length < 8) return false;
    return bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0;
};

/**
 * Détecte si une pièce jointe est un email imbriqué (sous-mail).
 * Vérifie : extension .msg, attachMethod === 5 (OLE embedded), ou magic bytes OLE.
 */
const isEmbeddedMsg = (att, ext, contentBytes) => {
    // 1. Extension explicite
    if (ext === 'msg') return true;
    // 2. attachMethod === 5 (ATTACH_EMBEDDED_MSG dans la spec MAPI)
    if (att.attachMethod === 5) return true;
    // 3. MIME type explicite
    const attMime = (att.mimeType || att.contentType || '').toLowerCase();
    if (attMime.includes('ms-outlook') || attMime.includes('rfc822')) return true;
    // 4. OLE magic bytes dans le contenu
    if (contentBytes && isOleCompoundDoc(contentBytes)) return true;
    return false;
};

let _inlineImageCounter = 0; // Compteur global pour nommer les images inline sans nom

/**
 * Fonction interne récursive qui opère sur un ArrayBuffer brut.
 * Retourne { files: File[], nestedTexts: string[] }
 */
const _extractMsgRecursive = (rawBuffer, parentName = 'email', depth = 0) => {
    const result = { files: [], nestedTexts: [] };
    const prefix = `[${'  '.repeat(depth)}MSG Parser depth:${depth}]`;

    console.log(`${prefix} 📧 Entrée dans MSG "${parentName}" (profondeur: ${depth})`);

    if (depth > 5) {
        console.warn(`${prefix} ⛔ Profondeur max (5) atteinte, arrêt récursion.`);
        return result;
    }

    let msgReader, fileData;
    try {
        msgReader = new MsgReader(rawBuffer);
        fileData = msgReader.getFileData();
    } catch (e) {
        console.warn(`${prefix} ❌ Impossible de parser le MSG "${parentName}":`, e);
        return result;
    }

    console.log(`${prefix} ✅ MSG parsé : sujet="${fileData.subject || '(vide)'}", expéditeur="${fileData.senderName || '(vide)'}"`);

    // Extraire le texte du mail courant (pour les niveaux imbriqués uniquement)
    if (depth > 0) {
        const parts = [];
        if (fileData.subject) parts.push(`[Email imbriqué niv.${depth}] Sujet: ${fileData.subject}`);
        if (fileData.senderName) parts.push(`De: ${fileData.senderName}`);
        if (fileData.body) parts.push(fileData.body);
        if (parts.length > 0) result.nestedTexts.push(parts.join('\n'));
    }

    if (!fileData.attachments || fileData.attachments.length === 0) {
        console.log(`${prefix} 📭 Aucune pièce jointe trouvée dans ce MSG.`);
        return result;
    }

    console.log(`${prefix} 📎 ${fileData.attachments.length} pièce(s) jointe(s) trouvée(s) :`);
    
    // Log détaillé de TOUTES les PJ brutes avant traitement
    fileData.attachments.forEach((att, idx) => {
        const name = att.fileName || att.name || '(SANS NOM)';
        const method = att.attachMethod !== undefined ? att.attachMethod : '?';
        const cid = att.pidContentId || att.contentId || '';
        const mime = att.mimeType || att.contentType || '';
        console.log(`${prefix}   #${idx}: nom="${name}" | method=${method} | CID="${cid}" | mime="${mime}"`);
    });

    for (let i = 0; i < fileData.attachments.length; i++) {
        const att = fileData.attachments[i];
        let attName = att.fileName || att.name || '';
        const ext = attName ? attName.split('.').pop().toLowerCase() : '';

        // Ignorer les formats bureautiques non supportés
        if (['doc', 'docx', 'xls', 'xlsx'].includes(ext)) {
            console.log(`${prefix}   #${i} ❌ Rejeté (format bureautique non supporté) : "${attName}"`);
            continue;
        }

        let attData;
        try {
            attData = msgReader.getAttachment(i);
        } catch (e) {
            console.warn(`${prefix}   #${i} ❌ Rejeté (impossible d'extraire le contenu) : "${attName}"`, e);
            continue;
        }

        if (!attData || !attData.content) {
            console.log(`${prefix}   #${i} ❌ Rejeté (contenu vide/null) : "${attName}"`);
            continue;
        }

        const contentBytes = new Uint8Array(attData.content);
        const sizeKB = (contentBytes.byteLength / 1024).toFixed(1);

        console.log(`${prefix}   #${i} 📦 Contenu extrait : ${sizeKB} KB, ${contentBytes.byteLength} bytes`);

        // --- Cas récursif : la PJ est un email imbriqué (OLE / .msg / attachMethod 5) ---
        if (isEmbeddedMsg(att, ext, contentBytes)) {
            console.log(`${prefix}   #${i} 📧➡️ SOUS-MAIL DÉTECTÉ (ext="${ext}", method=${att.attachMethod}, OLE=${isOleCompoundDoc(contentBytes)}) → Récursion...`);
            const nested = _extractMsgRecursive(attData.content, attName || `sous-mail_${i}`, depth + 1);
            console.log(`${prefix}   #${i} ↩️ Récursion terminée : ${nested.files.length} fichier(s) remontés, ${nested.nestedTexts.length} texte(s)`);
            result.files.push(...nested.files);
            result.nestedTexts.push(...nested.nestedTexts);
            continue;
        }

        // --- Déterminer le MIME et le type ---
        const mime = getMimeType(attName || 'unknown.bin');
        const isImage = mime.startsWith('image/');
        const isPdf = mime === 'application/pdf';

        // --- Gestion des PJ sans nom ---
        if (!attName || attName === '' || attName.startsWith('attachment_')) {
            if (isImage || (contentBytes.byteLength > MIN_INLINE_IMAGE_SIZE)) {
                // Générer un nom par défaut pour les images inline sans nom
                _inlineImageCounter++;
                const guessedExt = mime.split('/')[1] || 'png';
                attName = `image_inline_${_inlineImageCounter}.${guessedExt}`;
                console.log(`${prefix}   #${i} 🏷️ Nom généré pour image sans nom : "${attName}" (${sizeKB} KB)`);
            } else {
                console.log(`${prefix}   #${i} ❌ Rejeté (pas de nom, pas une image, ou trop petit) : taille=${sizeKB}KB, mime="${mime}"`);
                continue;
            }
        }

        if (!isPdf && !isImage) {
            console.log(`${prefix}   #${i} ❌ Rejeté (ni PDF ni image) : "${attName}", mime="${mime}"`);
            continue;
        }

        // --- Filtrage des micro-images inline (logos de signature < 20KB) ---
        if (isImage && contentBytes.byteLength < MIN_INLINE_IMAGE_SIZE) {
            const hasCid = att.pidContentId || att.contentId;
            const hasGenericName = /^image\d{3,}/i.test(attName) || attName.startsWith('image_inline_');
            if (hasCid || hasGenericName) {
                console.log(`${prefix}   #${i} 🚫 Rejeté (image inline < 20KB = logo/signature) : "${attName}" (${sizeKB} KB)`);
                continue;
            }
        }

        // --- Créer le File object à partir du buffer brut ---
        try {
            const blob = new Blob([contentBytes], { type: mime });
            const extractedFile = new File([blob], attName, { type: mime });
            result.files.push(extractedFile);
            console.log(`${prefix}   #${i} ✅ ACCEPTÉ : "${attName}" (${sizeKB} KB, ${mime})`);
        } catch (e) {
            console.warn(`${prefix}   #${i} ❌ Rejeté (échec création File) : "${attName}"`, e);
        }
    }

    console.log(`${prefix} 📊 Résultat final pour "${parentName}" : ${result.files.length} fichier(s), ${result.nestedTexts.length} texte(s) imbriqué(s)`);
    return result;
};

/**
 * Fonction publique exportée : accepte un File .msg, retourne { files: File[], nestedTexts: string[] }
 * Compatible avec tous les callers existants (Sidebar, processGlobalIngestion).
 */
export const extractValidAttachmentsFromMsg = async (msgFile, _depth = 0) => {
    _inlineImageCounter = 0; // Reset compteur à chaque appel top-level
    try {
        const arrayBuffer = await msgFile.arrayBuffer();
        return _extractMsgRecursive(arrayBuffer, msgFile.name || 'email.msg', _depth);
    } catch (e) {
        console.error(`[MSG Parser] ❌ Fatal error:`, e);
        return { files: [], nestedTexts: [] };
    }
};

// v5.5.12 - parseMsgFile délègue toute l'extraction à _extractMsgRecursive
const parseMsgFile = async (file) => {
    const arrayBuffer = await file.arrayBuffer();

    // Extraire le texte du mail principal
    let msgReader, fileData;
    try {
        msgReader = new MsgReader(arrayBuffer);
        fileData = msgReader.getFileData();
    } catch (e) {
        return { bodyText: '[Fichier MSG illisible]', attachments: [] };
    }

    const parts = [];
    if (fileData.subject) parts.push(`Sujet: ${fileData.subject}`);
    if (fileData.senderName) parts.push(`De: ${fileData.senderName}`);
    if (fileData.body) parts.push(fileData.body);

    // Extraction récursive (texte des sous-mails + PJ de tous les niveaux)
    const { files: attachments, nestedTexts } = _extractMsgRecursive(arrayBuffer, file.name, 0);

    // Fusionner le texte principal + texte des sous-mails
    // Exclure le texte du niveau 0 (déjà dans parts) car _extractMsgRecursive ne l'ajoute pas pour depth=0
    const bodyText = [...parts, ...nestedTexts].join('\n');

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

// v5.5.10 - Normalise une date brute (DD/MM/YYYY, MM/YYYY, etc.) vers YYYY-MM-DD pour <input type="date">
const normalizeDate = (raw) => {
    if (!raw || typeof raw !== 'string') return '';
    const s = raw.trim();
    
    // Déjà au bon format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    
    // DD/MM/YYYY ou DD-MM-YYYY
    let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    
    // MM/YYYY (ex: "06/2026") → 1er du mois
    m = s.match(/^(\d{1,2})[\/\-.](\d{4})$/);
    if (m) return `${m[2]}-${m[1].padStart(2,'0')}-01`;
    
    // YYYY/MM/DD
    m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    
    // Fallback: retourner tel quel
    return s;
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
                model: "gpt-4o-mini",
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
 * Compare une nouvelle donnée brute (note, mail copié-collé, observation terrain)
 * à la cause existante et décide intelligemment quoi en faire :
 * - Rien de pertinent → retourne la cause inchangée
 * - Affine/précise → fusionne intelligemment
 * - Contredit → mentionne le constat initial ET la contradiction
 * 
 * @param {string} existingCause - Le texte actuel de la cause
 * @param {string} newInput - Le nouveau texte brut (note, email, observation)
 * @param {string|null} providedApiKey - Clé API
 * @returns {Promise<{success: boolean, cause?: string, changed?: boolean, error?: string}>}
 */
export const refineCauseWithInput = async (existingCause, newInput, providedApiKey = null) => {
    if (!newInput || newInput.trim() === '') {
        return { success: true, cause: existingCause || '', changed: false };
    }

    // Si pas de cause existante, le nouveau texte DEVIENT la cause brute
    if (!existingCause || existingCause.trim() === '') {
        return { success: true, cause: newInput.trim(), changed: true };
    }

    const apiKey = providedApiKey || import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
        // Fallback sans IA : simple concaténation
        return { success: true, cause: existingCause + '\n\n' + newInput.trim(), changed: true };
    }

    try {
        const systemPrompt = `Tu es un agent d'affinage de dossier d'expertise sinistre. Tu travailles sur le champ "Cause et description du sinistre" d'un rapport.

CONTEXTE :
Un gestionnaire de dossier reçoit des informations au fil de l'eau (emails, notes de terrain, rapports, appels téléphoniques). Chaque nouvelle information doit être comparée à la cause existante pour décider si et comment elle la modifie.

VOICI LA CAUSE ACTUELLEMENT RÉDIGÉE :
"""
${existingCause.trim()}
"""

VOICI LA NOUVELLE INFORMATION REÇUE :
"""
${newInput.trim()}
"""

RÈGLES DE DÉCISION (applique-les dans cet ordre) :

1. FILTRAGE : Si la nouvelle information ne contient RIEN de pertinent pour la cause du sinistre (formules de politesse, rendez-vous, questions administratives, signatures, logos, disclaimers email, discussions de planning), tu DOIS renvoyer la cause EXACTEMENT telle quelle, sans aucune modification. Champ "changed" = false.

2. AFFINAGE ET RÉÉCRITURE GLOBALE : Si la nouvelle information apporte des précisions, RÉÉCRIS COMPLÈTEMENT le texte de la cause pour intégrer ces nouvelles données. Le résultat doit se lire de manière fluide, comme si tu avais eu toutes les informations dès le départ. Ne te contente PAS d'ajouter une phrase à la fin. Fusionne les idées. Champ "changed" = true.

3. CONTRADICTION : Si la nouvelle information CONTREDIT la cause existante, réécris le texte pour exposer la situation de manière chronologique ou logique (ex: "Initialement, le sinistre semblait causé par X. Cependant, un rapport ultérieur de Y a démontré que..."). Le texte final doit être un seul bloc narratif cohérent. Champ "changed" = true.

4. ACCUMULATION PURE : Tu ne supprimes JAMAIS d'informations valides de la cause existante. Tu es un accumulateur et affineur, pas un remplaçant.

5. STYLE : Garde un ton technique, professionnel, factuel. Pas d'introduction, pas de conclusion. Juste les faits.

6. ANTI-HALLUCINATION : NE JAMAIS inventer de dates. Si aucune date (ex: "le 1er mars 2023", "en mai", etc.) n'est explicitement fournie, n'en ajoute absolument aucune. Ne présume rien.

RENVOIE STRICTEMENT un objet JSON valide :
{
  "cause": "Le texte de la cause (identique si rien de pertinent, ou affiné/complété)",
  "changed": true ou false
}`;

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Analyse la nouvelle information et affine la cause si nécessaire." }
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

/**
 * [v5.5.11] Étape 1 : Le Routeur (Triage Multi-Catégories)
 * Classe un ensemble de documents dans 1 ou PLUSIEURS catégories : ADMIN, SOCIAL, RECITS, FINANCIER.
 * Un document mixte (ex: email contenant des noms ET un récit) peut être classé dans ["SOCIAL", "RECITS"].
 * Utilise gpt-4o-mini pour analyser rapidement un extrait ou les 3 premières pages.
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
        const contentArray = [{ type: "text", text: "Voici les documents à classifier." }];
        
        for (const item of fileArray) {
            const fileName = item.name || 'document_sans_nom';
            contentArray.push({ type: "text", text: `\n\n[DÉBUT DOCUMENT : ${fileName}]\n` });
            
            if (typeof item === 'string') {
                 // v5.5.11 - Limite augmentée à 15000 caractères pour le texte brut
                 contentArray.push({ type: "text", text: item.substring(0, 15000) });
            } else {
                const fileNameLower = fileName.toLowerCase();
                if (fileNameLower.endsWith('.msg')) {
                    try {
                        const { bodyText } = await parseMsgFile(item);
                        // v5.5.11 - Limite augmentée de 1500 à 15000 caractères
                        contentArray.push({ type: "text", text: bodyText.substring(0, 15000) });
                    } catch (e) {
                        contentArray.push({ type: "text", text: "[Fichier MSG illisible]" });
                    }
                } else if (item.type === 'application/pdf') {
                    // v5.5.11 - Lecture des 3 premières pages pour une classification plus précise
                    const base64Images = await pdfToBase64Images(item, 3);
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
        
        // v5.5.11 - Normaliser : si l'IA renvoie un string au lieu d'un tableau, le convertir
        for (const key of Object.keys(parsedData)) {
            if (typeof parsedData[key] === 'string') {
                parsedData[key] = [parsedData[key]];
            }
        }
        
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
                    numConditionsGenerales: "CG-2022", franchise: "Légale", pertesIndirectes: "10%", isAxa: true,
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

CONTEXTE IMPORTANT :
- "Bureau Péchard" est le bureau de gestion de sinistres / courtier en charge du dossier. Ce n'est PAS un bureau d'expertise externe. Si le document ne mentionne pas d'autre bureau, utilise "Bureau Péchard" comme valeur par défaut.

RÈGLES ABSOLUES :
1. N'invente AUCUNE information. Si l'information n'est pas explicitement présente dans le document, renvoie une chaîne vide "".
2. Remplis les champs avec précision.
3. Si la compagnie d'assurance (nomCie) est "AXA", ou une de ses filiales, tu DOIS ABSOLUMENT mettre le booléen "isAxa" à true. Sinon false.
4. "pertesIndirectes" doit être un pourcentage (ex: "10%") ou "" si non trouvé.
5. FRANCHISE - Tu dois extraire DEUX informations distinctes :
   a) "franchiseBrute" : le montant ou texte brut de la franchise tel qu'il apparaît dans le document (ex: "250", "600€", "indice 119", "franchise anglaise de 500€", "franchise x3").
   b) "typeFranchise" : déduis le TYPE de franchise selon ces règles :
      - "Legale" si le montant est inférieur à 400€ OU s'il y a une référence à un indice IPC/abex (ex: "indice 119", "franchise légale").
      - "Speciale" si c'est un gros forfait (600€, 1000€, etc.) OU un multiplicateur ("franchise x3", "triple franchise").
      - "Anglaise" si le texte mentionne "franchise anglaise" ou "english deductible".
      - "" si aucune franchise n'est mentionnée.
6. Tu dois renvoyer STRICTEMENT et UNIQUEMENT un objet JSON valide, sans aucune introduction, sans formatage markdown additionnel autre que le JSON.
7. ANTI-HALLUCINATION refPechard : Le champ \"refPechard\" est la référence INTERNE du dossier au Bureau Péchard. Si tu ne trouves PAS cette référence exacte explicitement dans les documents, renvoie IMPÉRATIVEMENT une chaîne vide \"\". N'invente AUCUN numéro et ne confonds pas avec les numéros de police, de sinistre ou d'autres références.

Voici le format EXACT attendu, avec tous les champs présents :
{
  "formData": {
    "dateExp": "", "heureExp": "", "nomResidence": "", "adresse": "", "refPechard": "", "expertInfos": "", "bureau": "Bureau Péchard",
    "dateSinistre": "", "dateDeclaration": "", "declarant": "", "nomCie": "", "nomContrat": "", "numPolice": "", "numSinistreCie": "", 
    "numConditionsGenerales": "", "franchiseBrute": "", "typeFranchise": "", "pertesIndirectes": "", "isAxa": false,
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
        
        // v5.5.10 - Normaliser les dates au format YYYY-MM-DD (requis par <input type="date">)
        if (parsedData.formData) {
            const dateFields = ['dateExp', 'dateSinistre', 'dateDeclaration'];
            dateFields.forEach(field => {
                const val = parsedData.formData[field];
                if (val && typeof val === 'string' && val.trim() !== '') {
                    parsedData.formData[field] = normalizeDate(val);
                }
            });

            // v5.5.15 - Post-traitement ROBUSTE de la franchise (try-catch pour éviter les crashs silencieux)
            try {
                const typeFranchise = (parsedData.formData.typeFranchise || '').trim();
                const franchiseBrute = (parsedData.formData.franchiseBrute || '').trim();
                
                if (typeFranchise && franchiseBrute) {
                    if (typeFranchise === 'Legale') {
                        // v5.5.15 - Résolution de la franchise légale via la dateSinistre
                        const dateSinistre = parsedData.formData.dateSinistre;
                        if (dateSinistre && dateSinistre.trim() !== '') {
                            // Tenter de résoudre via la table IPC/ABEX intégrée
                            const resolved = _resolveFranchiseLegale(dateSinistre);
                            if (resolved !== null) {
                                parsedData.formData.franchise = `${resolved}€`;
                                console.log(`[aiManager] 🏛️ Franchise légale résolue : ${resolved}€ (date: ${dateSinistre})`);
                            } else {
                                // Date trouvée mais pas dans l'index → marquer comme légale pour résolution manuelle
                                parsedData.formData.franchise = 'Légale';
                                console.log(`[aiManager] 🏛️ Franchise légale détectée mais date hors index (${dateSinistre}). Résolution manuelle requise.`);
                            }
                        } else {
                            parsedData.formData.franchise = '⚠️ À calculer (Date de sinistre requise)';
                            console.warn(`[aiManager] ⚠️ Franchise légale détectée mais dateSinistre absente !`);
                        }
                    } else if (typeFranchise === 'Speciale') {
                        const montantMatch = franchiseBrute.match(/[\d.,]+/);
                        const montantStr = montantMatch ? montantMatch[0].replace(',', '.') : franchiseBrute;
                        parsedData.formData.franchise = `Spéciale : ${montantStr}€`;
                        console.log(`[aiManager] ⚠️ Franchise spéciale : ${parsedData.formData.franchise}`);
                    } else if (typeFranchise === 'Anglaise') {
                        const montantMatch = franchiseBrute.match(/[\d.,]+/);
                        const montantStr = montantMatch ? montantMatch[0].replace(',', '.') : franchiseBrute;
                        parsedData.formData.franchise = `${montantStr}€ Anglaise`;
                        console.log(`[aiManager] 🇬🇧 Franchise anglaise : ${parsedData.formData.franchise}`);
                    } else {
                        parsedData.formData.franchise = franchiseBrute;
                    }
                } else if (franchiseBrute && !typeFranchise) {
                    parsedData.formData.franchise = franchiseBrute;
                } else {
                    // Aucune franchise détectée — on ne met rien
                    parsedData.formData.franchise = parsedData.formData.franchise || '';
                }
            } catch (franchiseErr) {
                console.error('[aiManager] ❌ Erreur dans le post-traitement franchise (non bloquante):', franchiseErr);
                // Fallback : conserver la valeur brute ou vide
                parsedData.formData.franchise = parsedData.formData.franchiseBrute || parsedData.formData.franchise || '';
            }
            
            // Nettoyage : supprimer les champs intermédiaires (l'UI n'utilise que "franchise")
            delete parsedData.formData.franchiseBrute;
            delete parsedData.formData.typeFranchise;
        }
        
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
                }],
                intervenants: [{
                    id: crypto.randomUUID(), nom: "Plombier Mock", prenom: "Pierre", role: "Plombier", societe: "ABC Plomberie", email: "", tel: "0470 00 00 00"
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
Ton rôle est de lire ces documents (emails de syndics, tableaux de contacts, baux de location) et d'identifier TOUTES les personnes mentionnées.

MÉTHODE DE TRAVAIL (Chain of Thought) :
Avant de formater le JSON, réfléchis en suivant ces étapes :
1. Liste mentalement TOUTES les personnes physiques et morales mentionnées dans les documents.
2. Pour chaque personne, détermine son RÔLE exact : est-ce un occupant du bien (locataire, propriétaire) ou un intervenant extérieur (plombier, syndic, courtier, expert, proche, etc.) ?
3. Pour les propriétaires : est-il EXPLICITEMENT dit qu'il occupe le bien ("propriétaire occupant", "habite sur place") ou qu'il ne l'occupe pas ("propriétaire bailleur", "ne réside pas") ? Si rien n'est précisé, utilise "Propriétaire (occupation inconnue)".
4. Classe chaque personne dans le bon tableau (occupants OU intervenants) puis formate le JSON.

RÈGLES ABSOLUES :
1. N'invente AUCUNE information. Si l'information n'est pas présente, renvoie une chaîne vide "" ou false pour les booléens.
2. Le champ "statut" de chaque occupant DOIT IMPÉRATIVEMENT être l'une de ces 5 valeurs EXACTES :
   - "Locataire"
   - "Propriétaire occupant"
   - "Propriétaire non occupant"
   - "Propriétaire (occupation inconnue)" ← SI le document dit juste "propriétaire" sans préciser s'il habite sur place
   - "ACP" ← Pour l'Association des Copropriétaires
3. SÉPARATION STRICTE DES TABLEAUX : Les tableaux "occupants", "intervenants" et "experts" sont MUTUELLEMENT EXCLUSIFS. 
   - Une personne ne peut exister QUE DANS UN SEUL tableau.
   - Si une personne est propriétaire, locataire ou ACP, elle va dans "occupants" et NE DOIT ABSOLUMENT PAS se retrouver dans "intervenants".
   - TOUTE autre personne (syndic, plombier, courtier, proche, etc.) va dans "intervenants".
4. SÉPARATION STRICTE EXPERTS / INTERVENANTS : Distingue rigoureusement le tableau "experts" du tableau "intervenants".
   - Un "expert" est STRICTEMENT un expert interne de compagnie d'assurance ou un membre d'un bureau d'expertise reconnu (ex: CED, Dekra, Ebex, Lexa, Aube Immo, Mosa).
   - Les entreprises de recherche de fuite (Visiotherm, Verdetec, Polygon), les artisans, courtiers, plombiers, syndics NE SONT ABSOLUMENT PAS des experts et doivent aller dans "intervenants".
5. EXCLUSION ABSOLUE : Le Bureau Péchard (ou Bureau Yves Péchard) et ses employés NE SONT JAMAIS des experts ni des intervenants. C'est le bureau de gestion mandaté. Tu dois impérativement les IGNORER et les EXCLURE de tous les tableaux (experts, occupants, intervenants).
6. Tu dois renvoyer STRICTEMENT et UNIQUEMENT un objet JSON valide, sans aucune introduction, sans formatage markdown additionnel autre que le JSON.

Voici le format EXACT attendu, avec tous les champs présents :
{
  "experts": [ { "nom": "", "tel": "" } ],
  "occupants": [
    {
      "nom": "", "prenom": "", "etage": "", "statut": "Locataire", "tel": "", "email": "",
      "rc": false, "rcPolice": "", "secAssurance": false, "secCie": "", "secPolice": "", "secType": "", "contreExpert": false
    }
  ],
  "intervenants": [
    {
      "nom": "", "prenom": "", "role": "", "societe": "", "email": "", "tel": ""
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

        // v5.6.0 - Ajout UUID pour chaque intervenant
        if (parsedData.intervenants && Array.isArray(parsedData.intervenants)) {
            parsedData.intervenants = parsedData.intervenants.map(inter => ({
                ...inter,
                id: crypto.randomUUID()
            }));
        } else {
            parsedData.intervenants = [];
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
export const extractNarrativeData = async (files, providedApiKey = null, onStatusChange = null, model = 'gpt-4o', existingCause = '') => {
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
                divers: "Présence de moisissures constatée. Locataire coopératif."
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

        // v5.6.3 - Prompt incrémental : l'IA accumule les faits au lieu d'écraser
        const existingCauseBlock = existingCause && existingCause.trim()
            ? `\n\nCONTEXTE EXISTANT :\nVoici la cause actuelle rédigée jusqu'ici :\n"""\n${existingCause.trim()}\n"""\n\nRÈGLES D'ACCUMULATION :\n1. Si les nouveaux documents ne contiennent AUCUNE information technique pertinente, renvoie la cause actuelle À L'IDENTIQUE dans le champ "cause".
2. Si les documents apportent des précisions, INTÈGRE-LES de manière fluide dans la cause existante sans détruire l'information précédente.
3. Si les documents CONTREDISENT la cause actuelle, CONSERVE le constat initial ET fais état de la contradiction (ex: "Cependant, un second rapport de [intervenant] indique que...").
4. Tu es un ACCUMULATEUR DE FAITS : tu ne supprimes JAMAIS d'informations valides.`
            : '';

        const systemPrompt = `Tu es un Agent Rédacteur spécialisé dans les expertises sinistres.
Ton rôle est d'analyser des documents narratifs (rapports de recherche de fuite, constats pompiers, emails circonstanciés, chronologies) et de rédiger une analyse structurée.

RÈGLES ABSOLUES :
1. Rédige une analyse concise et professionnelle. Ne fais pas d'introduction.
2. Si UN SEUL rapport est fourni, rédige un texte unique répondant aux 4 points ci-dessous.
3. Si PLUSIEURS rapports/avis sont fournis, sépare OBLIGATOIREMENT ton analyse avec des sauts de ligne et le nom de l'intervenant (ex: "Rapport 1 (Entreprise Dubois) :\n...").
4. Tu dois extraire et répondre UNIQUEMENT à ces 4 questions :
   a) Quelle est l'origine exacte et technique du sinistre (la cause matérielle) ?
   b) Où est-elle localisée avec précision ?
   c) Quelles sont les conséquences matérielles directes constatées ?
   d) Quelles sont les réparations conservatoires ou définitives préconisées par le technicien ?
5. Si un champ ne peut pas être rempli grâce aux documents fournis, renvoie une chaîne vide "".
6. ANTI-HALLUCINATION : NE JAMAIS inventer de dates. Si aucune date (jour, mois, année) n'est explicitement fournie dans les documents analysés, tu ne dois en inventer aucune sous aucun prétexte.
7. Tu dois renvoyer STRICTEMENT et UNIQUEMENT un objet JSON valide, sans aucune introduction, ni markdown.
${existingCauseBlock}

Voici le format EXACT attendu :
{
  "cause": "Synthèse technique structurée répondant aux 4 points : origine, localisation, conséquences, réparations préconisées.",
  "divers": "Remarques diverses, points d'attention particuliers, ou informations qui ne rentrent pas dans la cause."
}`;

        const payload = {
            model: model, // gpt-4o recommandé pour la rédaction et la synthèse de texte
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: contentArray }
            ],
            response_format: { type: "json_object" },
            temperature: 0.0 // 0.0 obligatoire pour éviter toute hallucination (surtout de dates)
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

        // v5.5.11 - Dispatch multi-catégories : un fichier peut aller dans PLUSIEURS agents
        for (const file of filesToRoute) {
            const fileName = file.name || 'document_sans_nom';
            const categories = routeMap[fileName] || ['ADMIN'];
            // categories est un tableau (ex: ["SOCIAL", "RECITS"])
            const cats = Array.isArray(categories) ? categories : [categories];
            
            for (const cat of cats) {
                if (cat === 'ADMIN') adminFiles.push(file);
                else if (cat === 'SOCIAL') socialFiles.push(file);
                else if (cat === 'RECITS') narrativeFiles.push(file);
                else if (cat === 'FINANCIER') financialFiles.push(file);
            }
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
            : Promise.resolve({ success: true, data: { occupants: [], experts: [], intervenants: [] } });

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
                divers: narrativeRes.data?.divers || ""
            },
            references: adminRes.data?.references || [],
            experts: socialRes.data?.experts || [],
            occupants: occupants,
            intervenants: socialRes.data?.intervenants || [],
            expenses: financialRes.data?.expenses || []
        };

        if (onStatusChange) onStatusChange('attaching'); // Fini
        
        return { success: true, data: finalJson, extractedFiles: allExtractedFiles };

    } catch (error) {
        console.error("[aiManager] processGlobalIngestion error:", error);
        return { success: false, error: error.message || "Erreur lors de l'ingestion globale." };
    }
};
