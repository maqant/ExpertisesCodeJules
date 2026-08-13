/**
 * formatMetrics.js
 * Utilitaires de formatage pour les métriques de traitement IA (Durée, Coût, Tokens).
 */

export function formatDuration(ms) {
  if (ms == null || isNaN(ms)) return '—';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}

export function formatCostEur(cost, hasUnknownCost = false) {
  if (cost == null || isNaN(cost)) return '—';
  const formatted = cost < 0.01
    ? `${cost.toFixed(4).replace('.', ',')} €`
    : `${cost.toFixed(3).replace('.', ',')} €`;
  return hasUnknownCost ? `≈ ${formatted}` : formatted;
}

export function formatTokens(n) {
  if (n == null || isNaN(n)) return '—';
  return `${n.toLocaleString('fr-FR')} tokens`;
}
