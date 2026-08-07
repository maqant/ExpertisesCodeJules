import React, { useState, useMemo } from 'react';
import { User, AlertCircle, Plus, Edit2, Check, X } from 'lucide-react';
import { buildAllCandidates, createLocalContact, validateContactDraft } from '../../../services/utils/contactUtils.js';

const FIELD_CLASS = "w-full text-sm text-slate-900 font-semibold bg-white border border-slate-300 rounded-lg p-2 placeholder:text-slate-400 placeholder:font-normal focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none";

/**
 * Sélecteur de destinataire unitaire (Paiement ou E-mail).
 */
export const SingleRecipientSelector = ({
    recipientRef = null,
    recipientSnapshot = null,
    localContacts = [],
    occupants = [],
    intervenants = [],
    documentCandidates = [],
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
        () => buildAllCandidates({ occupants, intervenants, localContacts, documentCandidates }),
        [occupants, intervenants, localContacts, documentCandidates]
    );

    const groupedCandidates = useMemo(() => {
        const groups = {
            'Dossier actif': [],
            'Document analysé': [],
            'Session actuelle': []
        };
        candidates.forEach(c => {
            const cat = c.sourceCategory || (c.kind === 'dossier' ? 'Dossier actif' : c.kind === 'document' ? 'Document analysé' : 'Session actuelle');
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(c);
        });
        return groups;
    }, [candidates]);

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
            <div className="flex flex-col gap-2.5 bg-white p-3 rounded-lg border-2 border-indigo-200 shadow-sm">
                <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                    {draft.sourceId ? 'Modifier pour ce paiement' : 'Nouveau contact'}
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-slate-600">Nom *</label>
                    <input 
                        type="text" 
                        placeholder="Nom (ex: Dupont, La Croisette...)" 
                        className={FIELD_CLASS}
                        value={draft.displayName}
                        onChange={e => setDraft(d => ({...d, displayName: e.target.value}))}
                        autoComplete="off"
                        data-form-type="other"
                        autoFocus
                    />
                </div>

                {error && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {error}
                    </div>
                )}

                <div className="flex gap-2 justify-end mt-1">
                    <button 
                        type="button"
                        className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md text-xs font-semibold px-3 py-1.5 flex items-center gap-1"
                        onClick={() => setIsEditing(false)}
                    >
                        <X className="w-3.5 h-3.5" /> Annuler
                    </button>
                    <button 
                        type="button"
                        disabled={!draft.displayName.trim()}
                        className={`rounded-md text-xs font-bold px-4 py-1.5 flex items-center gap-1 shadow-sm ${
                            draft.displayName.trim() 
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                        onClick={handleSave}
                    >
                        <Check className="w-3.5 h-3.5" /> Valider
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                    <select
                        className="w-full text-sm text-slate-900 font-semibold bg-white border border-slate-300 rounded-lg p-2.5 shadow-sm cursor-pointer focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                        value={recipientRef ? `${recipientRef.kind}:${recipientRef.id}` : ''}
                        onChange={handleChange}
                        autoComplete="off"
                        aria-label="Sélectionner un destinataire"
                    >
                        <option value="" className="text-slate-500 bg-white font-normal">-- Sélectionner un destinataire --</option>
                        {Object.entries(groupedCandidates).map(([groupLabel, list]) => {
                            if (list.length === 0) return null;
                            return (
                                <optgroup key={groupLabel} label={groupLabel} className="font-bold text-slate-700 bg-slate-100">
                                    {list.map(c => (
                                        <option key={`${c.kind}:${c.id}`} value={`${c.kind}:${c.id}`} className="text-slate-900 bg-white font-medium py-1">
                                            {c.displayName} {c.email ? `(${c.email})` : '(sans e-mail)'} - [{c.origin}]
                                        </option>
                                    ))}
                                </optgroup>
                            );
                        })}
                    </select>
                </div>
                <button 
                    type="button"
                    onClick={() => startEdit(selectedContact)}
                    className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg transition-colors bg-white shadow-sm shrink-0"
                    title="Créer ou modifier un contact"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            {selectedContact && (
                <div className="flex items-start gap-2.5 bg-indigo-50/60 border border-indigo-100 rounded-lg p-2.5 shadow-xs">
                    <User className="w-4 h-4 text-indigo-600 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">
                            {selectedContact.displayName}
                        </p>
                        {selectedContact.email && (
                            <p className="text-xs text-slate-600 truncate font-medium">{selectedContact.email}</p>
                        )}
                        {selectedContact.iban && (
                            <p className="text-xs font-mono text-slate-700 tracking-wide truncate">
                                {selectedContact.iban}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => startEdit(selectedContact)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-100 rounded-md shrink-0 transition-colors"
                        title="Modifier pour ce paiement"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {recipientRef && !selectedContact && recipientSnapshot && (
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                    ⚠ Contact source introuvable — snapshot figé utilisé : {recipientSnapshot.displayName}
                </span>
            )}
        </div>
    );
};

export default SingleRecipientSelector;
