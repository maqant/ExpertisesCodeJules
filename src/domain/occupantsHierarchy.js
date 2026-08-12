// src/domain/occupantsHierarchy.js
// Tri & groupement parent/enfant pour l'AFFICHAGE et l'IMPRESSION.
// Pur. Ne modifie jamais le store. Réutilisé par Sidebar ET le générateur de rapport.
//
// ORDRE NATUREL D'UN IMMEUBLE (lecture haut → bas du document) :
//   Sous-sol (-N) → RDC (0) → 1er → 2e → ... → Combles → ACP (entité globale, en dernier).
//
// INVARIANT CRITIQUE : tous les rangs d'étage sont FINIS. Le comparateur ne
// retourne jamais NaN (Infinity - Infinity = NaN ⇒ tri indéterministe, cause
// du bug historique "RDC 5 4 3...").

const STATUS_ORDER = {
  'Propriétaire occupant': 1,
  'Propriétaire non occupant': 2,
  'Propriétaire (occupation inconnue)': 3,
  'ACP': 4,
  'Locataire': 5,
  'Tiers': 6,
};

// Rangs sentinelles — volontairement finis et espacés.
const RANK = {
  BASEMENT_DEFAULT: -1,   // Sous-sol / cave sans numéro
  GROUND: 0,              // RDC
  MEZZANINE: 0.5,         // Entresol / mezzanine (entre RDC et 1er)
  TOP: 8000,              // Combles / grenier / toiture / dernier étage
  UNKNOWN: 9000,          // Étage illisible ou absent
  GLOBAL: 10000,          // ACP / immeuble entier — toujours en fin de liste
};

/** Normalise un libellé : minuscules, sans accents, espaces réduits. */
const normalizeLabel = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Rang d'étage déterministe et FINI.
 * Le statut ACP force le rang GLOBAL quel que soit le champ `etage`
 * (l'ACP représente juridiquement l'immeuble entier, pas un lot).
 *
 * Exemples :
 *   "2ème sous-sol"      → -2      "Rez-de-chaussée"   → 0
 *   "RDC (commerces)"    → 0       "Entresol"          → 0.5
 *   "1er étage"          → 1       "Étage 4" / "4e"    → 4
 *   "Combles"            → 8000    "" / "?"            → 9000
 *   "ACP" / "Immeuble"   → 10000
 */
export const floorRank = (etage, statut = '') => {
  if (statut === 'ACP') return RANK.GLOBAL;

  const s = normalizeLabel(etage);
  if (!s) return RANK.UNKNOWN;

  // Entité globale déclarée dans le champ étage lui-même
  if (/\b(acp|immeuble|general|global|communs?|syndic|copropriete|copropriete)\b/.test(s)) {
    return RANK.GLOBAL;
  }

  // Niveaux enterrés : "sous-sol", "2eme sous-sol", "cave", "parking -2"...
  if (/(sous.?sol|cave|parking|garage)/.test(s)) {
    const m = s.match(/\d+/);
    return m ? -Math.abs(parseInt(m[0], 10)) : RANK.BASEMENT_DEFAULT;
  }

  // Rez-de-chaussée : toute variante ("rdc", "rez-de-chaussee", "rdc (commerces)")
  if (/(\brdc\b|rez)/.test(s)) return RANK.GROUND;

  if (/(entresol|mezzanine)/.test(s)) return RANK.MEZZANINE;

  // Sommet du bâtiment
  if (/(combles?|grenier|toit|toiture|dernier)/.test(s)) return RANK.TOP;

  // Étage numérique : "1er", "2e", "5eme", "etage 3", "-1"
  const m = s.match(/-?\d+/);
  if (m) return parseInt(m[0], 10);

  return RANK.UNKNOWN;
};

const baseSort = (a, b) => {
  const fa = floorRank(a.etage, a.statut);
  const fb = floorRank(b.etage, b.statut);
  if (fa !== fb) return fa - fb; // rangs toujours finis ⇒ jamais NaN
  const sa = STATUS_ORDER[a.statut] ?? 99;
  const sb = STATUS_ORDER[b.statut] ?? 99;
  if (sa !== sb) return sa - sb;
  // tri stable final par nom pour reproductibilité (rapport déterministe)
  return String(a.nom || '').localeCompare(String(b.nom || ''), 'fr', {
    sensitivity: 'base',
  });
};

/**
 * Retourne une liste à plat triée (Sous-sol → RDC → 1er → ... → ACP), où
 * chaque Locataire lié est inséré immédiatement APRÈS son propriétaire,
 * avec un flag de profondeur.
 * Règle métier : TOUT Locataire (lié ou non) est indenté (_depth: 1).
 * Garantie anti-perte : un Locataire au lien cassé (propriétaire absent)
 * est réintégré en fin de liste — jamais omis du rapport.
 *
 * @returns {Array<{...occupant, _depth: 0|1}>}
 */
export const buildOccupantHierarchy = (occupants = []) => {
  if (!Array.isArray(occupants) || occupants.length === 0) return [];

  const isLocataire = (occ) => occ.statut === 'Locataire';

  // 1. Tri "métier" indépendant (ordre naturel de l'immeuble)
  const sorted = [...occupants].sort(baseSort);

  // 2. Index des locataires par propriétaire lié
  const childrenByParent = new Map();
  const linkedChildIds = new Set();
  for (const occ of sorted) {
    if (isLocataire(occ) && occ.linkedProprietaireId) {
      if (!childrenByParent.has(occ.linkedProprietaireId)) {
        childrenByParent.set(occ.linkedProprietaireId, []);
      }
      childrenByParent.get(occ.linkedProprietaireId).push(occ);
      linkedChildIds.add(occ.id);
    }
  }

  // 3. Reconstruction : propriétaires/ACP au niveau 0,
  //    TOUS les locataires au niveau 1 (liés : nichés sous leur parent).
  //    Le tri par étage n'est jamais rompu : un enfant suit son parent,
  //    et les parents sont déjà ordonnés par étage.
  const result = [];
  const emittedIds = new Set();
  for (const occ of sorted) {
    if (linkedChildIds.has(occ.id)) continue; // sera placé sous son parent
    result.push({ ...occ, _depth: isLocataire(occ) ? 1 : 0 });
    emittedIds.add(occ.id);
    const children = childrenByParent.get(occ.id);
    if (children) {
      for (const child of children) {
        result.push({ ...child, _depth: 1 });
        emittedIds.add(child.id);
      }
    }
  }

  // 4. Filet de sécurité : réintègre les locataires au lien cassé.
  //    Zéro perte silencieuse.
  for (const occ of sorted) {
    if (!emittedIds.has(occ.id)) {
      result.push({ ...occ, _depth: 1 });
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

/**
 * Regroupe les occupants par unité immobilière (housingUnitId).
 * Les occupants sans housingUnitId sont retournés dans `unassigned`.
 * Purement additif — n'altère ni les occupants ni les liens parent/enfant.
 */
export const groupByHousingUnit = (occupants = []) => {
  const units = new Map();
  const unassigned = [];
  for (const occ of occupants) {
    if (!occ?.housingUnitId) { unassigned.push(occ); continue; }
    if (!units.has(occ.housingUnitId)) units.set(occ.housingUnitId, []);
    units.get(occ.housingUnitId).push(occ);
  }
  return { units, unassigned };
};
