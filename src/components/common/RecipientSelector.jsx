// src/components/common/RecipientSelector.jsx
import React from 'react';
import { Users, CheckSquare, Square } from 'lucide-react';

const RecipientSelector = ({ recipientState }) => {
  const { candidates, selectedIds, toggle, setAll, hasCandidates } = recipientState;

  if (!hasCandidates) {
    return (
      <div className="text-xs text-slate-500 italic px-2">
        Aucun occupant ou intervenant avec une adresse e-mail valide.
      </div>
    );
  }

  const allSelected = selectedIds.size === candidates.length;

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
      <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Users className="w-3.5 h-3.5 text-indigo-500" />
          Destinataires de l'e-mail ({selectedIds.size}/{candidates.length})
        </div>
        <button
          onClick={() => setAll(!allSelected)}
          className="text-[10px] font-medium text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1"
        >
          {allSelected ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
          {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>
      </div>
      <div className="max-h-32 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
        {candidates.map((c) => (
          <label
            key={c.id}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(c.id)}
              onChange={() => toggle(c.id)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 mt-0.5 cursor-pointer"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-slate-700 truncate">
                {c.displayName} <span className="text-slate-400 font-normal">({c.origin})</span>
              </span>
              <span className="text-[10px] text-slate-500 truncate">{c.email}</span>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
};

export default RecipientSelector;
