import { isPdfDeep } from './fileUtils.js';
import { convertDocxToPdfBytes, convertTextToPdfBytes } from './pdfConverter.js';

/**
 * processIngestedFile
 * Prend un fichier (File ou objet custom) en entrée.
 * S'il s'agit d'un .docx ou d'un .edi (non-pdf), le convertit en PDF à la volée.
 * Renvoie un objet File (ou un objet similaire) qui est garanti d'être un PDF si c'était un docx/edi.
 * @param {File | object} file 
 * @returns {Promise<File | object>}
 */
export const processIngestedFile = async (file) => {
    if (!file) return file;
    const name = file.name || '';
    const nameLower = name.toLowerCase();

    // Si le fichier s'appelle .edi mais qu'en fait c'est un vrai PDF (magic bytes)
    // On ne le convertit pas, on change juste son extension/type pour que le reste de l'app le comprenne.
    if (nameLower.endsWith('.edi') && await isPdfDeep(file)) {
        console.log(`[filePreprocessor] ${name} est détecté comme un vrai PDF (malgré l'extension .edi)`);
        // On retourne un clone du File avec le bon type
        try {
            const buffer = await file.arrayBuffer();
            return new File([buffer], name.replace(/\\.edi$/i, '.pdf'), { type: 'application/pdf' });
        } catch(e) {
            return file;
        }
    }

    // Conversion DOCX -> PDF
    if (nameLower.endsWith('.docx')) {
        console.log(`[filePreprocessor] Conversion de ${name} (DOCX) en PDF fantôme...`);
        try {
            const pdfBytes = await convertDocxToPdfBytes(file);
            return new File([pdfBytes], name.replace(/\\.docx$/i, '.pdf'), { type: 'application/pdf' });
        } catch (e) {
            console.error(`[filePreprocessor] Échec conversion DOCX: ${name}`, e);
            // Retourner tel quel en cas d'erreur
            return file;
        }
    }

    // Conversion EDI (texte) -> PDF
    if (nameLower.endsWith('.edi')) {
        console.log(`[filePreprocessor] Conversion de ${name} (EDI texte) en PDF fantôme...`);
        try {
            const pdfBytes = await convertTextToPdfBytes(file);
            return new File([pdfBytes], name.replace(/\\.edi$/i, '.pdf'), { type: 'application/pdf' });
        } catch (e) {
            console.error(`[filePreprocessor] Échec conversion EDI: ${name}`, e);
            return file;
        }
    }

    // Aucun traitement nécessaire
    return file;
};
