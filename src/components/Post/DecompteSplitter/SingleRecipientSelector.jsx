import React, { useState } from 'react';
import { User, AlertCircle, Plus, Edit2, Check, X } from 'lucide-react';
import { createLocalContact, validateContactDraft } from '../../../services/utils/contactUtils';

const SingleRecipientSelector = ({ recipientState, onSelectRef, onCreateContact }) => {
    const { candidates, recipientRef, selectedContact } = recipientState;
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState({ displayName: '', email: '', iban: '', sourceId: null });
    const [error, setError] = useState(null);

    const startEdit = (sourceContact = null) => {
        if (sourceContact) {
            setDraft({
                displayName: sourceContact.displayName || '',
                email: sourceContact.email || '',
                iban: sourceContact.iban || '',
                sourceId: sourceContact.id
            });
        } else {
            setDraft({ displayName: '', email: '', iban: '', sourceId: null });
        }
        setError(null);
        setIsEditing(true);
    };

    const handleSave = () => {
        const { isValid, errors } = validateContactDraft(draft);
        if (!isValid) {
            setError(Object.values(errors)[0]);
            return;
        }

        const newContact = createLocalContact(draft, { fromSourceId: draft.sourceId });
        onCreateContact(newContact);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="flex flex-col gap-2 bg-slate-50 p-2 rounded border border-indigo-200">
                <div className="flex items-center justify-between text-[10px] font-semibold text-indigo-700 uppercase tracking-wider mb-1">
                    <span>{draft.sourceId ? 'Modifier pour ce paiement' : 'Nouveau contact'}</span>
                </div>
                <input 
                    type="text" 
                    placeholder="Nom complet *" 
                    className="w-full text-xs border-slate-300 rounded p-1.5 focus:border-indigo-500 focus:ring-indigo-500"
                    value={draft.displayName}
                    onChange={e => setDraft(d => ({...d, displayName: e.target.value}))}
                />
                <input 
                    type="email" 
                    placeholder="E-mail" 
                    className="w-full text-xs border-slate-300 rounded p-1.5 focus:border-indigo-500 focus:ring-indigo-500"
                    value={draft.email}
                    onChange={e => setDraft(d => ({...d, email: e.target.value}))}
                />
                <input 
                    type="text" 
                    placeholder="IBAN (optionnel)" 
                    className="w-full text-xs border-slate-300 rounded p-1.5 focus:border-indigo-500 focus:ring-indigo-500 uppercase"
                    value={draft.iban}
                    onChange={e => setDraft(d => ({...d, iban: e.target.value}))}
                />
                {error && <span className="text-[10px] text-red-500">{error}</span>}
                <div className="flex gap-2 justify-end mt-1">
                    <button 
                        className="text-slate-500 hover:text-slate-700 text-xs px-2 py-1 flex items-center gap-1"
                        onClick={() => setIsEditing(false)}
                    >
                        <X className="w-3 h-3" /> Annuler
                    </button>
                    <button 
                        className="bg-indigo-600 text-white hover:bg-indigo-700 rounded text-xs px-3 py-1 flex items-center gap-1"
                        onClick={handleSave}
                    >
                        <Check className="w-3 h-3" /> Valider
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <User className="w-3 h-3" /> Destinataire
                </label>
                <button 
                    onClick={() => startEdit()}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                >
                    <Plus className="w-3 h-3" /> Créer
                </button>
            </div>
            
            {candidates.length === 0 ? (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Aucun contact. Veuillez en créer un.</span>
                </div>
            ) : (
                <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                        <select
                            className="w-full text-sm border-slate-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white"
                            value={recipientRef ? `${recipientRef.kind}:${recipientRef.id}` : ''}
                            onChange={(e) => {
                                const [kind, id] = e.target.value.split(':');
                                onSelectRef({ kind, id });
                            }}
                        >
                            <option value="" disabled>-- Sélectionner un destinataire --</option>
                            {candidates.map(c => (
                                <option key={`${c.kind}:${c.id}`} value={`${c.kind}:${c.id}`}>
                                    {c.displayName} {c.email ? `(${c.email})` : ''} - [{c.origin}]
                                </option>
                            ))}
                        </select>
                    </div>
                    {selectedContact && selectedContact.kind === 'dossier' && (
                        <button 
                            onClick={() => startEdit(selectedContact)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                            title="Modifier ce contact pour ce paiement (ne modifie pas le dossier)"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default SingleRecipientSelector;
