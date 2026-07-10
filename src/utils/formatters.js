export const fmtOccName = (o) => {
    if (!o) return '';
    return o.nom ? (o.etage && o.etage.trim() !== '' ? `${o.etage} - ${o.nom}` : o.nom) : '';
};

export const findOccByCompteDe = (compteDe, occupants) => {
    if (!compteDe || !occupants) return null;
    return occupants.find(o => o.id === compteDe || fmtOccName(o) === compteDe);
};

export const getCompteDeName = (compteDe, occupants) => {
    const matchedOcc = findOccByCompteDe(compteDe, occupants);
    if (matchedOcc) return fmtOccName(matchedOcc);
    if (compteDe && compteDe.trim() !== '') return compteDe;
    return 'Non attribué';
};

/**
 * Formate l'affichage d'un expert : "[Cabinet] - [Nom]".
 * Source de vérité unique pour Workspace ET PDF (parité miroir).
 * @param {string} bureau - Cabinet/bureau d'expertise
 * @param {string} expertName - Nom de l'expert
 * @returns {string} Libellé formaté, chaîne vide si aucune donnée
 */
export const formatExpertDisplay = (bureau, expertName) => {
    const b = typeof bureau === 'string' ? bureau.trim() : '';
    const e = typeof expertName === 'string' ? expertName.trim() : '';
    if (b && e) return `${b} - ${e}`;
    return e || b || '';
};
