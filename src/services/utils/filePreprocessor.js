import { isPdfDeep } from './fileUtils.js';
import { convertTextToPdfBytes } from './pdfConverter.js';

// Fonction utilitaire pour lire les premiers octets
const readMagicBytes = async (file, byteCount = 4) => {
    const slice = file.slice(0, byteCount);
    const buffer = await slice.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
};

/**
 * processIngestedFile
 * Prend un fichier (File ou objet custom) en entrée.
 * S'il s'agit d'un format bureautique (docx, rtf, xlsx, edi), le convertit en PDF à la volée.
 * Rejette les anciens formats binaires (.doc, .xls).
 * @param {File | object} file 
 * @returns {Promise<File | object>}
 */
export const processIngestedFile = async (file) => {
    if (!file) return file;
    const name = file.name || '';
    const nameLower = name.toLowerCase();

    // Détection du vrai type via les Magic Bytes
    const magic = await readMagicBytes(file, 4);

    // 1. PDF natif : Si c'est un vrai PDF, on garantit l'extension et on bypass
    if (magic === '25 50 44 46') { // %PDF
        if (!nameLower.endsWith('.pdf')) {
            console.log(`[filePreprocessor] ${name} est détecté comme un vrai PDF (malgré son extension)`);
            try {
                const buffer = await file.arrayBuffer();
                return new File([buffer], name + '.pdf', { type: 'application/pdf' });
            } catch(e) {
                return file;
            }
        }
        return file;
    }

    // 2. Ancien format OLE2 (.doc, .xls) : BLOQUER (sauf .msg)
    if (magic === 'D0 CF 11 E0' && !nameLower.endsWith('.msg')) {
        throw new Error(`Les formats bureautiques (Word, Excel) ne sont pas pris en charge. Veuillez enregistrer le fichier en PDF depuis votre logiciel avant de l'importer.`);
    }

    // 3. Nouveaux formats ZIP (.docx, .xlsx) : BLOQUER
    if (magic.startsWith('50 4B 03 04')) { // PK..
        if (nameLower.endsWith('.docx') || nameLower.endsWith('.xlsx')) {
            throw new Error(`Les formats bureautiques (.docx, .xlsx) ne sont pas pris en charge. Veuillez enregistrer le fichier en PDF depuis votre logiciel avant de l'importer.`);
        }
    }

    // 4. Format RTF : BLOQUER
    if (magic === '7B 5C 72 74') { // {\rt
        throw new Error(`Le format RTF n'est pas pris en charge. Ouvrez votre fichier dans Word et utilisez « Enregistrer sous → PDF », puis réimportez-le ici.`);
    }

    // 5. Texte brut ou EDI (fallback text)
    if (nameLower.endsWith('.edi') || nameLower.endsWith('.txt')) {
        console.log(`[filePreprocessor] Conversion de ${name} (Texte/EDI) en PDF...`);
        try {
            const pdfBytes = await convertTextToPdfBytes(file);
            return new File([pdfBytes], name.replace(/\.(edi|txt)$/i, '.pdf'), { type: 'application/pdf' });
        } catch (e) {
            console.error(`[filePreprocessor] Échec conversion texte: ${name}`, e);
            return file;
        }
    }

    // 6. Autres (images, msg) passés tels quels
    return file;
};
