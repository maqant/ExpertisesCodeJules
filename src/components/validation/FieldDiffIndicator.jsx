import React from 'react';
import { FieldStatus } from '../../domain/merge/mergeStrategies.js';
import { Sparkles, AlertCircle, ArrowRightLeft } from 'lucide-react';

/**
 * Indicateur visuel de diff pour UN champ.
 * - NEW      : badge "✨ Nouveau" (champ rempli par l'IA alors qu'il était vide)
 * - CONFLICT : bandeau "L'IA propose : X" + bouton de remplacement
 *
 * @param {object} props
 * @param {{status:string, aiValue:unknown, currentValue:unknown}|null} props.diff
 * @param {(value:unknown)=>void} props.onAccept - appelé avec aiValue si l'utilisateur accepte
 * @param {(value:unknown)=>string} [props.formatValue] - formatage d'affichage
 * @param {'inline'|'block'} [props.mode] - 'inline' affiche le badge NEW, 'block' affiche le bandeau CONFLICT
 */
export default function FieldDiffIndicator({ diff, onAccept, formatValue, mode = 'inline' }) {
  if (!diff) return null;

  const display = (v) =>
    typeof formatValue === 'function' ? formatValue(v) : String(v ?? '');

  if (diff.status === FieldStatus.NEW && mode === 'inline') {
    return (
      <span
        role="status"
        aria-label="Information ajoutée par l'analyse IA"
        className="inline-flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/20 rounded px-1.5 py-0.5 ml-2 uppercase tracking-wider"
      >
        <Sparkles className="w-3 h-3" />
        Nouveau
      </span>
    );
  }

  if (diff.status === FieldStatus.ACCUMULATED && mode === 'inline') {
    return (
      <span
        role="status"
        aria-label="L'IA a fusionné le nouveau document avec la cause existante. Décochez pour conserver l'ancienne version."
        title="L'IA a fusionné le nouveau document avec la cause existante. Décochez pour conserver l'ancienne version."
        className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded px-1.5 py-0.5 ml-2 uppercase tracking-wider"
      >
        ✦ Enrichi (cumul narratif)
      </span>
    );
  }

  if (diff.status === FieldStatus.CONFLICT && mode === 'block') {
    return (
      <div className="mt-2 mb-2 bg-amber-500/10 border border-amber-500/30 rounded-md p-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 w-full">
        <div className="flex items-start gap-2 flex-1">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200">
            <span className="font-semibold text-amber-400">L'IA propose : </span>
            <span className="font-medium bg-amber-500/20 px-1 rounded break-words">
              {display(diff.aiValue)}
            </span>
          </div>
        </div>
        
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAccept(diff.aiValue);
          }}
          className="shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-xs font-semibold rounded transition-colors"
        >
          <ArrowRightLeft className="w-3 h-3" />
          Remplacer
        </button>
      </div>
    );
  }

  return null;
}
