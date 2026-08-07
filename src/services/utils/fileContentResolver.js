/**
 * fileContentResolver.js
 * Point de vérité UNIQUE de la classification des fichiers pour l'ingestion IA.
 * Retourne une union discriminée — jamais de fallback silencieux.
 * Classification par CONTENU (magic bytes + analyse texte), l'extension n'est qu'un indice.
 */

export const FILE_KIND = Object.freeze({
    PDF: 'pdf',
    IMAGE: 'image',
    TEXT: 'text',
    REJECTED: 'rejected',
});

const MAX_TEXT_LENGTH = 300_000; // garde-fou tokens IA — erreur explicite, jamais de troncature silencieuse

const IMAGE_SIGNATURES = [
    { bytes: [0xFF, 0xD8, 0xFF], mime: 'image/jpeg' },
    { bytes: [0x89, 0x50, 0x4E, 0x47], mime: 'image/png' },
    { bytes: [0x47, 0x49, 0x46, 0x38], mime: 'image/gif' },
    { bytes: [0x42, 0x4D], mime: 'image/bmp' },
    { bytes: [0x49, 0x49, 0x2A, 0x00], mime: 'image/tiff' },
    { bytes: [0x4D, 0x4D, 0x00, 0x2A], mime: 'image/tiff' },
];

const matchesSignature = (bytes, sig) => sig.every((b, i) => bytes[i] === b);

const decodeText = (buffer) => {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
        return new TextDecoder('windows-1252').decode(buffer);
    }
};

/** Heuristique binaire : octets nuls ou trop de caractères de contrôle non imprimables. */
const looksLikeText = (text) => {
    if (text.indexOf('\0') !== -1) return false;
    const sample = text.slice(0, 8192);
    if (sample.length === 0) return false;
    let controlChars = 0;
    for (let i = 0; i < sample.length; i++) {
        const c = sample.charCodeAt(i);
        if (c < 32 && c !== 9 && c !== 10 && c !== 13 && c !== 12) controlChars++;
    }
    return (controlChars / sample.length) < 0.05;
};

/** Cherche un PDF brut (%PDF) embarqué dans le flux (cas EDI compagnies). */
const findEmbeddedRawPdf = (bytes) => {
    for (let i = 0; i < bytes.length - 4; i++) {
        if (bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46) {
            return bytes.slice(i);
        }
    }
    return null;
};

/** Cherche un PDF encodé Base64 ("JVBERi0") embarqué dans le texte. */
const findEmbeddedBase64Pdf = (text) => {
    const b64Index = text.indexOf('JVBERi0');
    if (b64Index === -1) return null;
    const validB64 = /^[A-Za-z0-9+/=]$/;
    let endIdx = b64Index;
    while (endIdx < text.length && (validB64.test(text[endIdx]) || text[endIdx] === '\r' || text[endIdx] === '\n' || text[endIdx] === ' ')) {
        endIdx++;
    }
    const b64String = text.slice(b64Index, endIdx).replace(/\s/g, '');
    try {
        const binaryString = atob(b64String);
        const pdfBytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) pdfBytes[i] = binaryString.charCodeAt(i);
        return pdfBytes;
    } catch (e) {
        console.warn('[fileContentResolver] Base64 PDF détecté mais invalide — poursuite en mode texte.', e);
        return null;
    }
};

/**
 * Classifie un fichier pour l'ingestion IA.
 * @param {File|Blob} rawFile
 * @returns {Promise<
 *   | { kind: 'pdf', file: File }
 *   | { kind: 'image', file: File|Blob }
 *   | { kind: 'text', text: string, sourceName: string }
 *   | { kind: 'rejected', reason: string }
 * >}
 */
