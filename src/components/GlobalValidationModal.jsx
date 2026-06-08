import React, { useContext, useState, useMemo, useCallback } from 'react';
import { ExpertiseContext } from '../context/ExpertiseContext';

const FORM_FIELD_LABELS = {
    dateSinistre: 'Date du sinistre', dateDeclaration: 'Date de déclaration', declarant: 'Déclarant',
    nomCie: 'Compagnie', nomContrat: 'Contrat', numPolice: 'N° Police',
    numSinistreCie: 'N° Sinistre Cie', adresse: 'Adresse', cause: 'Cause'
};

const STATUT_OPTIONS = ['Locataire', 'Propriétaire occupant', 'Propriétaire non occupant', 'Syndic / Autre'];

// Deduplicate strict AI duplicates (same prestataire + same montant + same ref)
const deduplicateExpenses = (expenses) => {
    const seen = new Map();
    return expenses.filter(exp => {
        const key = `${(exp.prestataire||'').toLowerCase().trim()}|${(exp.montant||'')}|${(exp.ref||'').toLowerCase().trim()}`;
        if (seen.has(key)) return false;
        seen.set(key, true);
        return true;
    });
};

const deduplicateOccupants = (occupants) => {
    const seen = new Map();
    return occupants.filter(occ => {
        const key = (occ.nom || '').toLowerCase().trim();
        if (!key || seen.has(key)) return false;
        seen.set(key, true);
        return true;
    });
};

