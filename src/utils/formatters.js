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
