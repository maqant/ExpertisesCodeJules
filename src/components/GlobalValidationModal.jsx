import React, { useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { ExpertiseContext } from '../context/ExpertiseContext';
import { refineText, extractAdministrativeData, runMergeAgent } from '../services/aiManager';
import { useDatasetStore } from '../store/datasetStore';
import { useFinanceStore } from '../store/financeStore';
import { Info, CheckCircle2, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';
import { buildFieldDiff } from '../domain/merge/conservativeMerge.js';
import { FieldStatus } from '../domain/merge/mergeStrategies.js';
import { normalizeAiData, referenceKey } from '../domain/aiDataSchema';
import { STANDARD_FRANCHISES } from '../domain/claims/franchises.js';
import ComboboxField from './ui/ComboboxField.jsx';
import DropZone from './DropZone';

const MiniAttachmentUI = ({ docId, title = "Lier un fichier PDF" }) => {
    const { attachedFiles, handleRemoveFile, handleAttachFile, handleOpenFile } = useContext(ExpertiseContext);
    let files = attachedFiles[docId] || [];
    if (!Array.isArray(files)) files = [files];

    const handleFiles = (files) => {
        files.forEach(f => handleAttachFile(docId, f));
    };

    return (
        <div className="flex items-center gap-1 shrink-0 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
            {files.map(file => {
                if (!file.name) return null;
                return (
                    <span key={file.dbKey} className="text-[9px] bg-indigo-900/50 text-indigo-300 px-1 py-0.5 rounded flex items-center gap-1 border border-indigo-500/30 font-normal" title={file.name}>
                        📎 {file.pages}p
                        <button onClick={(e) => { e.preventDefault(); handleOpenFile(file.dbKey, true); }} className="text-blue-400 hover:text-blue-300 ml-0.5 mr-0.5" title="Ouvrir le document">👁️</button>
                        <button onClick={(e) => { e.preventDefault(); handleRemoveFile(docId, file.dbKey); }} className="text-red-400 hover:text-red-300 ml-0.5">✕</button>
                    </span>
                );
            })}
            <DropZone onDragFinish={() => {}} onFiles={handleFiles} accept=".pdf,.msg" />
        </div>
    );
};

const FORM_FIELD_LABELS = {
    dateSinistre: 'Date du sinistre', dateDeclaration: 'Date de déclaration', declarant: 'Déclarant',
    nomCie: 'Compagnie', nomContrat: 'Contrat', numPolice: 'N° Police', numeroPVPolice: 'N° PV Police',
    numSinistreCie: 'N° Sinistre Cie', adresse: 'Adresse', cause: 'Cause',
    numConditionsGenerales: 'N° Cond. Gen.', franchise: 'Franchise',
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
    const { pendingAiData, setPendingAiData, commitPendingAiData, formData, occupants, expenses, handleAttachFile, expertsList, aiConfig, franchises, attachedFiles } = useContext(ExpertiseContext);

    // Editable deep copy of pendingAiData
    const [editableData, setEditableData] = useState(null);
    // Expanded row trackers
    const [expandedOcc, setExpandedOcc] = useState(new Set());
    const [expandedExp, setExpandedExp] = useState(new Set());
    
    const storeResponsablesIds = useFinanceStore(state => state.metier?.responsablesIds) || [];
    const [localResponsablesIds, setLocalResponsablesIds] = useState(new Set());

    // Conflict resolution actions: Map<aiOccId, 'update'|'add'|'ignore'>
    const [occActions, setOccActions] = useState(new Map());
    const [expActions, setExpActions] = useState(new Map());
    // Selected form fields
    const [selectedFormFields, setSelectedFormFields] = useState(new Set());
    const [selectedExperts, setSelectedExperts] = useState(new Set());
    // v5.6.0 - Intervenants (tous DÉCOCHÉS par défaut)
    const [selectedIntervenants, setSelectedIntervenants] = useState(new Set());
    // v8.1.0 - Références sélectionnées
    const [selectedReferences, setSelectedReferences] = useState(new Set());
    // v5.6.1 - Refining state
    // v5.6.1 - Refining state
    const [refiningField, setRefiningField] = useState(null); // 'cause' | 'divers' | 'compteRendu' | null
    const [attachedCpFile, setAttachedCpFile] = useState(null);
    const [initialized, setInitialized] = useState(false);
    const [isMerging, setIsMerging] = useState(false);
    
    // v8.2.0 - File Assignments
    const [fileAssignments, setFileAssignments] = useState(new Map());

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
        const normalized = normalizeAiData(pendingAiData);
        
        // Ticket D: Matching Intelligent du compteDe
        const cleanExps = normalized.expenses.map(exp => {
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
        
        // Déduplication des références
        const seenRefs = new Set();
        const cleanRefs = normalized.references.filter(ref => {
            const key = referenceKey(ref);
            if (seenRefs.has(key)) return false;
            seenRefs.add(key);
            return true;
        });
        
        setEditableData({
            formData: normalized.formData,
            occupants: normalized.occupants,
            expenses: cleanExps,
            references: cleanRefs
        });

        // FormData: select fields where current is empty or different using domain logic
        const newFormFields = new Set();
        if (normalized.formData) {
            const diffs = buildFieldDiff(formData, normalized.formData);
            diffs.forEach(diff => {
                // Seuls les NOUVEAUX champs (IA a trouvé qqch, humain n'avait rien mis) sont cochés par défaut.
                // Les CONFLITS (humain avait déjà une valeur) sont sanctuarisés et décochés par défaut.
                if (diff.status === FieldStatus.NEW) {
                    newFormFields.add(diff.key);
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

        // Références : sélectionner toutes les références non vides par défaut
        const newSelectedRefs = new Set();
        cleanRefs.forEach(ref => {
            newSelectedRefs.add(ref.id);
        });
        setSelectedReferences(newSelectedRefs);

        // v7.0.0 - Set default actions avec fuzzy matching
        const newOccActions = new Map();
        normalized.occupants.forEach(occ => {
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

        setLocalResponsablesIds(new Set(storeResponsablesIds));

        // Auto-assign CP and CG
        const newFileAssignments = new Map();
        (pendingAiData.pendingFiles || []).forEach(file => {
            const nameLow = (file.name || '').toLowerCase();
            if (nameLow.includes('cg') || nameLow.includes('conditions générales') || nameLow.includes('conditions_generales')) {
                newFileAssignments.set(file.name, 'doc_cond_gen');
            } else if (nameLow.includes('cp') || nameLow.includes('conditions particulières') || nameLow.includes('conditions_particulieres')) {
                newFileAssignments.set(file.name, 'doc_cond_part');
            } else {
                newFileAssignments.set(file.name, 'unassigned');
            }
        });
        setFileAssignments(newFileAssignments);

        setInitialized(true);
    }

    if (!pendingAiData && initialized) {
        setInitialized(false);
        setEditableData(null);
        setSelectedIntervenants(new Set());
        setSelectedReferences(new Set());
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

    const toggleReference = (id) => {
        setSelectedReferences(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    };

    const updateReferenceField = (refId, field, value) => {
        setEditableData(prev => ({
            ...prev,
            references: prev.references.map(r => r.id === refId ? { ...r, [field]: value } : r)
        }));
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
        // Auto-sélection : on suppose que si l'utilisateur modifie, il veut l'enregistrer
        setSelectedFormFields(prev => {
            const n = new Set(prev);
            n.add(key);
            return n;
        });
    };

    const handleValidate = () => {
        const selections = {
            formFields: Array.from(selectedFormFields),
            experts: Array.from(selectedExperts),
            references: Array.from(selectedReferences),
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
            intervenants: Array.from(selectedIntervenants),
            responsablesIds: Array.from(localResponsablesIds),
            fileAssignments: Array.from(fileAssignments.entries())
        };

        // v5.4.0: Merge editableData INTO pendingAiData synchronously, EXPLICITLY preserving pendingFiles
        const mergedData = {
            ...pendingAiData,               // preserves pendingFiles, experts, intervenants, etc.
            ...editableData,                // overwrites formData, occupants, expenses, references with edited versions
            references: editableData.references || [],
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

    const handleMergeDevis = (factureId, devisId) => {
        setEditableData(prev => {
            const factureExp = prev.expenses.find(e => e.id === factureId);
            const devisExp = prev.expenses.find(e => e.id === devisId);
            if (!factureExp || !devisExp) return prev;

            const filesToKeep = [];
            if (factureExp.sourceFileName) filesToKeep.push(factureExp.sourceFileName);
            if (Array.isArray(factureExp.sourceFileNames)) filesToKeep.push(...factureExp.sourceFileNames);
            if (devisExp.sourceFileName) filesToKeep.push(devisExp.sourceFileName);
            if (Array.isArray(devisExp.sourceFileNames)) filesToKeep.push(...devisExp.sourceFileNames);

            const merged = { 
                ...factureExp, 
                type: 'Facture',
                sourceFileNames: [...new Set(filesToKeep.filter(Boolean))]
            };

            return {
                ...prev,
                expenses: prev.expenses.map(e => e.id === factureId ? merged : e).filter(e => e.id !== devisId)
            };
        });
        setExpandedExp(prev => {
            const n = new Set(prev);
            n.delete(devisId);
            return n;
        });
    };

    const removeExpense = (e, id) => {
        e.stopPropagation();
        setEditableData(prev => ({ ...prev, expenses: prev.expenses.filter(x => x.id !== id) }));
    };

    const handleAddOccupant = () => {
        const newId = crypto.randomUUID();
        const newOccupant = { id: newId, nom: 'Nouvel Occupant', statut: 'Locataire', source: 'manual' };
        setEditableData(prev => ({
            ...prev,
            occupants: [...(prev.occupants || []), newOccupant]
        }));
        setOccActions(prev => new Map(prev).set(newId, 'add'));
        setExpandedOcc(prev => new Set(prev).add(newId));
        return newId;
    };

    const hasFormData = editableData.formData && Object.keys(editableData.formData).some(k => editableData.formData[k] && editableData.formData[k] !== '');
    const hasReferences = editableData.references && editableData.references.length > 0;
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

    // v8.2.0 - Unassigned files logic
    const matchedFileNames = new Set();
    expenseAnalysis.forEach(exp => {
        if (exp.sourceFileName) matchedFileNames.add(exp.sourceFileName);
        if (exp.sourceFileNames) exp.sourceFileNames.forEach(f => matchedFileNames.add(f));
    });
    if (pendingAiData?.technicalFilesToAttach) {
        pendingAiData.technicalFilesToAttach.forEach(f => matchedFileNames.add(f));
    }
    const unassignedFilesList = pendingFiles.filter(f => !matchedFileNames.has(f.name) && !(f.type && f.type.startsWith('image/')));

    const toggleExpert = (name) => {
        setSelectedExperts(prev => { const n = new Set(prev); if (n.has(name)) n.delete(name); else n.add(name); return n; });
    };

    // v5.6.6 - Condition d'alerte pour Franchise et Pertes Indirectes
    const isFranchiseMissing = !(editableData?.formData?.franchise || formData?.franchise);
    const isPertesMissing = !(editableData?.formData?.pertesIndirectes || formData?.pertesIndirectes);
    const hasCpAlready = attachedFiles && attachedFiles['doc_cond_part'] && attachedFiles['doc_cond_part'].length > 0;
    const showMissingWarning = isFranchiseMissing || isPertesMissing;

    return (
        <div className="fixed inset-0 z-[250] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm no-print">
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
                                    <ComboboxField
                                        value={editableData?.formData?.franchise || ''}
                                        onChange={(v) => {
                                            updateFormField('franchise', v);
                                            if (v) setSelectedFormFields(prev => new Set(prev).add('franchise'));
                                        }}
                                        options={[
                                            ...STANDARD_FRANCHISES.map(f => ({ id: f.id, label: f.label })),
                                            ...(franchises || []).map((f, i) => ({ id: `dyn_${i}`, label: f }))
                                        ]}
                                        className="w-full bg-orange-50/50 border border-orange-300 rounded px-2 py-1.5 text-xs focus:border-orange-500 outline-none"
                                        placeholder="Ex: Légale..."
                                    />
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
                                    <label className="block text-xs font-bold text-orange-800 mb-1">Document des Conditions Particulières (CP) :</label>
                                    {hasCpAlready ? (
                                        <div className="bg-green-100 border border-green-300 rounded p-2 text-xs text-green-800 flex items-center gap-2">
                                            <span>✅</span> CP déjà jointes au dossier. L'IA les utilisera pour la suite.
                                        </div>
                                    ) : (
                                        <div className="bg-orange-50/50 border border-orange-300 rounded p-2 text-xs text-orange-800 flex items-center gap-2">
                                            <span>💡</span> Ajoutez vos CP depuis le champ <b>N° Police</b> ci-dessous, ou depuis la barre latérale.
                                        </div>
                                    )}
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
                                                <div className="flex justify-between items-center w-full">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">{label}</span>
                                                    {key === 'numPolice' && <MiniAttachmentUI docId="doc_cond_part" title="Cond. Particulières" />}
                                                    {key === 'numConditionsGenerales' && <MiniAttachmentUI docId="doc_cond_gen" title="Cond. Générales" />}
                                                </div>
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
                                                    ) : key === 'franchise' ? (
                                                        <ComboboxField
                                                            value={aiVal}
                                                            onChange={(v) => updateFormField(key, v)}
                                                            options={[
                                                                ...STANDARD_FRANCHISES.map(f => ({ id: f.id, label: f.label })),
                                                                ...(franchises || []).map((f, i) => ({ id: `dyn_${i}`, label: f }))
                                                            ]}
                                                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-green-400 font-medium focus:border-indigo-500 outline-none"
                                                        />
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

                    {/* Section 1.5: Références (v8.1.0) */}
                    {hasReferences && (
                        <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                            <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                                <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-1.5">📊 Références tierces</h3>
                                <button onClick={(e) => {
                                    e.stopPropagation();
                                    const newId = Math.random().toString(36).substring(2, 11);
                                    setEditableData(prev => ({
                                        ...prev,
                                        references: [...(prev.references || []), { id: newId, nom: '', ref: '' }]
                                    }));
                                    setSelectedReferences(prev => new Set(prev).add(newId));
                                }} className="text-[10px] bg-indigo-500 hover:bg-indigo-400 text-white px-2 py-1 rounded transition-colors shadow">
                                    + Ajouter
                                </button>
                            </div>
                            <div className="p-3 space-y-1.5">
                                {editableData.references.map((r) => {
                                    const isChecked = selectedReferences.has(r.id);
                                    return (
                                        <div key={r.id} className="flex items-center gap-2.5 p-2 rounded transition-colors hover:bg-slate-700/50">
                                            <input type="checkbox" checked={isChecked} onChange={() => toggleReference(r.id)}
                                                className="w-4 h-4 rounded border-slate-500 bg-slate-700 text-indigo-500 focus:ring-0 shrink-0 cursor-pointer" />
                                            <div className="flex-1 flex gap-2">
                                                <input type="text" value={r.nom || ''} onChange={e => updateReferenceField(r.id, 'nom', e.target.value)}
                                                    placeholder="Nom (Ex: Tiers, Cie...)" className="w-1/2 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" />
                                                <input type="text" value={r.ref || ''} onChange={e => updateReferenceField(r.id, 'ref', e.target.value)}
                                                    placeholder="Référence" className="w-1/2 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-green-400 font-medium focus:border-indigo-500 outline-none" />
                                            </div>
                                            <button onClick={() => {
                                                setEditableData(prev => ({ ...prev, references: prev.references.filter(x => x.id !== r.id) }));
                                                setSelectedReferences(prev => { const n = new Set(prev); n.delete(r.id); return n; });
                                            }} className="text-slate-500 hover:text-red-400 p-1" title="Supprimer de la liste">🗑️</button>
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
                    {true && (
                        <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
                            <div className="p-3 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                                <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-1.5">
                                    👥 Occupants <span className="text-[10px] font-normal text-slate-400">({occupantAnalysis.length})</span>
                                </h3>
                                <button onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddOccupant();
                                }} className="text-[10px] bg-indigo-500 hover:bg-indigo-400 text-white px-2 py-1 rounded transition-colors shadow">
                                    + Créer
                                </button>
                            </div>
                            <div className="divide-y divide-slate-700/50">
                                {!hasOccupants && (
                                    <div className="p-4 text-center text-xs text-slate-400 italic">
                                        Aucune partie détectée par l'IA. Créez-en une manuellement pour lui imputer un frais.
                                    </div>
                                )}
                                {hasOccupants && occupantAnalysis.map(occ => {
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
                                                    <div><label className="text-[9px] text-slate-500 uppercase">Nom</label><input type="text" data-telemetry-id="occ_nom" value={occ.nom || ''} onChange={(e) => updateOccField(occ.id, 'nom', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                    <div><label className="text-[9px] text-slate-500 uppercase">Étage</label><input type="text" data-telemetry-id="occ_etage" value={occ.etage || ''} onChange={(e) => updateOccField(occ.id, 'etage', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                    <div><label className="text-[9px] text-slate-500 uppercase">Statut</label>
                                                        <select data-telemetry-id="occ_statut" value={occ.statut || 'Locataire'} onChange={(e) => updateOccField(occ.id, 'statut', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none">
                                                            {STATUT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                                        </select>
                                                    </div>
                                                    <div><label className="text-[9px] text-slate-500 uppercase">Téléphone</label><input type="text" data-telemetry-id="occ_tel" value={occ.tel || ''} onChange={(e) => updateOccField(occ.id, 'tel', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                    <div><label className="text-[9px] text-slate-500 uppercase">Email</label><input type="email" data-telemetry-id="occ_email" value={occ.email || ''} onChange={(e) => updateOccField(occ.id, 'email', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                    <div className="col-span-2"><label className="text-[9px] text-slate-500 uppercase">IBAN</label><input type="text" data-telemetry-id="occ_iban" value={occ.iban || ''} onChange={(e) => updateOccField(occ.id, 'iban', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none font-mono" placeholder="BE..." /></div>
                                                    <div><label className="text-[9px] text-slate-500 uppercase">RC</label>
                                                        <select data-telemetry-id="occ_rc_oui_non" value={occ.rc || 'Non'} onChange={(e) => updateOccField(occ.id, 'rc', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none">
                                                            <option value="Oui">Oui</option><option value="Non">Non</option>
                                                        </select>
                                                    </div>
                                                    {occ.rc === 'Oui' && (
                                                        <div><label className="text-[9px] text-slate-500 uppercase">N° Police RC</label><input type="text" data-telemetry-id="occ_rc_police" value={occ.rcPolice || ''} onChange={(e) => updateOccField(occ.id, 'rcPolice', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                    )}
                                                    <div><label className="text-[9px] text-slate-500 uppercase">2ème Assurance</label>
                                                        <select data-telemetry-id="occ_sec_ass_oui_non" value={occ.secAssurance || 'Non'} onChange={(e) => updateOccField(occ.id, 'secAssurance', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none">
                                                            <option value="Oui">Oui</option><option value="Non">Non</option>
                                                        </select>
                                                    </div>
                                                    {occ.secAssurance === 'Oui' && (
                                                        <>
                                                            <div><label className="text-[9px] text-slate-500 uppercase">Type 2ème</label><input type="text" data-telemetry-id="occ_sec_type" value={occ.secType || ''} onChange={(e) => updateOccField(occ.id, 'secType', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                            <div><label className="text-[9px] text-slate-500 uppercase">N° Police 2ème</label><input type="text" data-telemetry-id="occ_sec_police" value={occ.secPolice || ''} onChange={(e) => updateOccField(occ.id, 'secPolice', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                            <div><label className="text-[9px] text-slate-500 uppercase">Cie 2ème</label><input type="text" data-telemetry-id="occ_sec_cie" value={occ.secCie || ''} onChange={(e) => updateOccField(occ.id, 'secCie', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                        </>
                                                    )}
                                                    <div><label className="text-[9px] text-slate-500 uppercase">Expert client (Contre-Expert)</label>
                                                        <select value={occ.contreExpert ? 'Oui' : 'Non'} onChange={(e) => updateOccField(occ.id, 'contreExpert', e.target.value === 'Oui')} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none">
                                                            <option value="Oui">Oui</option><option value="Non">Non</option>
                                                        </select>
                                                    </div>
                                                    {occ.contreExpert && (
                                                        <div><label className="text-[9px] text-slate-500 uppercase">Nom Expert Client</label><input type="text" value={occ.nomContreExpert || ''} onChange={(e) => updateOccField(occ.id, 'nomContreExpert', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                    )}
                                                    <div className="col-span-2 pt-2 border-t border-slate-700 mt-1">
                                                        <label className="flex items-center space-x-2 cursor-pointer text-red-400 text-[10px] font-bold">
                                                            <input type="checkbox" checked={localResponsablesIds.has(occ.id)} onChange={(e) => {
                                                                setLocalResponsablesIds(prev => {
                                                                    const next = new Set(prev);
                                                                    if (next.has(occ.id)) next.delete(occ.id);
                                                                    else next.add(occ.id);
                                                                    return next;
                                                                });
                                                            }} className="w-3 h-3 rounded bg-slate-700 border-red-500 text-red-500 focus:ring-red-500" />
                                                            <span>Désigner comme Responsable du Sinistre</span>
                                                        </label>
                                                    </div>
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
                                                    <div className="col-span-2">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <label className="text-[9px] text-slate-500 uppercase">Bénéficiaire (Imputer à)</label>
                                                            <button 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const newOccId = handleAddOccupant();
                                                                    updateExpField(exp.id, 'compteDe', newOccId);
                                                                }}
                                                                className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold"
                                                                title="Créer une nouvelle partie et y imputer ce frais"
                                                            >
                                                                + Créer et Imputer
                                                            </button>
                                                        </div>
                                                        <select 
                                                            value={exp.compteDe || 'unassigned'} 
                                                            onChange={(e) => updateExpField(exp.id, 'compteDe', e.target.value)}
                                                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                                                        >
                                                            <option value="unassigned">-- Non assigné --</option>
                                                            <optgroup label="Nouveaux (IA & Créés)">
                                                                {editableData.occupants.filter(o => occActions.get(o.id) !== 'ignore' && !occupants.some(ex => ex.id === o.id)).map(o => (
                                                                    <option key={o.id} value={o.id}>{o.nom || 'Sans nom'}</option>
                                                                ))}
                                                            </optgroup>
                                                            {occupants.length > 0 && (
                                                                <optgroup label="Existants dans le dossier">
                                                                    {occupants.map(o => (
                                                                        <option key={o.id} value={o.id}>{o.nom || 'Sans nom'}</option>
                                                                    ))}
                                                                </optgroup>
                                                            )}
                                                        </select>
                                                    </div>
                                                    <div><label className="text-[9px] text-slate-500 uppercase">Prestataire</label><input type="text" data-telemetry-id="exp_prestataire" value={exp.prestataire || ''} onChange={(e) => updateExpField(exp.id, 'prestataire', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                    <div><label className="text-[9px] text-slate-500 uppercase">Type</label>
                                                        <select data-telemetry-id="exp_type" value={exp.type || 'Facture'} onChange={(e) => updateExpField(exp.id, 'type', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none">
                                                            <option value="Facture">Facture</option><option value="Devis">Devis</option>
                                                        </select>
                                                    </div>
                                                    <div><label className="text-[9px] text-slate-500 uppercase">Référence</label><input type="text" data-telemetry-id="exp_ref" value={exp.ref || ''} onChange={(e) => updateExpField(exp.id, 'ref', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                    <div><label className="text-[9px] text-slate-500 uppercase">Montant (HTVA)</label><input type="text" data-telemetry-id="exp_montant" value={exp.montant || exp.montantReclame || ''} onChange={(e) => updateExpField(exp.id, 'montant', e.target.value)} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" /></div>
                                                    <div className="col-span-2"><label className="text-[9px] text-slate-500 uppercase">Description</label><textarea data-telemetry-id="exp_desc" value={exp.desc || ''} onChange={(e) => updateExpField(exp.id, 'desc', e.target.value)} rows={2} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none resize-none" /></div>
                                                    {matchedFile && (
                                                        <div className="col-span-2 bg-blue-900/20 border border-blue-500/30 rounded p-2 flex items-center gap-2">
                                                            <span className="text-sm">📎</span>
                                                            <span className="text-[10px] text-blue-300 font-medium">Pièce jointe : {matchedFile.name}</span>
                                                            <button onClick={(e) => { e.preventDefault(); window.open(URL.createObjectURL(matchedFile)); }} className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded cursor-pointer transition-colors border border-slate-600 flex items-center gap-1">👁️ Aperçu</button>
                                                            <span className="text-[9px] text-slate-500 ml-auto">Sera attachée automatiquement</span>
                                                        </div>
                                                    )}
                                                    
                                                    {exp.sourceFileNames && exp.sourceFileNames.length > 0 && exp.sourceFileNames.map((fName, idx) => {
                                                        const mFile = pendingFiles.find(f => f.name === fName);
                                                        if (!mFile) return null;
                                                        return (
                                                            <div key={idx} className="col-span-2 bg-indigo-900/20 border border-indigo-500/30 rounded p-2 flex items-center gap-2 mt-1">
                                                                <span className="text-sm">📎</span>
                                                                <span className="text-[10px] text-indigo-300 font-medium">Pièce jointe additionnelle : {mFile.name}</span>
                                                                <button onClick={(e) => { e.preventDefault(); window.open(URL.createObjectURL(mFile)); }} className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded cursor-pointer transition-colors border border-slate-600 flex items-center gap-1">👁️ Aperçu</button>
                                                            </div>
                                                        );
                                                    })}

                                                    {exp.type === 'Facture' && editableData.expenses.some(other => other.type === 'Devis' && other.id !== exp.id) && (
                                                        <div className="col-span-2 mt-2 p-2 bg-indigo-900/30 border border-indigo-500/30 rounded">
                                                            <label className="text-[9px] text-indigo-300 uppercase mb-1 block">Lier un devis à cette facture</label>
                                                            <select 
                                                                onChange={(e) => {
                                                                    if (e.target.value) handleMergeDevis(exp.id, e.target.value);
                                                                }}
                                                                value=""
                                                                className="w-full bg-slate-900 border border-indigo-500/50 rounded px-2 py-1 text-xs text-white focus:border-indigo-400 outline-none cursor-pointer"
                                                            >
                                                                <option value="">-- Sélectionner un devis à lier --</option>
                                                                {editableData.expenses.filter(other => other.type === 'Devis' && other.id !== exp.id).map(devis => (
                                                                    <option key={devis.id} value={devis.id}>
                                                                        {devis.prestataire || 'Prestataire inconnu'} - {devis.montant || devis.montantReclame || 'Montant inconnu'}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                            <p className="text-[9px] text-indigo-400 mt-1">Le devis sera supprimé et sa pièce jointe sera rattachée à cette facture.</p>
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

                    {/* Section 5: Unassigned Files (v8.2.0) */}
                    {unassignedFilesList.length > 0 && (
                        <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden mt-4">
                            <div className="p-3 bg-slate-800 border-b border-slate-700">
                                <h3 className="text-sm font-bold text-indigo-300 flex items-center gap-1.5">
                                    📎 Documents détectés non assignés <span className="text-[10px] font-normal text-slate-400">({unassignedFilesList.length})</span>
                                </h3>
                                <p className="text-[10px] text-slate-400 mt-1">Liez manuellement ces documents ou laissez-les tels quels (ils resteront dans la bibliothèque).</p>
                            </div>
                            <div className="divide-y divide-slate-700/50">
                                {unassignedFilesList.map((file, idx) => {
                                    const currentAssign = fileAssignments.get(file.name) || 'unassigned';
                                    const isAutoMatched = currentAssign === 'doc_cond_part' || currentAssign === 'doc_cond_gen';
                                    return (
                                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 hover:bg-slate-700/30 transition-colors">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-sm">📄</span>
                                                <span className="text-xs font-bold text-white truncate" title={file.name}>{file.name}</span>
                                                {isAutoMatched && (
                                                    <span className="text-[9px] bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded font-bold border border-green-500/30 ml-2">Match Auto</span>
                                                )}
                                                <button onClick={(e) => { e.preventDefault(); window.open(URL.createObjectURL(file)); }} className="text-[10px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded cursor-pointer transition-colors border border-slate-600 flex items-center gap-1 ml-2">👁️ Aperçu</button>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <label className="text-[10px] text-slate-400 uppercase">Lier à :</label>
                                                <select 
                                                    value={currentAssign}
                                                    onChange={(e) => {
                                                        const newMap = new Map(fileAssignments);
                                                        newMap.set(file.name, e.target.value);
                                                        setFileAssignments(newMap);
                                                    }}
                                                    className="bg-slate-900 border border-slate-600 text-xs text-white rounded px-2 py-1 focus:border-indigo-500 outline-none w-[200px]"
                                                >
                                                    <option value="unassigned">-- Ne pas lier --</option>
                                                    <option value="doc_cond_part">N° Police (Conditions Particulières)</option>
                                                    <option value="doc_cond_gen">Conditions Générales</option>
                                                    <option value="doc_mail_expertise">Mail Expertise</option>
                                                    <option value="doc_mail_declaration">Mail Déclaration</option>
                                                    <option value="doc_rapport_cause">Cause (Rapport technique)</option>
                                                </select>
                                            </div>
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
