import React from 'react';
import { formatDuration, formatCostEur, formatTokens } from '../utils/formatMetrics.js';

export default function IngestionMetricsBadge({ metrics }) {
  if (!metrics) return null;
  const duration = metrics.wallClockMs ?? metrics.totalDurationMs;
  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-xs text-indigo-200 font-mono shadow-sm" aria-label="Métriques de traitement IA">
      <span className="flex items-center gap-1" title="Durée totale d'ingestion">
        ⏱️ <strong className="text-white font-semibold">{formatDuration(duration)}</strong>
      </span>
      <span className="text-slate-600">│</span>
      <span className="flex items-center gap-1" title="Coût estimé en Euros">
        💰 <strong className="text-emerald-400 font-semibold">{formatCostEur(metrics.totalCostEur, metrics.hasUnknownCost)}</strong>
      </span>
      <span className="text-slate-600">│</span>
      <span className="flex items-center gap-1" title="Tokens OpenAI consommés">
        📊 <strong className="text-indigo-300 font-semibold">{formatTokens(metrics.totalTokens)}</strong>
      </span>
    </div>
  );
}
