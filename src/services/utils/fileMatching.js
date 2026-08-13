/**
 * fileMatching.js — Utilitaire de matching tolérant pour fichiers et frais
 * Normalise les noms de fichiers et tolère les divergences légères de saisie LLM / système.
 */

export const normalizeFileName = (name) => {
    if (!name || typeof name !== 'string') return '';
    return name
        .normalize('NFC')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/\(\d+\)/g, '') // Enlève les suffixes (1), (2)
        .trim();
};

export const isFileMatch = (fileNameA, fileNameB) => {
    if (!fileNameA || !fileNameB) return false;
    if (fileNameA === fileNameB) return true;
    
    const normA = normalizeFileName(fileNameA);
    const normB = normalizeFileName(fileNameB);
    
    if (!normA || !normB) return false;
    if (normA === normB) return true;
    
    // Inclusion si la chaîne est suffisamment longue (évite les faux positifs sur 2-3 lettres)
    if (normA.length >= 5 && normB.length >= 5) {
        if (normA.includes(normB) || normB.includes(normA)) return true;
    }
    
    return false;
};

export const findMatchingFileInList = (pendingFiles, targetName) => {
    if (!pendingFiles || !Array.isArray(pendingFiles) || !targetName) return null;
    return pendingFiles.find(f => isFileMatch(f.name, targetName)) || null;
};