const GlobalValidationModal = () => {
    const { pendingAiData, setPendingAiData, commitPendingAiData, formData, occupants, expenses, handleAttachFile } = useContext(ExpertiseContext);

    // Editable deep copy of pendingAiData
    const [editableData, setEditableData] = useState(null);
    // Expanded row trackers
    const [expandedOcc, setExpandedOcc] = useState(new Set());
    const [expandedExp, setExpandedExp] = useState(new Set());
    // Conflict resolution actions: Map<aiOccId, 'update'|'add'|'ignore'>
    const [occActions, setOccActions] = useState(new Map());
    const [expActions, setExpActions] = useState(new Map());
    // Selected form fields
    const [selectedFormFields, setSelectedFormFields] = useState(new Set());
    const [initialized, setInitialized] = useState(false);

    // Analyze occupant conflicts
    const occupantAnalysis = useMemo(() => {
        if (!editableData?.occupants) return [];
        return editableData.occupants.map(aiOcc => {
            const match = occupants.find(o => o.nom && aiOcc.nom && o.nom.toLowerCase().trim() === aiOcc.nom.toLowerCase().trim());
            return { ...aiOcc, isDuplicate: !!match, existingId: match?.id || null, existingData: match || null };
        });
    }, [editableData?.occupants, occupants]);

    // Analyze expense conflicts
    const expenseAnalysis = useMemo(() => {
        if (!editableData?.expenses) return [];
        return editableData.expenses.map(aiExp => {
            const match = expenses.find(e => 
                e.prestataire && aiExp.prestataire && 
                e.prestataire.toLowerCase().trim() === aiExp.prestataire.toLowerCase().trim() &&
                (e.montantReclame || e.montant || '') === (aiExp.montant || '')
            );
            return { ...aiExp, isDuplicate: !!match, existingId: match?.id || null };
        });
    }, [editableData?.expenses, expenses]);

    // Initialize when pendingAiData arrives
    if (pendingAiData && !initialized) {
        const cleanOccs = deduplicateOccupants(pendingAiData.occupants || []);
        const cleanExps = deduplicateExpenses(pendingAiData.expenses || []);
        
        setEditableData({
            formData: pendingAiData.formData ? { ...pendingAiData.formData } : null,
            occupants: cleanOccs.map(o => ({ ...o })),
            expenses: cleanExps.map(e => ({ ...e }))
        });

        // FormData: select fields where current is empty or different
        const newFormFields = new Set();
        if (pendingAiData.formData) {
            Object.keys(pendingAiData.formData).forEach(key => {
                const aiVal = pendingAiData.formData[key];
                const currentVal = formData[key] || '';
                if (aiVal && aiVal !== '' && aiVal !== currentVal) newFormFields.add(key);
            });
        }
        setSelectedFormFields(newFormFields);

        // Set default actions
        const newOccActions = new Map();
        cleanOccs.forEach(occ => {
            const match = occupants.find(o => o.nom && occ.nom && o.nom.toLowerCase().trim() === occ.nom.toLowerCase().trim());
            newOccActions.set(occ.id, match ? 'update' : 'add');
        });
        setOccActions(newOccActions);

        const newExpActions = new Map();
        cleanExps.forEach(exp => {
            const match = expenses.find(e => 
                e.prestataire && exp.prestataire && 
                e.prestataire.toLowerCase().trim() === exp.prestataire.toLowerCase().trim() &&
                (e.montantReclame || e.montant || '') === (exp.montant || '')
            );
            newExpActions.set(exp.id, match ? 'update' : 'add');
        });
        setExpActions(newExpActions);

        setInitialized(true);
    }

    if (!pendingAiData && initialized) {
        setInitialized(false);
        setEditableData(null);
    }

    if (!pendingAiData || !editableData) return null;

    // -- Handlers --
    const toggleFormField = (key) => {
        setSelectedFormFields(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; });
    };

    const updateOccField = (occId, field, value) => {
        setEditableData(prev => ({
            ...prev,
            occupants: prev.occupants.map(o => o.id === occId ? { ...o, [field]: value } : o)
        }));
    };

    const updateExpField = (expId, field, value) => {
        setEditableData(prev => ({
            ...prev,
            expenses: prev.expenses.map(e => e.id === expId ? { ...e, [field]: value } : e)
        }));
    };

    const updateFormField = (key, value) => {
        setEditableData(prev => ({
            ...prev,
            formData: { ...prev.formData, [key]: value }
        }));
    };

    const handleValidate = () => {
        const selections = {
            formFields: Array.from(selectedFormFields),
            occupants: Array.from(occActions.entries())
                .filter(([, action]) => action !== 'ignore')
                .map(([id, action]) => {
                    const analysis = occupantAnalysis.find(o => o.id === id);
                    return { id, action, existingId: analysis?.existingId };
                }),
            expenses: Array.from(expActions.entries())
                .filter(([, action]) => action !== 'ignore')
                .map(([id]) => id)
        };

        // CRITICAL: Merge editableData INTO pendingAiData while PRESERVING pendingFiles
        setPendingAiData(prev => ({
            ...prev,                    // keeps pendingFiles, experts, etc.
            ...editableData             // overwrites formData, occupants, expenses with edited versions
        }));
        // Call commit on next tick so the merged state is available
        setTimeout(() => {
            commitPendingAiData(selections);
        }, 0);
    };

    const handleCancel = () => { setPendingAiData(null); };

    const toggleOccExpand = (id) => { setExpandedOcc(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
    const toggleExpExpand = (id) => { setExpandedExp(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };

    const hasFormData = editableData.formData && Object.keys(editableData.formData).some(k => editableData.formData[k] && editableData.formData[k] !== '');
    const hasOccupants = editableData.occupants && editableData.occupants.length > 0;
    const hasExpenses = editableData.expenses && editableData.expenses.length > 0;

    // Pending files for Magic Drop badges
    const pendingFiles = pendingAiData.pendingFiles || [];

    return (
        <div className="fixed inset-0 z-[250] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-slate-900 rounded-xl shadow-2xl border border-slate-700 w-full max-w-[750px] max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-slate-700 bg-gradient-to-r from-slate-800 to-indigo-900/50">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-2xl">🛡️</span> Sas de validation IA
                    </h2>
                    <p className="text-xs text-slate-300 mt-1">
                        Vérifiez et modifiez les données avant import. Cliquez sur une ligne pour éditer les détails.
                    </p>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Section 1: FormData */}
                    {hasFormData && (
                        <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                            <div className="p-3 bg-slate-800 border-b border-slate-700">
                                <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-1.5">📋 Informations Générales</h3>
                            </div>
                            <div className="p-3 space-y-1.5">
                                {Object.keys(editableData.formData).map(key => {
                                    const aiVal = editableData.formData[key];
                                    if (!aiVal || aiVal === '') return null;
                                    const currentVal = formData[key] || '';
                                    const isIdentical = currentVal === aiVal;
                                    const label = FORM_FIELD_LABELS[key] || key;
                                    return (
                                        <label key={key} className={`flex items-start gap-2.5 p-2 rounded transition-colors ${isIdentical ? 'opacity-40' : 'hover:bg-slate-700/50'}`}>
                                            <input type="checkbox" checked={selectedFormFields.has(key)} onChange={() => toggleFormField(key)} disabled={isIdentical}
                                                className="mt-1 w-4 h-4 rounded border-slate-500 bg-slate-700 text-indigo-500 focus:ring-0 shrink-0 cursor-pointer" />
                                            <div className="min-w-0 flex-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{label}</span>
                                                <div className="mt-0.5">
                                                    {currentVal && (
                                                        <div className="text-[10px] text-red-400/70 line-through mb-0.5">{currentVal}</div>
                                                    )}
                                                    <input type={key.startsWith('date') ? 'date' : 'text'} value={aiVal}
                                                        onChange={(e) => updateFormField(key, e.target.value)}
                                                        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-green-400 font-medium focus:border-indigo-500 outline-none" />
                                                </div>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Section 2: Occupants (Accordion) */}
                    {hasOccupants && (
                        <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                            <div className="p-3 bg-slate-800 border-b border-slate-700">
                                <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-1.5">
                                    👥 Occupants <span className="text-[10px] font-normal text-slate-400">({occupantAnalysis.length})</span>
                                </h3>
                            </div>
                            <div className="divide-y divide-slate-700/50">
                                {occupantAnalysis.map(occ => {
                                    const action = occActions.get(occ.id) || 'add';
                                    const isExpanded = expandedOcc.has(occ.id);
                                    const isIgnored = action === 'ignore';
                                    return (
                                        <div key={occ.id} className={`transition-colors ${isIgnored ? 'opacity-40 bg-slate-900/50' : ''}`}>
                                            {/* Summary row */}
                                            <div className="flex items-center gap-2 p-3 cursor-pointer hover:bg-slate-700/30" onClick={() => toggleOccExpand(occ.id)}>
                                                <span className="text-xs shrink-0">{isExpanded ? '▼' : '▶'}</span>
                                                <span className="text-sm font-bold text-white flex-1 truncate">{occ.nom || 'Sans nom'}</span>
                                                <span className="text-[10px] text-slate-400 shrink-0">{occ.statut}</span>
                                                {occ.isDuplicate && (
                                                    <span className="text-[9px] bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded font-bold border border-orange-500/30 shrink-0">⚠️ Conflit</span>
                                                )}
                                                {!occ.isDuplicate && !isIgnored && (
                                                    <span className="text-[9px] bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded font-bold border border-green-500/30 shrink-0">✨ Nouveau</span>
                                                )}
                                                <select value={action} onChange={(e) => { e.stopPropagation(); setOccActions(prev => new Map(prev).set(occ.id, e.target.value)); }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="bg-slate-800 border border-slate-600 text-[10px] text-white rounded px-1.5 py-1 shrink-0 focus:border-indigo-500 outline-none cursor-pointer">
                                                    {occ.isDuplicate && <option value="update">Mettre à jour</option>}
                                                    <option value="add">Créer nouveau</option>
                                                    <option value="ignore">Ignorer</option>
                                                </select>
                                            </div>
                                            {/* Expanded details */}
                                            {isExpanded && !isIgnored && (
                                                <div className="px-4 pb-3 pt-1 bg-slate-800/30 grid grid-cols-2 gap-2">
                                                    <div><label className="text-[9px] text-slate-500 uppercase">Nom</label><input type="text" value={occ.nom || ''} onChange={(e) => updateOccField(occ.id, 'nom', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                    <div><label className="text-[9px] text-slate-500 uppercase">Étage</label><input type="text" value={occ.etage || ''} onChange={(e) => updateOccField(occ.id, 'etage', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                    <div><label className="text-[9px] text-slate-500 uppercase">Statut</label>
                                                        <select value={occ.statut || 'Locataire'} onChange={(e) => updateOccField(occ.id, 'statut', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none">
                                                            {STATUT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                                        </select>
                                                    </div>
                                                    <div><label className="text-[9px] text-slate-500 uppercase">Téléphone</label><input type="text" value={occ.tel || ''} onChange={(e) => updateOccField(occ.id, 'tel', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                    <div><label className="text-[9px] text-slate-500 uppercase">Email</label><input type="email" value={occ.email || ''} onChange={(e) => updateOccField(occ.id, 'email', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                    <div><label className="text-[9px] text-slate-500 uppercase">RC</label>
                                                        <select value={occ.rc || 'Non'} onChange={(e) => updateOccField(occ.id, 'rc', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none">
                                                            <option value="Oui">Oui</option><option value="Non">Non</option>
                                                        </select>
                                                    </div>
                                                    {occ.rc === 'Oui' && (
                                                        <div><label className="text-[9px] text-slate-500 uppercase">N° Police RC</label><input type="text" value={occ.rcPolice || ''} onChange={(e) => updateOccField(occ.id, 'rcPolice', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                    )}
                                                    <div><label className="text-[9px] text-slate-500 uppercase">2ème Assurance</label>
                                                        <select value={occ.secAssurance || 'Non'} onChange={(e) => updateOccField(occ.id, 'secAssurance', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none">
                                                            <option value="Oui">Oui</option><option value="Non">Non</option>
                                                        </select>
                                                    </div>
                                                    {occ.secAssurance === 'Oui' && (
                                                        <>
                                                            <div><label className="text-[9px] text-slate-500 uppercase">Type 2ème</label><input type="text" value={occ.secType || ''} onChange={(e) => updateOccField(occ.id, 'secType', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                            <div><label className="text-[9px] text-slate-500 uppercase">N° Police 2ème</label><input type="text" value={occ.secPolice || ''} onChange={(e) => updateOccField(occ.id, 'secPolice', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                            <div><label className="text-[9px] text-slate-500 uppercase">Cie 2ème</label><input type="text" value={occ.secCie || ''} onChange={(e) => updateOccField(occ.id, 'secCie', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Section 3: Expenses (Accordion) */}
                    {hasExpenses && (
                        <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                            <div className="p-3 bg-slate-800 border-b border-slate-700">
                                <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-1.5">
                                    💰 Frais <span className="text-[10px] font-normal text-slate-400">({expenseAnalysis.length})</span>
                                </h3>
                            </div>
                            <div className="divide-y divide-slate-700/50">
                                {expenseAnalysis.map(exp => {
                                    const action = expActions.get(exp.id) || 'add';
                                    const isExpanded = expandedExp.has(exp.id);
                                    const isIgnored = action === 'ignore';
                                    const matchedFile = pendingFiles.find(f => f.name === exp.sourceFileName);
                                    return (
                                        <div key={exp.id} className={`transition-colors ${isIgnored ? 'opacity-40 bg-slate-900/50' : ''}`}>
                                            {/* Summary row */}
                                            <div className="flex items-center gap-2 p-3 cursor-pointer hover:bg-slate-700/30" onClick={() => toggleExpExpand(exp.id)}>
                                                <span className="text-xs shrink-0">{isExpanded ? '▼' : '▶'}</span>
                                                <span className="text-sm font-bold text-white truncate">{exp.prestataire || 'Inconnu'}</span>
                                                <span className="text-xs text-emerald-400 font-bold shrink-0">{exp.montant || exp.montantReclame || '?'}</span>
                                                <span className="text-[9px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded shrink-0">{exp.typeMontant || 'HTVA'}</span>
                                                {matchedFile && (
                                                    <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-bold border border-blue-500/30 shrink-0" title={matchedFile.name}>
                                                        📎 {matchedFile.name.length > 20 ? matchedFile.name.slice(0, 20) + '…' : matchedFile.name}
                                                    </span>
                                                )}
                                                {exp.isDuplicate && (
                                                    <span className="text-[9px] bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded font-bold border border-orange-500/30 shrink-0">⚠️ Conflit</span>
                                                )}
                                                <select value={action} onChange={(e) => { e.stopPropagation(); setExpActions(prev => new Map(prev).set(exp.id, e.target.value)); }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="bg-slate-800 border border-slate-600 text-[10px] text-white rounded px-1.5 py-1 shrink-0 focus:border-indigo-500 outline-none cursor-pointer ml-auto">
                                                    {exp.isDuplicate && <option value="update">Mettre à jour</option>}
                                                    <option value="add">Créer nouveau</option>
                                                    <option value="ignore">Ignorer</option>
                                                </select>
                                            </div>
                                            {/* Expanded details */}
                                            {isExpanded && !isIgnored && (
                                                <div className="px-4 pb-3 pt-1 bg-slate-800/30 grid grid-cols-2 gap-2">
                                                    <div><label className="text-[9px] text-slate-500 uppercase">Prestataire</label><input type="text" value={exp.prestataire || ''} onChange={(e) => updateExpField(exp.id, 'prestataire', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                    <div><label className="text-[9px] text-slate-500 uppercase">Type</label>
                                                        <select value={exp.type || 'Facture'} onChange={(e) => updateExpField(exp.id, 'type', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none">
                                                            <option value="Facture">Facture</option><option value="Devis">Devis</option>
                                                        </select>
                                                    </div>
                                                    <div><label className="text-[9px] text-slate-500 uppercase">Référence</label><input type="text" value={exp.ref || ''} onChange={(e) => updateExpField(exp.id, 'ref', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                    <div><label className="text-[9px] text-slate-500 uppercase">Montant (HTVA)</label><input type="text" value={exp.montant || ''} onChange={(e) => updateExpField(exp.id, 'montant', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                    <div className="col-span-2"><label className="text-[9px] text-slate-500 uppercase">Description</label><textarea value={exp.desc || ''} onChange={(e) => updateExpField(exp.id, 'desc', e.target.value)} rows={2} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none resize-none" /></div>
                                                    {matchedFile && (
                                                        <div className="col-span-2 bg-blue-900/20 border border-blue-500/30 rounded p-2 flex items-center gap-2">
                                                            <span className="text-sm">📎</span>
                                                            <span className="text-[10px] text-blue-300 font-medium">Pièce jointe : {matchedFile.name}</span>
                                                            <span className="text-[9px] text-slate-500 ml-auto">Sera attachée automatiquement</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700 bg-slate-800 flex items-center justify-between gap-3">
                    <div className="text-[10px] text-slate-500">
                        {occupantAnalysis.filter(o => occActions.get(o.id) !== 'ignore').length} occupants · {expenseAnalysis.filter(e => expActions.get(e.id) !== 'ignore').length} frais à importer
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleCancel} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded transition-colors">
                            ❌ Annuler
                        </button>
                        <button onClick={handleValidate} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded transition-colors shadow-lg shadow-indigo-500/20">
                            ✅ Valider et importer
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GlobalValidationModal;
