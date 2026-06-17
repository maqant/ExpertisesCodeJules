// v7.5.2 - Robust file utilities
const PDF_EXT = /\.pdf$/i;

/**
 * isPdf
 * Fast synchronous check using MIME type and file extension.
 * @param {File} file 
 * @returns {boolean}
 */
export const isPdf = (file) => {
    if (!file) return false;
    return file.type === 'application/pdf' || (typeof file.name === 'string' && PDF_EXT.test(file.name));
};

/**
 * isPdfDeep
 * Fallback asynchronous check using magic bytes (PDF header) if the fast check fails.
 * Outlook dragged files sometimes lack MIME type and extension.
 * @param {File} file 
 * @returns {Promise<boolean>}
 */
export async function isPdfDeep(file) {
    if (!file) return false;
    if (isPdf(file)) return true;
    
    try {
        const head = await file.slice(0, 4).arrayBuffer();
        const b = new Uint8Array(head);
        return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; // %PDF
    } catch (err) {
        console.warn("[isPdfDeep] Erreur de lecture des magic bytes:", err);
        return false;
    }
}
