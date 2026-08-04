import React, { useState, useMemo } from 'react';
import { User, AlertCircle, Plus, Edit2, Check, X } from 'lucide-react';
import { buildAllCandidates, createLocalContact, validateContactDraft } from '../../../services/utils/contactUtils.js';

/**
 * Sélecteur de destinataire unitaire (Paiement ou E-mail).
 */
export const SingleRecipientSelector = ({
    recipientRef = null,
    recipientSnapshot = null,
    localContacts = [],
    occupants = [],
    intervenants = [],
    onSelect,
    onCreateContact,
    // Alias legacy défensifs
    onSelectRecipient,
    onSelectRef,
    onCreateLocalContact,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState({ displayName: '', email: '', iban: '', sourceId: null });
    const [error, setError] = useState(null);

    const effectiveOnSelect = onSelect || onSelectRecipient || onSelectRef;
    const effectiveOnCreate = onCreateContact || onCreateLocalContact;

    const candidates = useMemo(
        () => buildAllCandidates({ occupants, intervenants, localContacts }),
        [occupants, intervenants, localContacts]
    );

    const selectedContact = useMemo(() => {
        if (!recipientRef) return null;
        return candidates.find(c => c.kind === recipientRef.kind && c.id === recipientRef.id) || null;
    }, [candidates, recipientRef]);

    const startEdit = (sourceContact = null) => {
        setDraft(sourceContact
            ? {
                displayName: sourceContact.displayName || '',
                email: sourceContact.email || '',
                iban: sourceContact.iban || '',
                sourceId: sourceContact.id,
              }
            : { displayName: '', email: '', iban: '', sourceId: null }
        );
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
        effectiveOnCreate?.(newContact);

        effectiveOnSelect?.(
            { kind: newContact.kind || 'local', id: newContact.id },
            {
                displayName: newContact.displayName,
                email: newContact.email || null,
                iban: newContact.iban || null,
                isCompany: !!newContact.isCompany,
            }
        );
        setIsEditing(false);
    };

    const handleChange = (e) => {
        if (!e.target.value) {
            effectiveOnSelect?.(null, null);
            return;
        }
        const [kind, id] = e.target.value.split(':');
        const candidate = candidates.find(c => c.kind === kind && c.id === id);
        const snapshot = candidate
            ? {
                displayName: candidate.displayName,
                email: candidate.email || null,
                iban: candidate.iban || null,
                isCompany: !!candidate.isCompany,
              }
            : null;
        effectiveOnSelect?.({ kind, id }, snapshot);
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
                    className="w-full text-xs border-slate-300 rounded p-1.5 bg-white focus:border-indigo-500 focus:ring-indigo-500"
                    value={draft.displayName}
                    onChange={e => setDraft(d => ({...d, displayName: e.target.value}))}
                />
                <input 
                    type="email" 
                    placeholder="E-mail" 
                    className="w-full text-xs border-slate-300 rounded p-1.5 bg-white focus:border-indigo-500 focus:ring-indigo-500"
                    value={draft.email}
                    onChange={e => setDraft(d => ({...d, email: e.target.value}))}
                />
                <input 
                    type="text" 
                    placeholder="IBAN (optionnel)" 
                    className="w-full text-xs border-slate-300 rounded p-1.5 bg-white focus:border-indigo-500 focus:ring-indigo-500 uppercase"
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
            <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                    <select
                        className="w-full text-xs border-slate-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 bg-white p-2"
                        value={recipientRef ? `${recipientRef.kind}:${recipientRef.id}` : ''}
                        onChange={handleChange}
                    >
                        <option value="">-- Sélectionner un destinataire --</option>
                        {candidates.map(c => (
                            <option key={`${c.kind}:${c.id}`} value={`${c.kind}:${c.id}`}>
                                {c.displayName} {c.email ? `(${c.email})` : ''} - [{c.origin}]
                            </option>
                        ))}
                    </select>
                </div>
                <button 
                    onClick={() => startEdit(selectedContact)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                    title="Créer ou modifier un contact"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>
            {recipientRef && !selectedContact && recipientSnapshot && (
                <span className="text-[10px] text-amber-600">
                    ⚠ Contact source introuvable — snapshot figé utilisé : {recipientSnapshot.displayName}
                </span>
            )}
        </div>
    );
};

export default SingleRecipientSelector;
