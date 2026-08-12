/**
 * Règle d'or (spec utilisateur) :
 * - Mode avancé global actif  ➔ tous les occupants affichent leurs détails.
 * - Mode avancé global inactif ➔ seuls les occupants cochés individuellement.
 *
 * @param {boolean} orgaAdvancedMode - Toggle global "Mode avancé"
 * @param {object}  occupant         - Occupant (peut ne pas avoir showDetails)
 * @returns {boolean}
 */
export const isOccupantDetailsVisible = (orgaAdvancedMode, occupant) =>
  Boolean(orgaAdvancedMode || occupant?.showDetails);
