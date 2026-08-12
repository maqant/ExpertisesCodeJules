// src/domain/occupantsHierarchy.js
// Tri & groupement parent/enfant pour l'AFFICHAGE et l'IMPRESSION.
// Pur. Ne modifie jamais le store. Réutilisé par Sidebar ET le générateur de rapport.
//
// ORDRE VERTICAL SCHÉMATIQUE (invariant métier) :
// le haut de la liste = sommet de l'immeuble, le bas = la rue, puis l'ACP en synthèse.
//   Combles -> 5e -> 4e -> 3e -> 2e -> 1er -> (entresol) -> RDC -> Sous-sol
//   -> Étage inconnu -> ACP (toujours en toute fin).

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
 * Sémantique inchangée : plus le rang est élevé, plus on est haut dans l'immeuble.
 * UNKNOWN et GLOBAL sont des sentinelles hors échelle physique.
 */
export const floorRank = (etage, statut = '') => {
  if (statut === 'ACP') return RANK.GLOBAL;

  const s = normalizeLabel(etage);
  if (!s) return RANK.UNKNOWN;

  // Entité globale déclarée dans le champ étage lui-même
  if (/\b(acp|immeuble|general|global|communs?|syndic|copropriete)\b/.test(s)) {
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

/**
 * Segmente un rang en "tier" d'affichage :
 *   0 = niveau privatif physique (trié en ordre DÉCROISSANT : haut de l'immeuble d'abord)
 *   1 = étage inconnu (relégué après tous les niveaux physiques)
 *   2 = entité globale ACP (toujours en toute fin, en synthèse)
 */
const floorTier = (rank) => {
  if (rank === RANK.GLOBAL) return 2;
  if (rank === RANK.UNKNOWN) return 1;
  return 0;
};

const baseSort = (a, b) => {
  const fa = floorRank(a.etage, a.statut);
  const fb = floorRank(b.etage, b.statut);

  // 1) Les tiers d'abord : privatifs, puis inconnus, puis ACP (croissant).
  const ta = floorTier(fa);
  const tb = floorTier(fb);
  if (ta !== tb) return ta - tb;

  // 2) Au sein des niveaux privatifs : ordre DÉCROISSANT de rang
  //    (Combles 8000 -> 5e -> ... -> 1er -> Mezzanine 0.5 -> RDC 0 -> Sous-sols -1, -2...).
  //    Reflète la vue schématique verticale : le haut de la liste = le haut de l'immeuble.
  if (fa !== fb) return fb - fa;

  // 3) Départage : statut métier, puis nom (ordre croissant, inchangé).
  const sa = STATUS_ORDER[a.statut] ?? 99;
  const sb = STATUS_ORDER[b.statut] ?? 99;
  if (sa !== sb) return sa - sb;
  return String(a.nom || '').localeCompare(String(b.nom || ''), 'fr', {
    sensitivity: 'base',
  });
};

/**
 * Retourne une liste à plat triée (5e → 4e → ... → RDC → Sous-sol → ACP), où
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

  // 1. Tri "métier" indépendant (ordre schématique vertical de l'immeuble)
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
