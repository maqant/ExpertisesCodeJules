// v5.9.2 - Modularisation aiManager
/**
 * msgUtils.js
 * Utilitaires de parsing des fichiers .msg (Outlook) :
 * extraction récursive des pièces jointes, texte du mail, filtrage des logos.
 */

import MsgReader from '@kenjiuno/msgreader';

// Cache v5.7.2
const _msgCache = new Map();

// Utilitaire d'extraction du texte + pièces jointes d'un fichier .msg (Outlook)
const MIME_MAP = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', bmp: 'image/bmp', tiff: 'image/tiff', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', msg: 'application/vnd.ms-outlook' };
const getMimeType = (filename) => { const ext = (filename || '').split('.').pop().toLowerCase(); return MIME_MAP[ext] || 'application/octet-stream'; };

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
export const parseMsgFile = async (file) => {
    const cacheKey = file.name + "_" + file.size;
    if (_msgCache.has(cacheKey)) return _msgCache.get(cacheKey);

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

    const result = { bodyText, attachments };
    _msgCache.set(cacheKey, result);
    return result;
};
