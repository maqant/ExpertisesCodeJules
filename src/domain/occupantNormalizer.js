// src/domain/occupantNormalizer.js
// Normalisation métier pure. Aucune dépendance React/Zustand.
// Centralise les règles d'écriture (casse) et la génération d'identité.

// IDs robustes : crypto.randomUUID quand dispo, fallback contrôlé.
export const generateOccupantId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `occ_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const upper = (v) => (v != null ? String(v).trim().toUpperCase() : '');

/**
 * Applique les règles de normalisation à un occupant.
 * Idempotent : appeler 2x donne le même résultat.
 */
export const normalizeOccupant = (occupant = {}) => ({
  ...occupant,
  id: occupant.id || generateOccupantId(),
  nom: upper(occupant.nom),
  // statut toujours défini → évite les crashs sur .includes()
  statut: occupant.statut ?? '',
  linkedProprietaireId: occupant.linkedProprietaireId || null,
});
