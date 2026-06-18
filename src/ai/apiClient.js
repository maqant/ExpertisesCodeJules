/**
 * Client d'exécution IA centralisé.
 * UNIQUE point de sortie réseau vers OpenAI pour toute l'application.
 */

import { telemetryBus } from './telemetryBus.js';

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_TIMEOUT_MS = 120_000; // 2 min : ingestion massive de documents.

export class AiCallError extends Error {
  constructor(message, { kind, status = null, rawBody = null }) {
    super(message);
    this.name = 'AiCallError';
    this.kind = kind;
    this.status = status;
    this.rawBody = rawBody;
  }
}

// Identifiant de corrélation : relie le START et le END d'un même appel.
function generateCallId() {
  return (crypto?.randomUUID?.() ?? `call_${Date.now()}_${Math.random().toString(36).slice(2)}`);
}

/**
 * Exécute un appel IA de bout en bout, instrumenté et sécurisé.
 *
 * @param {Object} params
 * @param {string} params.apiKey        - clé OpenAI
 * @param {Object} params.payload       - issu de buildAiPayload()
 * @param {string} params.componentId   - identifiant de l'agent appelant (ex: 'agent_financial')
 * @param {Object} [params.meta={}]      - contexte métier pour la stat (ex: { fileCount })
 * @param {number} [params.timeoutMs]    - override du timeout par défaut
 * @returns {Promise<Object>}
 */
export async function executeAiCall({
  apiKey,
  payload,
  componentId,
  meta = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (!apiKey) throw new AiCallError('Clé API absente.', { kind: 'NETWORK' });
  if (!payload?.model) throw new AiCallError('Payload invalide : "model" manquant.', { kind: 'NETWORK' });

  const model = payload.model;
  const callId = generateCallId();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();

  let outcome = 'success';
  let status = null;
  let caught = null;

  // === ÉVÉNEMENT DE DÉBUT : émis AVANT le fetch ===
  // Permet au superviseur de voir l'activité immédiatement (pas de faux "freeze").
  telemetryBus.emit({
    eventType: 'AI_START',
    callId,
    componentId,
    timestamp: Date.now(),
    details: { model, timeoutMs, ...meta },
  });

  try {
    let response;
    try {
      response = await fetch(OPENAI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (networkErr) {
      if (networkErr.name === 'AbortError') {
        outcome = 'timeout';
        throw new AiCallError(`Timeout après ${timeoutMs} ms (modèle ${model}).`, { kind: 'TIMEOUT' });
      }
      outcome = 'network_error';
      throw new AiCallError(`Échec réseau (modèle ${model}) : ${networkErr.message}`, { kind: 'NETWORK' });
    }

    status = response.status;

    if (!response.ok) {
      outcome = 'http_error';
      const rawBody = await response.text().catch(() => '');
      throw new AiCallError(`Erreur HTTP ${response.status} (modèle ${model}).`, { kind: 'HTTP', status: response.status, rawBody });
    }

    let json;
    try {
      json = await response.json();
    } catch (parseErr) {
      outcome = 'parse_error';
      throw new AiCallError(`Réponse OpenAI illisible (JSON invalide) : ${parseErr.message}`, { kind: 'PARSE' });
    }
    
    return json;
  } catch (err) {
    caught = err;
    throw err;
  } finally {
    clearTimeout(timer);
    const durationMs = Math.round(performance.now() - start);

    // === ÉVÉNEMENT DE FIN : même callId pour corrélation ===
    telemetryBus.emit({
      eventType: 'AI_PROCESSING',
      callId,
      componentId,
      timestamp: Date.now(),
      details: {
        model,
        outcome,
        durationMs,
        status,
        error: caught ? caught.message : null,
        ...meta,
      },
    });
  }
}
