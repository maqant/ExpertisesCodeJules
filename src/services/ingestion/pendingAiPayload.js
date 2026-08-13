/**
 * pendingAiPayload.js — Factory canonique pour le payload pendingAiData
 * Point unique de vérité pour l'assemblage des données transmises au Sas de Validation IA.
 */

import { useIngestionFlowStore } from '../../store/ingestionFlowStore.js';

export const PENDING_AI_BRAND = Symbol.for('pechard.pendingAiPayload');

export const PENDING_AI_PAYLOAD_KEYS = Object.freeze([
  'formData',
  'occupants',
  'experts',
  'intervenants',
  'expenses',
  'pendingFiles',
  '_rawInputText',
  '_metrics'
]);

/**
 * Extrait les métriques quelle que soit la forme du résultat d'ingestion.
 */
export function extractIngestionMetrics(result) {
  return result?.metrics ?? result?.data?._metrics ?? result?._metrics ?? null;
}

/**
 * Verifie si un payload a ete construit via la factory canonique.
 */
export function isCanonicalPendingAiPayload(payload) {
  return Boolean(payload && payload[PENDING_AI_BRAND] === true);
}

/**
 * Factory unique du payload de validation (Sas IA).
 * Effet de bord documenté : synchronise automatiquement `ingestionMetrics` dans Zustand store.
 * @param {object} result - Résultat brut de processGlobalIngestion ou data d'ingestion
 * @param {object} overrides - Champs spécifiques au point d'entrée
 * @returns {object} Payload complet, conforme au contrat
 */
export function buildPendingAiPayload(result, overrides = {}) {
  const metrics = extractIngestionMetrics(result);
  const data = result?.data || result || {};

  const payload = {
    formData:      data?.formData      ?? null,
    occupants:     data?.occupants     ?? [],
    experts:       data?.experts       ?? [],
    intervenants:  data?.intervenants  ?? [],
    expenses:      data?.expenses      ?? [],
    pendingFiles:  data?.pendingFiles  ?? [],
    _rawInputText: data?._rawInputText ?? result?._rawInputText ?? null,
    _metrics:      metrics,
    ...overrides
  };

  // Marquer le payload de manière non-énumérable pour assertion dev
  Object.defineProperty(payload, PENDING_AI_BRAND, {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false
  });

  // Garde-fou dev
  if (import.meta.env.DEV) {
    validatePendingAiPayload(payload);
  }

  // Synchronisation automatique du store Zustand
  if (metrics) {
    useIngestionFlowStore.getState().setIngestionMetrics(metrics);
  }

  return payload;
}

export function validatePendingAiPayload(payload) {
  const missing = PENDING_AI_PAYLOAD_KEYS.filter(k => !(k in payload));
  if (missing.length > 0) {
    console.error(`[Contrat pendingAiData VIOLÉ] Clés manquantes : ${missing.join(', ')}`);
  }
}
