// src/domain/occupantsHierarchy.js
// Tri & groupement parent/enfant pour l'AFFICHAGE et l'IMPRESSION.
// Pur. Ne modifie jamais le store. Réutilisé par Sidebar ET le générateur de rapport.

const STATUS_ORDER = {
  'Propriétaire occupant': 1,
  'Propriétaire non occupant': 2,
  'Propriétaire (occupation inconnue)': 3,
  'ACP': 4,
  'Locataire': 5,
};

const floorRank = (etage) => {
  // Tri par étage : valeurs numériques d'abord, le reste à la fin.
  const lower = String(etage || '').toLowerCase().trim();
  if (!lower) return Number.POSITIVE_INFINITY;
  if (lower.startsWith('rez') || lower === 'rdc') return 0;
  if (lower.startsWith('sous-sol') || lower.startsWith('cave')) return -1;
  const match = lower.match(/-?\d+/);
  if (match) return parseInt(match[0], 10);
  return Number.POSITIVE_INFINITY;
};

const baseSort = (a, b) => {
  const fa = floorRank(a.etage);
  const fb = floorRank(b.etage);
  if (fa !== fb) return fa - fb;
  const sa = STATUS_ORDER[a.statut] ?? 99;
  const sb = STATUS_ORDER[b.statut] ?? 99;
  if (sa !== sb) return sa - sb;
  // tri stable final par nom pour reproductibilité (rapport déterministe)
  return String(a.nom || '').localeCompare(String(b.nom || ''));
};

/**
 * Retourne une liste à plat triée, où chaque Locataire lié est inséré
 * immédiatement APRÈS son propriétaire, avec un flag de profondeur.
 *
 * @returns {Array<{...occupant, _depth: 0|1}>}
 */
export const buildOccupantHierarchy = (occupants = []) => {
  if (!Array.isArray(occupants) || occupants.length === 0) return [];

  // 1. Tri "métier" indépendant
  const sorted = [...occupants].sort(baseSort);

  // 2. Index des locataires par propriétaire lié
  const childrenByParent = new Map();
  const linkedChildIds = new Set();
  for (const occ of sorted) {
    if (occ.statut === 'Locataire' && occ.linkedProprietaireId) {
      if (!childrenByParent.has(occ.linkedProprietaireId)) {
        childrenByParent.set(occ.linkedProprietaireId, []);
      }
      childrenByParent.get(occ.linkedProprietaireId).push(occ);
      linkedChildIds.add(occ.id);
    }
  }

  // 3. Reconstruction : parents (et indépendants) au niveau 0,
  //    enfants liés nichés juste après leur parent au niveau 1.
  const result = [];
  for (const occ of sorted) {
    if (linkedChildIds.has(occ.id)) continue; // sera placé sous son parent
    result.push({ ...occ, _depth: 0 });
    const children = childrenByParent.get(occ.id);
    if (children) {
      for (const child of children) {
        result.push({ ...child, _depth: 1 });
      }
    }
  }

  return result;
};

/** Propriétaires/ACP éligibles comme cible d'un lien (pour le <select>). */
export const getEligibleParents = (occupants = [], selfId) =>
  occupants.filter(
    (p) =>
      p.id !== selfId &&
      typeof p.statut === 'string' &&
      (p.statut.includes('Propriétaire') || p.statut === 'ACP')
  );
