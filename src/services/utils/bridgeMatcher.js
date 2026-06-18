// v5.9.4 - Smart Bridge (Bulletproof Matcher)

/**
 * Sanitize : met en minuscules et supprime TOUT sauf lettres et chiffres.
 * Ex: "0801-D56 671/01" → "0801d5667101"
 * @param {string} str 
 * @returns {string}
 */
const sanitize = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};

/**
 * Collecte agressive de tous les mots-clés pertinents d'un dossier.
 * Les données sont stockées sous dossier.data.formData (pas dossier.formData).
 * @param {Object} dossier 
 * @returns {string[]} Liste des mots-clés bruts (avant sanitize)
 */
const collectKeywords = (dossier) => {
    const raw = [];

    // Nom du dossier
    if (dossier.name) raw.push(dossier.name);

    // Les données vivent sous dossier.data.formData (structure de sauvegarde du contexte)
    const fd = dossier.data?.formData || dossier.formData;
    if (fd) {
        if (fd.refPechard)         raw.push(fd.refPechard);
        if (fd.numSinistreCie)     raw.push(fd.numSinistreCie);
        if (fd.numeroSinistreCie)  raw.push(fd.numeroSinistreCie);
        if (fd.numPolice)          raw.push(fd.numPolice);
        if (fd.nomResidence)       raw.push(fd.nomResidence);
    }

    // Références liées au dossier (peuvent être sous dossier.data.references)
    const refs = dossier.data?.references || dossier.references;
    if (Array.isArray(refs)) {
        refs.forEach(refObj => {
            if (refObj && refObj.ref) raw.push(refObj.ref);
            else if (typeof refObj === 'string') raw.push(refObj);
        });
    }

    return raw;
};

/**
 * Cherche un dossier correspondant au nom du fichier parmi les dossiers sauvegardés.
 * Utilise une logique bulletproof : sanitize des deux côtés + collecte large des clés.
 * @param {string} filename Le nom du fichier droppé
 * @param {Array} existingDossiers La liste des dossiers sauvegardés
 * @returns {Object|null} Le dossier matchant ou null
 */
export const findMatchingDossier = (filename, existingDossiers, fullPath = '') => {
    if (!filename || !existingDossiers || existingDossiers.length === 0) return null;

    const sanitizedFilename = sanitize(filename);
    const sanitizedPath = fullPath ? sanitize(fullPath) : '';
    console.log(`[Smart Bridge] Filename sanitisé : "${sanitizedFilename}"${fullPath ? ` (Path: ${sanitizedPath})` : ''}`);

    for (const dossier of existingDossiers) {
        const rawKeywords = collectKeywords(dossier);

        // Filtre : ignorer les clés vides ou trop courtes (< 4 caractères après sanitize)
        const keywords = rawKeywords
            .map(k => sanitize(k))
            .filter(k => k.length >= 4);

        console.log(`[Smart Bridge] Test du dossier: "${dossier.name}" avec les clés:`, keywords);

        for (const keyword of keywords) {
            if (sanitizedFilename.includes(keyword) || (sanitizedPath && sanitizedPath.includes(keyword))) {
                console.log(`[Smart Bridge] ✅ Match trouvé ! Dossier "${dossier.name}" via clé "${keyword}"`);
                return dossier;
            }
        }
    }

    console.log(`[Smart Bridge] ❌ Aucun match trouvé pour "${sanitizedFilename}"`);
    return null;
};
