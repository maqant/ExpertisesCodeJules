import React from 'react';
import { User, AlertCircle } from 'lucide-react';

const SingleRecipientSelector = ({ recipientState, onChange }) => {
    const { candidates, selectedId, select, hasCandidates } = recipientState;

    if (!hasCandidates) {
        return (
            <div className="flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Aucun contact trouvé dans le dossier (ou sans e-mail).</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <User className="w-3 h-3" />
                Destinataire
            </label>
            <div className="relative">
                <select
                    className="w-full text-sm border-slate-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white"
                    value={selectedId || ''}
                    onChange={(e) => {
                        const val = e.target.value;
                        select(val);
                        if (onChange) onChange(val);
                    }}
                >
                    <option value="" disabled>-- Sélectionner un destinataire --</option>
                    {candidates.map(c => (
                        <option key={c.id} value={c.id}>
                            {c.displayName} {c.email ? `(${c.email})` : ''} - [{c.origin}]
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
};

export default SingleRecipientSelector;
