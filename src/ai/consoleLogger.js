import { telemetryBus } from './telemetryBus.js';

// Pilotage prod/debug centralisé. Activé en dev, ou si flag explicite.
const DEFAULT_ENABLED =
  import.meta.env?.DEV === true ||
  import.meta.env?.VITE_AI_CONSOLE_LOGS === 'true';

const STYLES = {
  start:   'background:#2563eb;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold;',
  success: 'background:#16a34a;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold;',
  error:   'background:#dc2626;color:#fff;padding:2px 6px;border-radius:3px;font-weight:bold;',
  meta:    'color:#64748b;font-weight:normal;',
};

const SUCCESS_OUTCOMES = new Set(['success']);

// Stocke l'instant de départ par callId pour un fallback de durée si besoin.
const pending = new Map();

function logStart(event) {
  const { details, componentId, callId } = event;
  pending.set(callId, performance.now());
  console.info(
    `%c[AI ▶ START]%c ${details.model} %c(${componentId})`,
    STYLES.start, '', STYLES.meta,
    { callId, ...details },
  );
}

function logEnd(event) {
  const { details, componentId, callId } = event;
  pending.delete(callId);

  const isOk = SUCCESS_OUTCOMES.has(details.outcome);
  const style = isOk ? STYLES.success : STYLES.error;
  const label = isOk ? '[AI ✔ DONE]' : '[AI ✖ FAIL]';

  const log = isOk ? console.info : console.error;
  log(
    `%c${label}%c ${details.model} %c${details.durationMs}ms · ${details.outcome}${details.status ? ` · HTTP ${details.status}` : ''} %c(${componentId})`,
    style, '', STYLES.meta, STYLES.meta,
    { callId, ...details },
  );
}

/**
 * Active le logging console de la télémétrie IA.
 * @param {{ enabled?: boolean }} options
 * @returns {() => void} fonction de désinscription
 */
export function initConsoleLogger({ enabled = DEFAULT_ENABLED } = {}) {
  if (!enabled) return () => {};

  const unsubscribe = telemetryBus.subscribe((event) => {
    switch (event.eventType) {
      case 'AI_START':
        logStart(event);
        break;
      case 'AI_PROCESSING':
        logEnd(event);
        break;
      default:
        // Ignore silencieusement les futurs événements (modules pendant/post-sinistre).
        break;
    }
  });

  console.info('%c[Telemetry]%c Console logger IA actif.', STYLES.start, STYLES.meta);
  return unsubscribe;
}
