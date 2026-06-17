import React, { useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { ExpertiseContext } from '../context/ExpertiseContext';
import { refineText, extractAdministrativeData, runMergeAgent } from '../services/aiManager';
import { useDatasetStore } from '../store/datasetStore';

const FORM_FIELD_LABELS = {
    dateSinistre: 'Date du sinistre', dateDeclaration: 'Date de déclaration', declarant: 'Déclarant',
    nomCie: 'Compagnie', nomContrat: 'Contrat', numPolice: 'N° Police',
    numSinistreCie: 'N° Sinistre Cie', adresse: 'Adresse', cause: 'Cause'
};

const STATUT_OPTIONS = ['Locataire', 'Propriétaire occupant', 'Propriétaire non occupant', 'Propriétaire (occupation inconnue)', 'ACP'];

// v7.0.0 - Fix critique : la clé utilisait exp.montant (champ disparu depuis v5.x)
// Désormais on utilise montantReclame || montant pour compatibilité
const deduplicateExpenses = (expenses) => {
    const seen = new Map();
    return expenses.filter(exp => {
        const montant = (exp.montantReclame || exp.montant || '').toString().trim();
        const key = `${(exp.prestataire||'').toLowerCase().trim()}|${montant}|${(exp.ref||'').toLowerCase().trim()}`;
        if (seen.has(key)) return false;
        seen.set(key, true);
        return true;
    });
};

// v7.0.0 - Fuzzy matching : normalise les noms en enlevant civilités, espaces multiples, met en majuscules
// Exemples : "M. Jean-Pierre Dupont" → "DUPONT", "Mme DUBOIS" → "DUBOIS", "dupont" → "DUPONT"
const normalizeOccName = (name) => {
    if (!name) return '';
    return name
        .replace(/^(M\.|Mme\.?|Mr\.?|Mlle\.?|Dr\.?|Me\.?)\s*/i, '') // Enlève civilités
        .split(/[\s,]+/)[0]  // Garde uniquement le premier token (nom de famille)
        .toUpperCase()
        .trim();
};

const deduplicateOccupants = (occupants) => {
    const seen = new Map();
    return occupants.filter(occ => {
        const key = normalizeOccName(occ.nom);
        if (!key || seen.has(key)) return false;
        seen.set(key, true);
        return true;
    });
};

// v7.0.0 - Matcher fuzzy pour comparer un occupant IA avec les occupants existants
const fuzzyMatchOccupant = (aiOcc, existingOccs) => {
    const aiKey = normalizeOccName(aiOcc.nom);
    if (!aiKey) return null;
    return existingOccs.find(o => {
        const existKey = normalizeOccName(o.nom);
        return existKey && (existKey === aiKey || existKey.includes(aiKey) || aiKey.includes(existKey));
    }) || null;
};

// v7.0.0 - Matcher fuzzy pour comparer un frais IA avec les frais existants
const fuzzyMatchExpense = (aiExp, existingExps) => {
    const aiPrestataire = (aiExp.prestataire || '').toLowerCase().trim();
    const aiMontant = (aiExp.montantReclame || aiExp.montant || '').toString().trim();
    if (!aiPrestataire) return null;
    return existingExps.find(e => {
        const existPrestataire = (e.prestataire || '').toLowerCase().trim();
        const existMontant = (e.montantReclame || e.montant || '').toString().trim();
        // Match si le prestataire est inclus dans l'autre + même montant
        const prestaMatch = existPrestataire.includes(aiPrestataire) || aiPrestataire.includes(existPrestataire);
        const montantMatch = !aiMontant || !existMontant || aiMontant === existMontant;
        return prestaMatch && montantMatch;
    }) || null;
};

const GlobalValidationModal = () => {
    const { pendingAiData, setPendingAiData, commitPendingAiData, formData, occupants, expenses, handleAttachFile, expertsList, aiConfig, franchises } = useContext(ExpertiseContext);

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
    const [selectedExperts, setSelectedExperts] = useState(new Set());
    // v5.6.0 - Intervenants (tous DÉCOCHÉS par défaut)
    const [selectedIntervenants, setSelectedIntervenants] = useState(new Set());
    // v5.6.1 - Refining state
    // v5.6.1 - Refining state
    const [refiningField, setRefiningField] = useState(null); // 'cause' | 'divers' | 'compteRendu' | null
    const [attachedCpFile, setAttachedCpFile] = useState(null);
    const [initialized, setInitialized] = useState(false);
    const [isMerging, setIsMerging] = useState(false);

    // v7.2.1 - Feedback Dataset
    const [feedbackOptions, setFeedbackOptions] = useState({
        adminErr: false,
        socialErr: false,
        financeErr: false,
        fusionErr: false
    });
    const [feedbackNote, setFeedbackNote] = useState('');
    const toggleFeedback = (key) => setFeedbackOptions(prev => ({ ...prev, [key]: !prev[key] }));

    // v7.0.0 - Analyze occupant conflicts avec fuzzy matching
    const occupantAnalysis = useMemo(() => {
        if (!editableData?.occupants) return [];
        return editableData.occupants.map(aiOcc => {
            const match = fuzzyMatchOccupant(aiOcc, occupants);
            return { ...aiOcc, isDuplicate: !!match, existingId: match?.id || null, existingData: match || null };
        });
    }, [editableData?.occupants, occupants]);

    // v7.0.0 - Analyze expense conflicts avec fuzzy matching
    const expenseAnalysis = useMemo(() => {
        if (!editableData?.expenses) return [];
        return editableData.expenses.map(aiExp => {
            const match = fuzzyMatchExpense(aiExp, expenses);
            return { ...aiExp, isDuplicate: !!match, existingId: match?.id || null };
        });
    }, [editableData?.expenses, expenses]);

    // Initialize when pendingAiData arrives
    if (pendingAiData && !initialized) {
        const cleanOccs = deduplicateOccupants(pendingAiData.occupants || []);
        const rawExps = deduplicateExpenses(pendingAiData.expenses || []);
        
        // Ticket D: Matching Intelligent du compteDe
        const cleanExps = rawExps.map(exp => {
            let matchedCompteDe = exp.compteDe || 'unassigned';
            if (matchedCompteDe !== 'unassigned' && matchedCompteDe.trim() !== '') {
                const searchName = matchedCompteDe.toLowerCase().trim();
                const match = occupants.find(o => o.nom && (searchName.includes(o.nom.toLowerCase().trim()) || o.nom.toLowerCase().trim().includes(searchName)));
                if (match) {
                    matchedCompteDe = match.id;
                }
            }
            return { ...exp, compteDe: matchedCompteDe };
        });
        
        setEditableData({
            formData: pendingAiData.formData ? { ...pendingAiData.formData } : null,
            occupants: cleanOccs.map(o => ({ ...o })),
            expenses: cleanExps.map(e => ({ ...e }))
        });

        // FormData: select fields where current is empty or different
        const newFormFields = new Set();
        if (pendingAiData.formData) {
            Object.keys(pendingAiData.formData).forEach(key => {
                const aiVal = pendingAiData.formData[key] ?? '';
                const currentVal = formData[key] ?? '';
                
                const aiValStr = String(aiVal);
                const currentValStr = String(currentVal);
                
                if (aiValStr.trim() !== '') {
                    if (currentValStr.trim() === '') {
                        // New value
                        newFormFields.add(key);
                    } else if (aiValStr.trim() !== currentValStr.trim()) {
                        // Modified value
                        newFormFields.add(key);
                    }
                }
            });
        }
        setSelectedFormFields(newFormFields);

        // Experts: select new ones by default (v5.5.10)
        const aiExperts = pendingAiData.experts || [];
        const newSelectedExperts = new Set();
        aiExperts.forEach(exp => {
            if (exp.nom && !expertsList.some(e => (e.nom || '').toLowerCase().trim() === (exp.nom || '').toLowerCase().trim())) {
                newSelectedExperts.add((exp.nom || '').trim());
            }
        });
        setSelectedExperts(newSelectedExperts);

        // v7.0.0 - Set default actions avec fuzzy matching
        const newOccActions = new Map();
        cleanOccs.forEach(occ => {
            const match = fuzzyMatchOccupant(occ, occupants);
            // Par défaut : conflit → 'ignore' (non coché), nouveau → 'add'
            newOccActions.set(occ.id, match ? 'ignore' : 'add');
        });
        setOccActions(newOccActions);

        const newExpActions = new Map();
        cleanExps.forEach(exp => {
            const match = fuzzyMatchExpense(exp, expenses);
            // Par défaut : conflit → 'ignore' (non coché), nouveau → 'add'
            newExpActions.set(exp.id, match ? 'ignore' : 'add');
        });
        setExpActions(newExpActions);

        // v5.6.0 - Intervenants : TOUS décochés par défaut
        setSelectedIntervenants(new Set());

        setInitialized(true);
    }

    if (!pendingAiData && initialized) {
        setInitialized(false);
        setEditableData(null);
        setSelectedIntervenants(new Set());
        setFeedbackNote('');
        setFeedbackOptions({ adminErr: false, socialErr: false, financeErr: false, fusionErr: false });
        setAttachedCpFile(null);
    }

    if (!pendingAiData || !editableData) return null;

    // -- Handlers --

    const handleMagicMerge = async () => {
        setIsMerging(true);
        try {
            const res = await runMergeAgent(editableData.occupants, editableData.expenses);
            if (res.success && res.data) {
                setEditableData(prev => ({
                    ...prev,
                    occupants: res.data.occupants || prev.occupants,
                    expenses: res.data.expenses || prev.expenses
                }));
                // Mettre à jour les actions par défaut
                const newOccActions = new Map(occActions);
                (res.data.occupants || []).forEach(occ => newOccActions.set(occ.id, 'add'));
                setOccActions(newOccActions);
                
                const newExpActions = new Map(expActions);
                (res.data.expenses || []).forEach(exp => newExpActions.set(exp.id, 'add'));
                setExpActions(newExpActions);
            } else {
                alert("Erreur lors du nettoyage : " + (res.error || "Inconnue"));
            }
        } catch (e) {
            console.error("Magic Merge error", e);
            alert("Erreur critique lors du nettoyage IA.");
        } finally {
            setIsMerging(false);
        }
    };

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
            experts: Array.from(selectedExperts),
            occupants: Array.from(occActions.entries())
                .filter(([, action]) => action !== 'ignore')
                .map(([id, action]) => {
                    const analysis = occupantAnalysis.find(o => o.id === id);
                    return { id, action, existingId: analysis?.existingId };
                }),
            expenses: Array.from(expActions.entries())
                .filter(([, action]) => action !== 'ignore')
                .map(([id]) => id),
            // v5.6.0 - Intervenants sélectionnés (cochés manuellement)
            intervenants: Array.from(selectedIntervenants)
        };

        // v5.4.0: Merge editableData INTO pendingAiData synchronously, EXPLICITLY preserving pendingFiles
        const mergedData = {
            ...pendingAiData,               // preserves pendingFiles, experts, intervenants, etc.
            ...editableData,                // overwrites formData, occupants, expenses with edited versions
            intervenants: pendingAiData.intervenants || [],  // preserve original intervenants
            pendingFiles: pendingAiData.pendingFiles || []  // explicit safety net
        };

        // v7.4.5 - Golden Dataset: TOUJOURS sauvegarder un record à chaque validation
        {
            const { addRecord } = useDatasetStore.getState();
            const hasFeedback = Object.values(feedbackOptions).some(Boolean) || feedbackNote.trim() !== '';
            const activeCategories = Object.entries(feedbackOptions)
                .filter(([, isChecked]) => isChecked)
                .map(([key]) => key);

            const rawInputText = typeof pendingAiData?._rawInputText === 'string' && pendingAiData._rawInputText.trim().length > 0
                ? pendingAiData._rawInputText
                : "TEXTE_NON_CAPTURE";

            if (rawInputText === "TEXTE_NON_CAPTURE") {
                console.warn("[GoldenDataset] _rawInputText manquant dans pendingAiData", pendingAiData);
            }
                
            addRecord({
                feedback: hasFeedback ? {
                    categories: activeCategories,
                    note: feedbackNote.trim()
                } : null,
                inputText: rawInputText,
                aiOutput: {
                    formData: pendingAiData.formData,
                    occupants: pendingAiData.occupants,
                    expenses: pendingAiData.expenses,
                    intervenants: pendingAiData.intervenants,
                    experts: pendingAiData.experts
                },
                userCorrection: {
                    formData: editableData.formData,
                    occupants: editableData.occupants.map(o => ({ ...o, _status: selections.occupants.some(sel => sel.id === o.id) ? 'kept' : 'rejected' })),
                    expenses: editableData.expenses.map(e => ({ ...e, _status: selections.expenses.includes(e.id) ? 'kept' : 'rejected' })),
                    intervenants: (pendingAiData.intervenants || []).map(i => ({ ...i, _status: selections.intervenants.includes(i.id) ? 'kept' : 'rejected' })),
                    experts: (pendingAiData.experts || []).map(e => ({ ...e, _status: selections.experts.includes(e.id) ? 'kept' : 'rejected' }))
                }
            });
            console.log("[GoldenDataset] ✅ Record sauvegardé", { hasFeedback, rawInputTextLength: rawInputText.length });
        }

        setPendingAiData(mergedData);

        // Call commit with the merged data directly — bypasses React state async delay
        commitPendingAiData(selections, mergedData);
    };

    const handleCancel = () => { setPendingAiData(null); };

    const toggleOccExpand = (id) => { setExpandedOcc(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
    const toggleExpExpand = (id) => { setExpandedExp(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };

    const removeOccupant = (e, id) => {
        e.stopPropagation();
        setEditableData(prev => ({ ...prev, occupants: prev.occupants.filter(o => o.id !== id) }));
    };

    const removeExpense = (e, id) => {
        e.stopPropagation();
        setEditableData(prev => ({ ...prev, expenses: prev.expenses.filter(x => x.id !== id) }));
    };

    const hasFormData = editableData.formData && Object.keys(editableData.formData).some(k => editableData.formData[k] && editableData.formData[k] !== '');
    const hasOccupants = editableData.occupants && editableData.occupants.length > 0;
    const hasExpenses = editableData.expenses && editableData.expenses.length > 0;
    const aiExperts = pendingAiData.experts || [];
    const hasExperts = aiExperts.length > 0;
    // v5.6.0 - Intervenants
    const aiIntervenants = pendingAiData.intervenants || [];
    const hasIntervenants = aiIntervenants.length > 0;
    const toggleIntervenant = (id) => {
        setSelectedIntervenants(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    };

    // Pending files for Magic Drop badges
    const pendingFiles = pendingAiData.pendingFiles || [];
    // Count pending photos (images not matched to expenses)
    const pendingPhotoCount = pendingFiles.filter(f => f.type && f.type.startsWith('image/')).length;

    const toggleExpert = (name) => {
        setSelectedExperts(prev => { const n = new Set(prev); if (n.has(name)) n.delete(name); else n.add(name); return n; });
    };

    // v5.6.6 - Condition d'alerte pour Franchise et Pertes Indirectes
    const isFranchiseMissing = !(editableData?.formData?.franchise || formData?.franchise);
    const isPertesMissing = !(editableData?.formData?.pertesIndirectes || formData?.pertesIndirectes);
    const showMissingWarning = isFranchiseMissing || isPertesMissing;

    return (
        <div className="fixed inset-0 z-[250] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-slate-900 rounded-xl shadow-2xl border border-slate-700 w-full max-w-[750px] max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b border-slate-700 bg-gradient-to-r from-slate-800 to-indigo-900/50 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <span className="text-2xl">🛡️</span> Sas de validation IA
                        </h2>
                        <p className="text-xs text-slate-300 mt-1">
                            Vérifiez et modifiez les données avant import. Cliquez sur une ligne pour éditer les détails.
                        </p>
                    </div>
                    <button 
                        onClick={handleMagicMerge} 
                        disabled={isMerging}
                        className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-2 shadow-lg"
                        title="Déléguer à l'IA la fusion des doublons restants"
                    >
                        {isMerging ? '⏳ Nettoyage...' : '✨ Nettoyage Magique IA'}
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Warning v5.6.6 */}
                    {showMissingWarning && (
                        <div className="bg-orange-100 border-l-4 border-orange-500 p-4 rounded-r text-orange-800 text-xs shadow-sm mb-4">
                            <strong>⚠️ Attention :</strong> Des données contractuelles importantes semblent manquer (
                            {[isFranchiseMissing && 'Franchise', isPertesMissing && 'Pertes indirectes'].filter(Boolean).join(' et ')}
                            ). Veuillez les insérer :

                            <div className="mt-3 grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-orange-800 mb-1">Franchise</label>
                                    <input 
                                        type="text" 
                                        value={editableData?.formData?.franchise || ''} 
                                        onChange={(e) => {
                                            updateFormField('franchise', e.target.value);
                                            if (e.target.value) setSelectedFormFields(prev => new Set(prev).add('franchise'));
                                        }}
                                        list="franchise-list-warning"
                                        className="w-full bg-orange-50/50 border border-orange-300 rounded px-2 py-1.5 text-xs focus:border-orange-500 outline-none" 
                                        placeholder="Ex: Légale..."
                                    />
                                    <datalist id="franchise-list-warning">
                                        {(franchises || []).map((f, idx) => <option key={idx} value={f} />)}
                                    </datalist>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-orange-800 mb-1">Pertes indirectes</label>
                                    <select 
                                        value={editableData?.formData?.pertesIndirectes || ''} 
                                        onChange={(e) => {
                                            updateFormField('pertesIndirectes', e.target.value);
                                            if (e.target.value) setSelectedFormFields(prev => new Set(prev).add('pertesIndirectes'));
                                        }}
                                        className="w-full bg-orange-50/50 border border-orange-300 rounded px-2 py-1.5 text-xs focus:border-orange-500 outline-none"
                                    >
                                        <option value="">Sélectionner...</option>
                                        <option value="0%">0%</option>
                                        <option value="5%">5%</option>
                                        <option value="10%">10%</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-orange-800 mb-1">Joindre le document des Conditions Particulières (CP) :</label>
                                    <div 
                                        className={`border-2 border-dashed border-orange-300 rounded p-3 bg-orange-50/50 flex items-center justify-between transition-colors ${attachedCpFile ? 'border-green-400 bg-green-50' : 'hover:border-orange-500'}`}
                                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        onDrop={(e) => {
                                            e.preventDefault(); e.stopPropagation();
                                            const file = e.dataTransfer.files?.[0];
                                            if (file) {
                                                handleAttachFile('doc_cond_part', file);
                                                setAttachedCpFile(file);
                                            }
                                        }}
                                    >
                                        {!attachedCpFile ? (
                                            <div className="w-full flex items-center justify-between">
                                                <span className="text-xs text-orange-700/70">Glisser le fichier ici ou</span>
                                                <input 
                                                    type="file" 
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            handleAttachFile('doc_cond_part', file);
                                                            setAttachedCpFile(file);
                                                        }
                                                    }}
                                                    className="text-xs file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-orange-500 file:text-white hover:file:bg-orange-600 cursor-pointer w-auto"
                                                />
                                            </div>
                                        ) : (
                                            <div className="w-full flex items-center justify-between">
                                                <span className="text-xs font-bold text-green-700 truncate max-w-[80%] flex items-center gap-2">
                                                    ✅ {attachedCpFile.name}
                                                </span>
                                                <button 
                                                    onClick={() => window.open(URL.createObjectURL(attachedCpFile), '_blank')}
                                                    className="bg-slate-800 hover:bg-slate-700 text-white p-1.5 rounded flex items-center justify-center transition-colors shadow"
                                                    title="Ouvrir pour voir"
                                                >
                                                    👁️
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Section 1: FormData */}
                    {hasFormData && (
                        <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                            <div className="p-3 bg-slate-800 border-b border-slate-700">
                                <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-1.5">📋 Informations Générales</h3>
                            </div>
                            <div className="p-3 space-y-1.5">
                                {Object.keys(editableData.formData).map(key => {
                                    const aiVal = editableData.formData[key];
                                    const originalAiVal = pendingAiData?.formData?.[key];
                                    if (key === 'refPechard' || key === 'bureau') return null;
                                    if (!aiVal && !originalAiVal && !selectedFormFields.has(key)) return null;
                                    const currentVal = formData[key] || '';
                                    const isIdentical = currentVal === aiVal;
                                    const label = FORM_FIELD_LABELS[key] || key;
                                    // v5.6.1 - Détecter les champs narratifs pour le Refining
                                    const isNarrativeField = ['cause', 'divers'].includes(key);
                                    return (
                                        <div key={key} onClick={() => !isIdentical && toggleFormField(key)} className={`flex items-start gap-2.5 p-2 rounded transition-colors ${isIdentical ? 'opacity-40' : 'hover:bg-slate-700/50 cursor-pointer'}`}>
                                            <input type="checkbox" checked={selectedFormFields.has(key)} onChange={() => {}} disabled={isIdentical}
                                                className="mt-1 w-4 h-4 rounded border-slate-500 bg-slate-700 text-indigo-500 focus:ring-0 shrink-0 pointer-events-none" />
                                            <div className="min-w-0 flex-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">{label}</span>
                                                <div className="mt-0.5">
                                                    {currentVal && (
                                                        <div className="text-[10px] text-red-400/70 line-through mb-0.5">{currentVal}</div>
                                                    )}
                                                    {isNarrativeField ? (
                                                        <>
                                                            <textarea value={aiVal}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onChange={(e) => updateFormField(key, e.target.value)}
                                                                rows={key === 'cause' ? 6 : 3}
                                                                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-green-400 font-medium focus:border-indigo-500 outline-none resize-y" />
                                                            {key === 'cause' && pendingAiData.technicalFilesToAttach?.length > 0 && (
                                                                <div className="mt-2 text-[10px] text-blue-300 bg-blue-900/20 p-1.5 rounded border border-blue-500/30 flex items-center gap-1.5">
                                                                    <span className="text-sm">📎</span>
                                                                    <span>{pendingAiData.technicalFilesToAttach.length} document(s) technique(s) identifié(s) par l'IA. Sera(ont) annexé(s) à la Cause.</span>
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <input type={key.startsWith('date') ? 'date' : 'text'} value={aiVal}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onChange={(e) => updateFormField(key, e.target.value)}
                                                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-green-400 font-medium focus:border-indigo-500 outline-none" />
                                                    )}
                                                    {/* v5.6.1 - Boutons de Refining pour les champs narratifs */}
                                                    {isNarrativeField && aiVal && aiVal.length > 10 && (
                                                        <div className="flex gap-1.5 mt-1.5">
                                                            {[
                                                                { directive: 'DEVELOP', icon: '+', label: 'Développer', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' },
                                                                { directive: 'SUMMARIZE', icon: '−', label: 'Résumer', cls: 'bg-sky-500/10 text-sky-400 border-sky-500/30 hover:bg-sky-500/20' },
                                                                { directive: 'TECH_FOCUS', icon: '🔧', label: 'Technique', cls: 'bg-violet-500/10 text-violet-400 border-violet-500/30 hover:bg-violet-500/20' },
                                                                { directive: 'CONTEXT_FOCUS', icon: '👥', label: 'Contexte', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20' },
                                                                { directive: 'REWRITE', icon: '🔄', label: 'Réécriture', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/30 hover:bg-blue-500/20' }
                                                            ].map(btn => (
                                                                <button
                                                                    key={btn.directive}
                                                                    disabled={refiningField !== null}
                                                                    onClick={async (e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        setRefiningField(key);
                                                                        const result = await refineText(aiVal, btn.directive, aiConfig?.apiKey);
                                                                        if (result.success) {
                                                                            updateFormField(key, result.text);
                                                                        } else {
                                                                            console.warn(`[Refine] Échec ${btn.directive}:`, result.error);
                                                                            alert(`Erreur lors de la réécriture : ${result.error}`);
                                                                        }
                                                                        setRefiningField(null);
                                                                    }}
                                                                    className={`text-[9px] px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                                                                        refiningField === key
                                                                            ? 'bg-slate-700 text-slate-500 border-slate-600 cursor-wait'
                                                                            : btn.cls
                                                                    } ${refiningField !== null && refiningField !== key ? 'opacity-50' : ''}`}
                                                                >
                                                                    {refiningField === key ? '⏳' : btn.icon} {btn.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Section 2: Experts (v5.5.10) */}
                    {hasExperts && (
                        <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                            <div className="p-3 bg-slate-800 border-b border-slate-700">
                                <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-1.5">🧑‍💼 Experts <span className="text-[10px] font-normal text-slate-400">({aiExperts.length})</span></h3>
                            </div>
                            <div className="p-3 space-y-1.5">
                                {aiExperts.map((exp, idx) => {
                                    const name = (exp.nom || '').trim();
                                    const isAlreadyKnown = expertsList.some(e => (e.nom || '').toLowerCase().trim() === name.toLowerCase());
                                    return (
                                        <label key={idx} className={`flex items-center gap-2.5 p-2 rounded transition-colors ${isAlreadyKnown ? 'opacity-40' : 'hover:bg-slate-700/50'}`}>
                                            <input type="checkbox" checked={selectedExperts.has(name)} onChange={() => toggleExpert(name)} disabled={isAlreadyKnown}
                                                className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-indigo-500 focus:ring-0 shrink-0 cursor-pointer" />
                                            <div className="min-w-0 flex-1">
                                                <span className="text-xs font-bold text-white">{name || 'Sans nom'}</span>
                                                {exp.tel && <span className="text-[10px] text-slate-400 ml-2">📞 {exp.tel}</span>}
                                            </div>
                                            {isAlreadyKnown && (
                                                <span className="text-[9px] bg-slate-600/30 text-slate-400 px-1.5 py-0.5 rounded border border-slate-600/30 shrink-0">Déjà connu</span>
                                            )}
                                            {!isAlreadyKnown && (
                                                <span className="text-[9px] bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded font-bold border border-green-500/30 shrink-0">✨ Nouveau</span>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Section 3: Occupants (Accordion) */}
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
                                                <button onClick={(e) => removeOccupant(e, occ.id)} className="text-slate-500 hover:text-red-400 p-1" title="Supprimer de la liste">🗑️</button>
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
                                                    <div className="col-span-2"><label className="text-[9px] text-slate-500 uppercase">IBAN</label><input type="text" value={occ.iban || ''} onChange={(e) => updateOccField(occ.id, 'iban', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none font-mono" placeholder="BE..." /></div>
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

                    {/* Section 3.5: Intervenants (v5.6.0) — DÉCOCHÉS par défaut */}
                    {hasIntervenants && (
                        <div className="bg-slate-800/50 rounded-lg border border-amber-700/50 overflow-hidden">
                            <div className="p-3 bg-slate-800 border-b border-amber-700/50">
                                <h3 className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                                    🤝 Autres Intervenants <span className="text-[10px] font-normal text-slate-400">({aiIntervenants.length})</span>
                                    <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 ml-auto">⚠️ Cochez pour conserver</span>
                                </h3>
                            </div>
                            <div className="p-3 space-y-1.5">
                                {aiIntervenants.map(inter => {
                                    const isChecked = selectedIntervenants.has(inter.id);
                                    return (
                                        <label key={inter.id} className={`flex items-center gap-2.5 p-2 rounded transition-colors hover:bg-slate-700/50 ${isChecked ? '' : 'opacity-60'}`}>
                                            <input type="checkbox" checked={isChecked} onChange={() => toggleIntervenant(inter.id)}
                                                className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-amber-500 focus:ring-0 shrink-0 cursor-pointer" />
                                            <div className="min-w-0 flex-1">
                                                <span className="text-xs font-bold text-white">{inter.nom || ''} {inter.prenom || ''}</span>
                                                {inter.role && <span className="text-[10px] text-amber-400 ml-2">({inter.role})</span>}
                                                {inter.societe && <span className="text-[10px] text-slate-400 ml-1">— {inter.societe}</span>}
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                {inter.tel && <span className="text-[10px] text-slate-400">📞 {inter.tel}</span>}
                                                {inter.email && <span className="text-[10px] text-slate-400">✉️ {inter.email}</span>}
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    {/* Section 4: Expenses (Accordion) */}
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
                                                {exp.compteDe && exp.compteDe !== 'unassigned' && occupants.find(o => o.id === exp.compteDe) && (
                                                    <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded font-bold border border-purple-500/30 shrink-0" title="Bénéficiaire assigné par l'IA">
                                                        👤 {occupants.find(o => o.id === exp.compteDe).nom}
                                                    </span>
                                                )}
                                                {matchedFile && (
                                                    <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-bold border border-blue-500/30 shrink-0 flex items-center gap-1" title={matchedFile.name}>
                                                        📎 {matchedFile.name.length > 20 ? matchedFile.name.slice(0, 20) + '…' : matchedFile.name}
                                                        <button onClick={(e) => { e.stopPropagation(); window.open(URL.createObjectURL(matchedFile)); }} className="hover:text-white cursor-pointer ml-1" title="Voir la pièce jointe">👁️</button>
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
                                                <button onClick={(e) => removeExpense(e, exp.id)} className="text-slate-500 hover:text-red-400 p-1" title="Supprimer de la liste">🗑️</button>
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
                                                    <div><label className="text-[9px] text-slate-500 uppercase">Montant (HTVA)</label><input type="text" value={exp.montant || exp.montantReclame || ''} onChange={(e) => updateExpField(exp.id, 'montant', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                    <div className="col-span-2"><label className="text-[9px] text-slate-500 uppercase">Description</label><textarea value={exp.desc || ''} onChange={(e) => updateExpField(exp.id, 'desc', e.target.value)} rows={2} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none resize-none" /></div>
                                                    {matchedFile && (
                                                        <div className="col-span-2 bg-blue-900/20 border border-blue-500/30 rounded p-2 flex items-center gap-2">
                                                            <span className="text-sm">📎</span>
                                                            <span className="text-[10px] text-blue-300 font-medium">Pièce jointe : {matchedFile.name}</span>
                                                            <button onClick={(e) => { e.preventDefault(); window.open(URL.createObjectURL(matchedFile)); }} className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded cursor-pointer transition-colors border border-slate-600 flex items-center gap-1">👁️ Aperçu</button>
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

                {/* Feedback IA (Golden Dataset) */}
                <div className="px-5 pb-5">
                    <div className="bg-slate-800/80 rounded-lg border border-slate-700 p-3">
                        <p className="text-xs font-bold text-slate-300 mb-2">Signaler des erreurs d'IA (Cochez pour sauvegarder l'exemple) :</p>
                        <div className="flex flex-wrap gap-2 mb-2">
                            <label className="flex items-center gap-1.5 text-[10px] text-slate-300 bg-slate-900 px-2 py-1 rounded border border-slate-600 cursor-pointer hover:bg-slate-700">
                                <input type="checkbox" checked={feedbackOptions.adminErr} onChange={() => toggleFeedback('adminErr')} className="w-3 h-3 rounded bg-slate-800 border-slate-500 text-indigo-500 focus:ring-0" />
                                Admin (Franchise, Police, Dates...)
                            </label>
                            <label className="flex items-center gap-1.5 text-[10px] text-slate-300 bg-slate-900 px-2 py-1 rounded border border-slate-600 cursor-pointer hover:bg-slate-700">
                                <input type="checkbox" checked={feedbackOptions.socialErr} onChange={() => toggleFeedback('socialErr')} className="w-3 h-3 rounded bg-slate-800 border-slate-500 text-indigo-500 focus:ring-0" />
                                Social (Personnes, Rôles...)
                            </label>
                            <label className="flex items-center gap-1.5 text-[10px] text-slate-300 bg-slate-900 px-2 py-1 rounded border border-slate-600 cursor-pointer hover:bg-slate-700">
                                <input type="checkbox" checked={feedbackOptions.financeErr} onChange={() => toggleFeedback('financeErr')} className="w-3 h-3 rounded bg-slate-800 border-slate-500 text-indigo-500 focus:ring-0" />
                                Finance (Montants, TVAC/HTVA...)
                            </label>
                            <label className="flex items-center gap-1.5 text-[10px] text-slate-300 bg-slate-900 px-2 py-1 rounded border border-slate-600 cursor-pointer hover:bg-slate-700">
                                <input type="checkbox" checked={feedbackOptions.fusionErr} onChange={() => toggleFeedback('fusionErr')} className="w-3 h-3 rounded bg-slate-800 border-slate-500 text-indigo-500 focus:ring-0" />
                                Fusion (Doublons non détectés)
                            </label>
                        </div>
                        <input type="text" value={feedbackNote} onChange={(e) => setFeedbackNote(e.target.value)} placeholder="Note optionnelle : qu'est-ce qui a planté ?" className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-[10px] text-white focus:border-indigo-500 outline-none mb-2" />
                        
                        {(Object.values(feedbackOptions).some(Boolean) || feedbackNote.trim() !== '') && (!pendingAiData._rawInputText || pendingAiData._rawInputText.trim().length === 0) && (
                            <div className="text-[9px] text-amber-400 bg-amber-400/10 p-1.5 rounded border border-amber-400/20">
                                ⚠️ Texte brut non capturé : ce cas sera partiellement exploitable.
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700 bg-slate-800 flex items-center justify-between gap-3">
                    <div className="text-[10px] text-slate-500">
                        {selectedExperts.size > 0 ? `${selectedExperts.size} experts · ` : ''}{occupantAnalysis.filter(o => occActions.get(o.id) !== 'ignore').length} occupants{selectedIntervenants.size > 0 ? ` · ${selectedIntervenants.size} intervenants` : ''} · {expenseAnalysis.filter(e => expActions.get(e.id) !== 'ignore').length} frais{pendingPhotoCount > 0 ? ` · ${pendingPhotoCount} 📸` : ''} à importer
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