export async function resolveFileForAi(rawFile) {
    if (!rawFile || typeof rawFile.arrayBuffer !== 'function') {
        return { kind: FILE_KIND.REJECTED, reason: "Fichier invalide ou non binaire." };
    }

    const sourceName = rawFile.name || 'document';
    const nameLower = sourceName.toLowerCase();

    try {
        const buffer = await rawFile.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        // 1. PDF natif via Magic Bytes (%PDF)
        if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
            const pdfFile = nameLower.endsWith('.pdf')
                ? rawFile
                : new File([buffer], sourceName + '.pdf', { type: 'application/pdf' });
            return { kind: FILE_KIND.PDF, file: pdfFile };
        }

        // 2. Images via Magic Bytes
        for (const sig of IMAGE_SIGNATURES) {
            if (bytes.length >= sig.bytes.length && matchesSignature(bytes, sig.bytes)) {
                return { kind: FILE_KIND.IMAGE, file: rawFile };
            }
        }

        // 3. Rejet explicite des formats binaires non supportés (Word/Excel OLE2, RTF, ZIP non-pdf)
        if (bytes.length >= 4 && bytes[0] === 0xD0 && bytes[1] === 0xCF && bytes[2] === 0x11 && bytes[3] === 0xE0 && !nameLower.endsWith('.msg')) {
            return { kind: FILE_KIND.REJECTED, reason: `Le format binaire .doc/.xls (${sourceName}) n'est pas supporté. Veuillez le convertir en PDF.` };
        }
        if (bytes.length >= 4 && bytes[0] === 0x7B && bytes[1] === 0x5C && bytes[2] === 0x72 && bytes[3] === 0x74) {
            return { kind: FILE_KIND.REJECTED, reason: `Le format RTF (${sourceName}) n'est pas supporté. Veuillez l'enregistrer en PDF.` };
        }
        if (nameLower.endsWith('.docx') || nameLower.endsWith('.xlsx')) {
            return { kind: FILE_KIND.REJECTED, reason: `Les fichiers .docx et .xlsx (${sourceName}) doivent être enregistrés au format PDF.` };
        }

        // 4. Recherche de PDF embarqué brut (cas des flux EDI contenant un PDF binaire)
        const embeddedRawPdf = findEmbeddedRawPdf(bytes);
        if (embeddedRawPdf) {
            console.info(`[fileContentResolver] PDF brut embarqué trouvé dans ${sourceName}`);
            const pdfFile = new File([embeddedRawPdf], sourceName.replace(/\.[^.]+$/, '') + '.pdf', { type: 'application/pdf' });
            return { kind: FILE_KIND.PDF, file: pdfFile };
        }

        // 5. Lecture comme texte (EDI, TXT, CSV, XML, etc.)
        const decodedText = decodeText(buffer);

        // Recherche d'un PDF Base64 embarqué dans le texte
        const embeddedB64Pdf = findEmbeddedBase64Pdf(decodedText);
        if (embeddedB64Pdf) {
            console.info(`[fileContentResolver] PDF Base64 embarqué trouvé dans ${sourceName}`);
            const pdfFile = new File([embeddedB64Pdf], sourceName.replace(/\.[^.]+$/, '') + '.pdf', { type: 'application/pdf' });
            return { kind: FILE_KIND.PDF, file: pdfFile };
        }

        // Si le contenu passe le test binaire -> c'est du TEXTE PUR (EDI, TXT, CSV, etc.)
        if (looksLikeText(decodedText)) {
            if (decodedText.length > MAX_TEXT_LENGTH) {
                return { kind: FILE_KIND.REJECTED, reason: `Le fichier texte ${sourceName} est trop volumineux (${decodedText.length} caractères).` };
            }
            return { kind: FILE_KIND.TEXT, text: decodedText, sourceName };
        }

        return { kind: FILE_KIND.REJECTED, reason: `Format de fichier non reconnu pour ${sourceName}. Veuillez fournir un PDF, une image ou un fichier texte/EDI.` };
    } catch (err) {
        console.error('[fileContentResolver] Échec d\'analyse du fichier :', err);
        return { kind: FILE_KIND.REJECTED, reason: `Erreur lors de la lecture de ${sourceName} : ${err.message}` };
    }
}
