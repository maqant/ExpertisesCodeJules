// src/domain/logement.js
// Domaine pur : Unité Immobilière (étage / lot / appartement).
// Règle d'or : ne JAMAIS inventer. En cas de doute -> null + flag côté appelant.
// Aucune dépendance. Idempotent. Testable unitairement.

const strip = (v) =>
  String(v ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// Mots ordinaux français -> numéro d'étage
const ORDINAUX = {
  premier: 1, premiere: 1,
  deuxieme: 2, second: 2, seconde: 2,
  troisieme: 3, quatrieme: 4, cinquieme: 5,
  sixieme: 6, septieme: 7, huitieme: 8,
  neuvieme: 9, dixieme: 10,
};

// Termes indiquant que la chaîne N'EST PAS un étage (lot, appart, adresse, police...)
const NON_ETAGE = /\b(lot|apt|app|appart|appartement|bte|boite|box|police|sinistre|dossier|ref|rue|avenue|av|chaussee|bd|boulevard)\b/;

const formatEtage = (n) => {
  if (n === 0) return 'RDC';
  if (n < 0) return 'Sous-sol';
  return n === 1 ? '1er' : `${n}e`;
};

/**
 * Normalise une expression d'étage vers le format canonique :
 * "RDC" | "Sous-sol" | "1er" | "2e" | ... | null si non interprétable.
 * Retourne null (JAMAIS une invention) si la chaîne ressemble à un lot,
 * un appartement, une adresse ou un numéro de police.
 */
export const normalizeEtage = (raw) => {
  const s = strip(raw);
  if (!s) return null;
  if (NON_ETAGE.test(s)) return null;

  if (/(rez[-\s]?de[-\s]?chauss|rdc|\brez\b)/.test(s)) return 'RDC';
  if (/(sous[-\s]?sol|\bcave\b|\bss\b)/.test(s)) return 'Sous-sol';

  for (const [mot, n] of Object.entries(ORDINAUX)) {
    if (new RegExp(`\\b${mot}\\b`).test(s)) return formatEtage(n);
  }

  // "1er étage", "2e", "3eme", "etage 4", "1", "-1" — nombre borné à 2 chiffres
  const m = s.match(/^(?:au\s+)?(?:etage\s*)?(-?\d{1,2})\s*(?:er|ere|e|eme|ieme)?\s*(?:etage)?$/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isNaN(n) || n > 30) return null; // 31+ = probable n° de rue/police
    return formatEtage(n);
  }

  return null; // Doute => on ne devine pas.
};

/**
 * Extrait { etage, lot, appartement } d'une chaîne libre
 * (ex: "1er étage, lot 5, app 2"). Chaque champ vaut null si absent.
 */
export const parseLocalisation = (raw) => {
  const out = { etage: null, lot: null, appartement: null };
  if (raw == null || String(raw).trim() === '') return out;
  const s = String(raw);

  const lotM = s.match(/\blot\s*(?:n[°o]?\s*)?([0-9]+[a-zA-Z]?)/i);
  if (lotM) out.lot = lotM[1];

  const appM = s.match(/\bapp(?:art(?:ement)?)?\.?\s*(?:n[°o]?\s*)?([0-9]+[a-zA-Z]?)/i);
  if (appM) out.appartement = appM[1];

  // On tente l'étage sur la chaîne débarrassée des mentions lot/app
  const cleaned = s
    .replace(/\blot\s*(?:n[°o]?\s*)?[0-9]+[a-zA-Z]?/gi, '')
    .replace(/\bapp(?:art(?:ement)?)?\.?\s*(?:n[°o]?\s*)?[0-9]+[a-zA-Z]?/gi, '')
    .replace(/[,;/]+/g, ' ')
    .trim();
  out.etage = normalizeEtage(cleaned);

  return out;
};

/**
 * Clé de logement pour regrouper les copropriétaires d'une même unité.
 * null si aucune information de localisation (=> pas de regroupement hasardeux).
 */
export const buildLogementKey = (occ) => {
  if (!occ || typeof occ !== 'object') return null;
  const parts = [
    strip(occ.etage),
    strip(occ.lot),
    strip(occ.appartement),
  ];
  if (parts.every((p) => p === '')) return null;
  return `log|${parts.join('|')}`;
};

/**
 * Regroupe des occupants par logement. Retourne une Map key -> occupants[].
 * Les occupants sans localisation ne sont PAS regroupés (clé null exclue).
 */
export const groupOccupantsByLogement = (occupants = []) => {
  const groups = new Map();
  if (!Array.isArray(occupants)) return groups;
  for (const occ of occupants) {
    const key = buildLogementKey(occ);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(occ);
  }
  return groups;
};
