export const fmtOccName = (o) => {
    if (!o) return '';
    return o.nom ? (o.etage && o.etage.trim() !== '' ? `${o.etage} - ${o.nom}` : o.nom) : '';
};

export const findOccByCompteDe = (compteDe, occupants) => {
    if (!compteDe || !occupants) return null;
    return occupants.find(o => o.id === compteDe || fmtOccName(o) === compteDe);
};

/**
 * Détecte si une valeur ressemble à un identifiant technique (UUID v4 ou similaire).
 * Barrière anti-fuite : un ID ne doit JAMAIS apparaître dans l'UI ou le PDF.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const looksLikeTechnicalId = (value) =>
    typeof value === 'string' && UUID_PATTERN.test(value.trim());

const COMPTE_DE_FALLBACK = 'Non attribué';
const COMPTE_DE_ORPHAN = 'Occupant introuvable';

/**
 * Moteur interne unique de résolution de "compteDe".
 * @returns {{ occ: object|null, rawLabel: string|null }}
 *   occ: occupant matché, rawLabel: nom libre légitime ou null.
 */
const resolveCompteDe = (compteDe, occupants) => {
    const occ = findOccByCompteDe(compteDe, occupants);
    if (occ) return { occ, rawLabel: null };
    if (compteDe && typeof compteDe === 'string' && compteDe.trim() !== '') {
        if (looksLikeTechnicalId(compteDe)) {
            // Zéro erreur silencieuse : on signale la fuite évitée.
            console.error(
                `[formatters] UUID orphelin détecté pour "compteDe" (${compteDe}). ` +
                `L'occupant référencé n'existe plus dans la liste fournie. ` +
                `Affichage remplacé par "${COMPTE_DE_ORPHAN}".`
            );
            return { occ: null, rawLabel: COMPTE_DE_ORPHAN };
        }
        return { occ: null, rawLabel: compteDe.trim() }; // nom libre légitime (non matché)
    }
    return { occ: null, rawLabel: null };
};

/**
 * Format LONG : "Etage - Nom". Usage : détails, formulaires, Workspace.
 * Source de vérité unique — parité miroir Workspace/PDF.
 */
export const getCompteDeName = (compteDe, occupants) => {
    const { occ, rawLabel } = resolveCompteDe(compteDe, occupants);
    if (occ) return fmtOccName(occ);
    return rawLabel || COMPTE_DE_FALLBACK;
};

/**
 * Format COURT : "Nom (Etage)". Usage : colonnes de tableaux, PDF compact.
 * Remplace formatShortCompteDe (anciennement local à printDataAdapter.js).
 */
export const getCompteDeShortName = (compteDe, occupants) => {
    const { occ, rawLabel } = resolveCompteDe(compteDe, occupants);
    if (occ) {
        const nom = (occ.nom || '').split(' ')[0] || occ.nom || '';
        const etage = occ.etage && occ.etage.trim() !== '' ? ` (${occ.etage})` : '';
        return `${nom}${etage}`;
    }
    return rawLabel || COMPTE_DE_FALLBACK;
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
