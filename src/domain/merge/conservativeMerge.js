import { FieldStatus } from './mergeStrategies.js';

/**
 * Normalise une valeur scalaire pour comparaison métier.
 * Centralise la règle "vide" : null, undefined, "" et "   " sont vides.
 */
export const isEmptyValue = (value) =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.trim() === '');

/**
 * Normalise pour comparaison stricte (trim sur string, identité sinon).
 */
const normalizeForCompare = (value) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Compare deux valeurs scalaires. Renvoie true si métier-équivalentes.
 */
const areEquivalent = (a, b) =>
  normalizeForCompare(a) === normalizeForCompare(b);

/**
 * Classifie le statut d'UN champ scalaire.
 * @returns {FieldStatus}
 */
export const classifyField = (currentValue, aiValue) => {
  if (isEmptyValue(aiValue)) return FieldStatus.EMPTY_AI;
  if (isEmptyValue(currentValue)) return FieldStatus.NEW;
  if (areEquivalent(currentValue, aiValue)) return FieldStatus.IDENTICAL;
  return FieldStatus.CONFLICT;
};

/**
 * Produit un DIFF traçable et plat (clé -> détail) pour une couche d'objets.
 * Ne gère QUE des champs scalaires : c'est la granularité de validation métier.
 *
 * @param {Record<string, unknown>} current  - données humaines actuelles
 * @param {Record<string, unknown>} ai        - données proposées par l'IA
 * @returns {Array<{ key: string, status: string, currentValue: unknown, aiValue: unknown }>}
 */
export const buildFieldDiff = (current = {}, ai = {}) => {
  if (current === null || typeof current !== 'object') {
    throw new TypeError('[buildFieldDiff] "current" doit être un objet.');
  }
  if (ai === null || typeof ai !== 'object') {
    throw new TypeError('[buildFieldDiff] "ai" doit être un objet.');
  }

  return Object.keys(ai)
    .map((key) => {
      const aiValue = ai[key];
      const currentValue = current[key];
      return {
        key,
        status: classifyField(currentValue, aiValue),
        currentValue,
        aiValue,
      };
    })
    // On ne présente jamais ce que l'IA n'a pas rempli, ni les identiques.
    .filter(
      (entry) =>
        entry.status === FieldStatus.NEW ||
        entry.status === FieldStatus.CONFLICT
    );
};

/**
 * Applique un diff validé. PURE : ne mute jamais l'entrée.
 * Seules les clés explicitement sélectionnées sont appliquées.
 *
 * @param {Record<string, unknown>} current
 * @param {Record<string, unknown>} ai
 * @param {Set<string>|string[]} selectedKeys - clés que l'utilisateur a validées
 * @param {Record<string, unknown>} [valueSource] - source optionnelle (ex: editableData.formData)
 * @returns {{ next: Record<string, unknown>, applied: string[], ignored: Array<{key:string, reason:string}> }}
 */
export const applyValidatedMerge = (current, ai, selectedKeys, valueSource) => {
  const selection =
    selectedKeys instanceof Set ? selectedKeys : new Set(selectedKeys);

  const source = valueSource && typeof valueSource === 'object' ? valueSource : ai;

  const next = { ...current };
  const applied = [];
  const ignored = [];

  for (const key of selection) {
    const hasSourceValue = Object.prototype.hasOwnProperty.call(source, key);
    const hasAiValue = Object.prototype.hasOwnProperty.call(ai, key);

    if (!hasSourceValue && !hasAiValue) {
      ignored.push({ key, reason: 'KEY_NOT_FOUND' });
      continue;
    }

    const value = hasSourceValue ? source[key] : ai[key];

    if (isEmptyValue(value)) {
      ignored.push({ key, reason: 'EMPTY_VALUE' });
      continue; // jamais écraser avec du vide
    }

    next[key] = value;
    applied.push(key);
  }

  return { next, applied, ignored };
};
