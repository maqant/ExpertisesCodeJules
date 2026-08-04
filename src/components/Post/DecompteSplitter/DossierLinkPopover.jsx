import React, { useEffect, useMemo, useRef, useState } from 'react';
import { buildSuggestedLabel } from '../../../domain/decompteSplitter/dossierExpenseMatcher.js';

/**
 * Popover compact de liaison manuelle d'un poste de décompte
 * vers un frais du dossier d'expertise.
 */
export default function DossierLinkPopover({
  open,
  anchorRef,
  expense,
  dossierFrais = [],
  linkedFraisId = null,
  onSelect,
  onUnlink,
  onClose,
}) {
  const popoverRef = useRef(null);
  const searchInputRef = useRef(null);
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();

  const filteredFrais = useMemo(() => {
    if (!normalizedQuery) return dossierFrais;
    return dossierFrais.filter((frais) => {
      const haystack = [frais.prestataire, frais.ref, frais.desc, frais.type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [dossierFrais, normalizedQuery]);

  useEffect(() => {
    if (open) {
      setQuery('');
      requestAnimationFrame(() => searchInputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target) && anchorRef?.current && !anchorRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div ref={popoverRef} className="absolute z-50 right-0 mt-1 w-80 bg-white rounded-lg shadow-xl border border-slate-200 p-3 flex flex-col gap-2 text-xs text-slate-700">
      <div className="flex justify-between items-center border-b border-slate-100 pb-1.5 font-semibold text-slate-800">
        <span>🔗 Lier à un frais du dossier</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
      </div>

      <input
        ref={searchInputRef}
        type="search"
        className="w-full text-xs p-1.5 border border-slate-300 rounded focus:border-indigo-500 outline-none"
        placeholder="Rechercher (prestataire, réf, description)..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <ul className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
        {filteredFrais.length === 0 ? (
          <li className="p-2 text-center text-slate-400 italic">Aucun frais correspondant</li>
        ) : (
          filteredFrais.map((frais) => {
            const isLinked = frais.id === linkedFraisId;
            const canonical = buildSuggestedLabel(frais);
            return (
              <li key={frais.id}>
                <button
                  type="button"
                  onClick={() => { onSelect?.(frais); onClose?.(); }}
                  className={`w-full text-left p-1.5 rounded transition-colors flex flex-col gap-0.5 ${isLinked ? 'bg-indigo-50 border border-indigo-200 font-semibold' : 'hover:bg-slate-100'}`}
                >
                  <span className="truncate text-slate-800">{canonical}</span>
                  {isLinked && <span className="text-[10px] text-indigo-600">✓ Actuellement lié</span>}
                </button>
              </li>
            );
          })
        )}
      </ul>

      {linkedFraisId && (
        <div className="border-t border-slate-100 pt-1.5 flex justify-end">
          <button
            type="button"
            onClick={() => { onUnlink?.(); onClose?.(); }}
            className="text-[11px] text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
          >
            ⛓️‍💥 Délier ce poste
          </button>
        </div>
      )}
    </div>
  );
}
