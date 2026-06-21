// src/services/storage/referenceManager.js

// =============================================================
//  referenceManager.js
//  Validation, normalisation, fusion et (dé)sérialisation des
//  référentiels métier transversaux (experts, franchises, prestataires).
//  AUCUNE dépendance React/DOM ici : module pur, testable unitairement.
// =============================================================

export const REFERENCE_SCHEMA_VERSION = 1;

// ---- Normalisation (réutilisable côté Context) --------------

/** Clé normalisée d'un expert : minuscules, sans accents, sans espaces superflus. */
export function normalizeExpertKey(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Normalisation simple d'une chaîne de référentiel (franchise / prestataire). */
function normalizeStringEntry(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).trim();
}

// ---- Validation / Sanitisation ------------------------------

/** Garantit qu'un expert est { nom: string, tel: string }. Rejette le reste. */
function sanitizeExpert(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const nom = typeof raw.nom === 'string' ? raw.nom.trim() : '';
  const tel = typeof raw.tel === 'string' ? raw.tel.trim() : '';
  if (!nom && !tel) return null; // entrée vide => ignorée
  return { nom, tel };
}

/** Liste de chaînes dédupliquée (insensible à la casse) et triée. */
function sanitizeStringList(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const result = [];
  for (const item of raw) {
    const clean = normalizeStringEntry(item);
    if (!clean) continue;
    const dedupeKey = clean.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    result.push(clean);
  }
  return result.sort((a, b) => a.localeCompare(b, 'fr'));
}

// ---- Fusion (merge) -----------------------------------------

/**
 * Fusionne deux listes d'experts par clé normalisée (nom prioritaire, tel fallback).
 * En cas de doublon, l'entrée entrante (incoming) complète les champs manquants
 * de l'existante SANS écraser une valeur non vide existante.
 */
export function mergeExperts(existing = [], incoming = []) {
  const map = new Map();

  const ingest = (list) => {
    for (const rawExp of list) {
      const exp = sanitizeExpert(rawExp);
      if (!exp) continue;
      const key = normalizeExpertKey(exp.nom) || normalizeExpertKey(exp.tel);
      if (!key) continue;
      const current = map.get(key);
      if (!current) {
        map.set(key, { ...exp });
      } else {
        map.set(key, {
          nom: current.nom || exp.nom,
          tel: current.tel || exp.tel,
        });
      }
    }
  };

  ingest(existing);
  ingest(incoming);

  return Array.from(map.values()).sort((a, b) =>
    (a.nom || '').localeCompare(b.nom || '', 'fr')
  );
}

/** Fusion dédupliquée pour franchises / prestataires. */
export function mergeStringLists(existing = [], incoming = []) {
  return sanitizeStringList([...sanitizeStringList(existing), ...sanitizeStringList(incoming)]);
}

// ---- Export ---------------------------------------------------

/**
 * Construit l'objet exportable, versionné et horodaté.
 * @param {{experts:Array, franchises:Array, prestataires:Array}} data
 */
export function buildExportPayload(data) {
  return {
    schemaVersion: REFERENCE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'ExpertisesCodeJules',
    kind: 'reference-data',
    data: {
      experts: (data.experts || []).map(sanitizeExpert).filter(Boolean),
      franchises: sanitizeStringList(data.franchises),
      prestataires: sanitizeStringList(data.prestataires),
    },
  };
}

// ---- Import (parsing résilient + validation) ----------------

export class ReferenceImportError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ReferenceImportError';
  }
}

/**
 * Parse et valide un contenu JSON d'import.
 * @param {string} jsonString - contenu brut du fichier
 * @returns {{experts:Array, franchises:Array, prestataires:Array}} données saines
 * @throws {ReferenceImportError} si le format est invalide
 */
export function parseImportPayload(jsonString) {
  let payload;
  try {
    payload = JSON.parse(jsonString);
  } catch {
    throw new ReferenceImportError('Fichier illisible : JSON invalide.');
  }

  if (!payload || typeof payload !== 'object') {
    throw new ReferenceImportError('Structure de fichier non reconnue.');
  }

  // Compatibilité ascendante : on accepte soit { data: {...} } soit l'objet plat.
  const data = payload.data && typeof payload.data === 'object' ? payload.data : payload;

  if (payload.schemaVersion && payload.schemaVersion > REFERENCE_SCHEMA_VERSION) {
    throw new ReferenceImportError(
      `Ce fichier provient d'une version plus récente de l'application (v${payload.schemaVersion}). Veuillez mettre à jour votre application.`
    );
  }

  return {
    experts: Array.isArray(data.experts) ? data.experts : [],
    franchises: Array.isArray(data.franchises) ? data.franchises : [],
    prestataires: Array.isArray(data.prestataires) ? data.prestataires : [],
  };
}
