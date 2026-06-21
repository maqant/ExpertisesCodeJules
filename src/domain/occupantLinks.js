// src/domain/occupantLinks.js
// Validation + résolution des liens Locataire -> Propriétaire.
// Pur, défensif, idempotent. C'est l'ancien "resolveLinks" durci.

const PROPRIO_STATUTS = ['Propriétaire', 'Propriétaire occupant', 'Propriétaire non occupant', 'Propriétaire (occupation inconnue)', 'ACP']; // un parent valide
const isValidParent = (occ) =>
  typeof occ?.statut === 'string' &&
  (occ.statut.includes('Propriétaire') || occ.statut === 'ACP');

/**
 * Nettoie et valide les liens linkedProprietaireId.
 * Règles :
 *  - Un locataire seul peut porter un lien.
 *  - La cible doit exister, être un propriétaire/ACP valide, et != lui-même.
 *  - Tout lien invalide est neutralisé (=> null) plutôt que de corrompre le rapport.
 *
 * @param {Array} occupants - liste brute
 * @returns {Array} liste avec liens assainis (ordre PRÉSERVÉ)
 */
export const resolveLinks = (occupants = []) => {
  if (!Array.isArray(occupants)) return [];

  const byId = new Map(occupants.map((o) => [o.id, o]));

  return occupants.map((occ) => {
    const targetId = occ?.linkedProprietaireId;
    if (!targetId) return { ...occ, linkedProprietaireId: null };

    // Seul un Locataire peut être lié à un propriétaire.
    if (occ.statut !== 'Locataire') {
      return { ...occ, linkedProprietaireId: null };
    }

    const target = byId.get(targetId);
    const valid =
      !!target &&
      target.id !== occ.id &&     // pas d'auto-référence
      isValidParent(target);      // cible = vrai propriétaire/ACP

    return { ...occ, linkedProprietaireId: valid ? targetId : null };
  });
};

export const occupantHelpers = { isValidParent, PROPRIO_STATUTS };
