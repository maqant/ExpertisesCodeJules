import { FieldStatus } from './mergeStrategies.js';
import {
  isAccumulativeField,
  ACCUMULATION_MIN_LENGTH_RATIO,
} from './fieldPolicies.js';

export const isEmptyValue = (value) =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.trim() === '');

const normalizeForCompare = (value) =>
  typeof value === 'string' ? value.trim() : value;

const areEquivalent = (a, b) =>
  normalizeForCompare(a) === normalizeForCompare(b);

/**
 * Garde-fou anti-écrasement : une accumulation légitime ne réduit pas
 * significativement le contenu existant. Si c'est le cas, on refuse le
 * statut ACCUMULATED et on retombe sur CONFLICT (décision humaine forcée).
 */
const isSuspiciousAccumulation = (currentValue, aiValue) => {
  if (typeof currentValue !== 'string' || typeof aiValue !== 'string') {
    return true; // types inattendus sur un champ narratif → prudence maximale
  }
  return (
    aiValue.trim().length <
    currentValue.trim().length * ACCUMULATION_MIN_LENGTH_RATIO
  );
};

/**
 * @param {*} currentValue - valeur actuelle (potentiellement humaine)
 * @param {*} aiValue - valeur proposée par l'IA
 * @param {{ accumulative?: boolean }} [options] - politique du champ
 */
export const classifyField = (currentValue, aiValue, options = {}) => {
  if (isEmptyValue(aiValue)) return FieldStatus.EMPTY_AI;
  if (isEmptyValue(currentValue)) return FieldStatus.NEW;
  if (areEquivalent(currentValue, aiValue)) return FieldStatus.IDENTICAL;

  if (options.accumulative === true) {
    if (isSuspiciousAccumulation(currentValue, aiValue)) {
      return FieldStatus.CONFLICT;
    }
    return FieldStatus.ACCUMULATED;
  }

  return FieldStatus.CONFLICT;
};

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
        status: classifyField(currentValue, aiValue, {
          accumulative: isAccumulativeField(key),
        }),
        currentValue,
        aiValue,
      };
    })
    .filter(
      (entry) =>
        entry.status === FieldStatus.NEW ||
        entry.status === FieldStatus.CONFLICT ||
        entry.status === FieldStatus.ACCUMULATED
    );
};

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
      continue;
    }

    next[key] = value;
    applied.push(key);
  }

  return { next, applied, ignored };
};
