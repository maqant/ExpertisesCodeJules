import React, { useState, useMemo, useEffect } from 'react';
import { useDecompteSplitter } from './DecompteSplitterProvider.jsx';
import { cleanAmount, useFinanceStore } from '../../../store/financeStore.js';
import { getResteAVentiler, isResteEpuise, ALLOCATION_STATUS, CLOSURE_MODE } from '../../../domain/decompteSplitter/allocationModel.js';
import { resolveBlockRecipientContact } from '../../../domain/decompteSplitter/blockRecipientModel.js';
import SingleRecipientSelector from './SingleRecipientSelector.jsx';
import { Trash2, Plus, ArrowRightLeft, Sparkles, RotateCcw, Copy, Mail, Loader2, Info, ListPlus } from 'lucide-react';
import { resolveExpenseView, getDisplayLabel } from '../../../domain/decompteSplitter/labelResolver.js';
import { buildEmailTemplate, buildEmailHtml } from '../../../services/export/emailTemplateBuilder.js';
import { buildINGTsvExport } from '../../../services/export/tsvBuilder.js';
import { buildAllCandidates, buildIbanCandidates, formatIbanDisplay, buildReferenceCandidates, resolveExplicitCivility } from '../../../services/utils/contactUtils.js';
import { refineText } from '../../../services/aiManager.js';

const FIELD_CLS = "w-full text-xs text-slate-900 font-semibold bg-white border border-slate-300 rounded p-1.5 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none placeholder:text-slate-400";

export const SplitterRecipientBlock = ({ block, expenses, occupants, intervenants, dossierName }) => {
    const { state, dispatch } = useDecompteSplitter();
    const formData = useFinanceStore(s => s.metier?.formData || {});

    const [splitAmount, setSplitAmount] = useState('');
    const [expenseToAdd, setExpenseToAdd] = useState('');
    const [isRefiningRemarque, setIsRefiningRemarque] = useState(false);
    const [refineError, setRefineError] = useState(null);
    const [copyFeedback, setCopyFeedback] = useState(null); // 'mail' | 'ing' | null

    const flashFeedback = (kind) => {
        setCopyFeedback(kind);
        setTimeout(() => setCopyFeedback(null), 2500);
    };

    // Résolution du contact actif AVANT toute mémoïsation qui en dépend (fix TDZ)
    const activeContact = resolveBlockRecipientContact(block, state.localContacts, { occupants, intervenants });

    const ibanCandidates = useMemo(() => {
        const list = buildIbanCandidates({
            occupants: occupants || [],
            intervenants: intervenants || [],
            documentCandidates: state.documentCandidates || [],
            documentIbans: state.documentIbans || [],
            localContacts: state.localContacts || []
        });

        const suggestedIban = activeContact?.iban ? activeContact.iban.replace(/\s/g, '').toUpperCase() : null;
        if (suggestedIban) {
            const idx = list.findIndex(item => item.iban === suggestedIban);
            if (idx > 0) {
                const [item] = list.splice(idx, 1);
                item.provenance = `Suggéré (${activeContact.displayName || activeContact.nom}) — ${item.provenance}`;
                list.unshift(item);
            } else if (idx === -1) {
                list.unshift({
                    iban: suggestedIban,
                    ibanDisplay: formatIbanDisplay(suggestedIban),
                    isValidFormat: true,
                    provenance: `Suggéré (${activeContact.displayName || activeContact.nom})`,
                    holderName: activeContact.displayName || activeContact.nom,
                    sourceKind: 'dossier'
                });
            }
        }
        return list;
    }, [occupants, intervenants, state.documentCandidates, state.documentIbans, state.localContacts, activeContact]);

    const referenceCandidates = useMemo(
        () => buildReferenceCandidates({
            refPechard: formData.refPechard,
            numSinistreCie: formData.numSinistreCie,
            refCompagnie: formData.refCompagnie,
            numPolice: formData.numPolice,
            dossierName
        }),
        [formData.refPechard, formData.numSinistreCie, formData.refCompagnie, formData.numPolice, dossierName]
    );

    const activeExpenseIds = useMemo(() => new Set((expenses || []).map(e => e.id)), [expenses]);

    useEffect(() => {
        const activeIds = (expenses || []).map(e => e.id);
        const hasOrphans = state.allocations.some(a => !activeIds.includes(a.expenseId));
        if (hasOrphans) {
            dispatch({ type: 'PURGE_ORPHAN_ALLOCATIONS', payload: { activeExpenseIds: activeIds } });
        }
    }, [expenses, state.allocations, dispatch]);

    const blockAllocations = useMemo(
        () => state.allocations.filter(a => a.blockId === block.id && activeExpenseIds.has(a.expenseId)),
        [state.allocations, block.id, activeExpenseIds]
    );
    const totalBlockEuro = blockAllocations.reduce((sum, a) => sum + cleanAmount(a.montant), 0);
    const hasAllocations = blockAllocations.length > 0;

    const availableExpenses = useMemo(() => {
        return (expenses || []).filter(exp => {
            const isSuspended = state.allocations.some(
                a => a.expenseId === exp.id && a.status === ALLOCATION_STATUS.SUSPENDED
            );
            if (isSuspended) return false;
            const reste = getResteAVentiler(exp, state.allocations);
            return !isResteEpuise(reste);
        });
    }, [expenses, state.allocations]);

    const handleRefineRemarque = async () => {
        if (!block.remarque?.trim() || isRefiningRemarque) return;
        setIsRefiningRemarque(true);
        setRefineError(null);
        try {
            const res = await refineText(block.remarque, 'REWRITE');
            const resultText = (typeof res === 'string' ? res : res?.text || res?.refinedText || '').trim();
            if (!resultText) {
                throw new Error(res?.error || "L'affinage a retourné un texte vide.");
            }
            dispatch({
                type: 'APPLY_REFINED_REMARQUE',
                payload: { blockId: block.id, refinedText: resultText }
            });
        } catch (err) {
            console.error('[SplitterRecipientBlock] Échec affinage IA :', err);
            setRefineError("L'affinage IA a échoué. Votre texte est inchangé.");
        } finally {
            setIsRefiningRemarque(false);
        }
    };

    const handleAddAllocation = () => {
        if (!expenseToAdd) return;
        const targetExp = expenses.find(e => e.id === expenseToAdd);
        if (!targetExp) return;

        const reste = getResteAVentiler(targetExp, state.allocations);
        let valToAssign = Math.abs(reste);

        if (splitAmount.trim() !== '') {
            const parsed = Math.abs(cleanAmount(splitAmount));
            if (!isNaN(parsed) && parsed > 0) {
                valToAssign = Math.min(parsed, valToAssign);
            }
        }

        const signedValue = reste < 0 ? -valToAssign : valToAssign;
        const signedStr = signedValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        dispatch({
            type: 'ADD_ALLOCATION',
            payload: {
                blockId: block.id,
                expenseId: targetExp.id,
                montant: signedStr,
                status: Math.abs(valToAssign - Math.abs(reste)) < 0.001 ? ALLOCATION_STATUS.ASSIGNED : ALLOCATION_STATUS.SPLIT
            }
        });

        setExpenseToAdd('');
        setSplitAmount('');
    };

    const handleAddAllAvailable = () => {
        availableExpenses.forEach(exp => {
            const reste = getResteAVentiler(exp, state.allocations);
            if (isResteEpuise(reste)) return;
            const signedStr = reste.toLocaleString('fr-FR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            dispatch({
                type: 'ADD_ALLOCATION',
                payload: {
                    blockId: block.id,
                    expenseId: exp.id,
                    montant: signedStr,
                    status: ALLOCATION_STATUS.ASSIGNED
                }
            });
        });
        setExpenseToAdd('');
        setSplitAmount('');
    };

    const handleCopyMail = async () => {
        if (!hasAllocations) return;
        const htmlText = buildEmailHtml(block, state.allocations, expenses, {
            occupants,
            prestataires: intervenants,
            localContacts: state.localContacts
        });
        const plainText = buildEmailTemplate(block, state.allocations, expenses, {
            occupants,
            prestataires: intervenants,
            localContacts: state.localContacts
        });

        if (!plainText) return;

        try {
            if (typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
                const htmlBlob = new Blob([htmlText], { type: 'text/html' });
                const textBlob = new Blob([plainText], { type: 'text/plain' });
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'text/html': htmlBlob,
                        'text/plain': textBlob
                    })
                ]);
            } else {
                await navigator.clipboard.writeText(plainText);
            }
            flashFeedback('mail');
        } catch (err) {
            console.warn('[SplitterRecipientBlock] Rich clipboard copy failed, falling back to writeText:', err);
            await navigator.clipboard.writeText(plainText);
            flashFeedback('mail');
        }
    };

    const handleCopyINGBlock = () => {
        if (!hasAllocations) return;
        const allCandidates = buildAllCandidates({
            occupants: occupants || [],
            intervenants: intervenants || [],
            localContacts: state.localContacts || [],
            documentCandidates: state.documentCandidates || []
        });
        const tsvContent = buildINGTsvExport(state, expenses, dossierName, block.id, allCandidates);
        navigator.clipboard.writeText(tsvContent);
        flashFeedback('ing');
    };

    const isMailRecipientLinked = block.mailRecipientLinked !== false;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase">Bloc de règlement</h3>
                {state.blocks.length > 1 && (
                    <button 
                        onClick={() => dispatch({ type: 'REMOVE_BLOCK', payload: block.id })}
                        className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"
                        title="Supprimer ce paiement"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Formulaire destinataires (Destinataire Mail + Bénéficiaire Paiement optionnel) */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                <div className="space-y-3">
                    {/* Destinataire de L'E-MAIL (Principal) */}
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                Destinataire de l'e-mail
                            </label>
                            <div className="flex gap-1 bg-slate-200 p-0.5 rounded">
                                {[
                                    { id: 'Monsieur', label: 'Mr' },
                                    { id: 'Madame', label: 'Mme' },
                                    { id: 'ACP', label: 'ACP' },
                                    { id: 'Société', label: 'Sté' }
                                ].map(opt => {
                                    const isSel = block.mailCivility === opt.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => dispatch({
                                                type: 'UPDATE_BLOCK',
                                                payload: { blockId: block.id, updates: { mailCivility: opt.id, mailCivilityManuallySet: true } }
                                            })}
                                            className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
                                                isSel 
                                                    ? 'bg-indigo-600 text-white shadow-sm' 
                                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-300'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <SingleRecipientSelector 
                            recipientRef={block.mailRecipientRef || block.paymentRecipientRef || block.recipientRef}
                            recipientSnapshot={block.mailRecipientSnapshot || block.paymentRecipientSnapshot || block.recipientSnapshot}
                            localContacts={state.localContacts}
                            occupants={occupants}
                            intervenants={intervenants}
                            documentCandidates={state.documentCandidates || []}
                            onSelect={(ref, snapshot) => {
                                const allCandidates = buildAllCandidates({ occupants, intervenants, localContacts: state.localContacts, documentCandidates: state.documentCandidates || [] });
                                const candidate = ref ? allCandidates.find(c => c.kind === ref.kind && c.id === ref.id) : null;
                                const explicitCivility = resolveExplicitCivility(candidate || snapshot);

                                const updates = { mailRecipientRef: ref, mailRecipientSnapshot: snapshot };
                                if (explicitCivility && !block.mailCivilityManuallySet) {
                                    updates.mailCivility = explicitCivility;
                                }
                                if (isMailRecipientLinked) {
                                    updates.paymentRecipientRef = ref;
                                    updates.paymentRecipientSnapshot = snapshot;
                                    updates.recipientRef = ref;
                                    updates.recipientSnapshot = snapshot;
                                }
                                dispatch({
                                    type: 'UPDATE_BLOCK',
                                    payload: { blockId: block.id, updates }
                                });
                            }}
                            onCreateContact={(newContact) => {
                                dispatch({ type: 'ADD_LOCAL_CONTACT', payload: { contact: newContact, blockId: block.id } });
                                const ref = { kind: 'local', id: newContact.id };
                                const snapshot = { displayName: newContact.displayName || newContact.nom, email: newContact.email || null, iban: newContact.iban || null, isCompany: false };
                                const updates = { mailRecipientRef: ref, mailRecipientSnapshot: snapshot };
                                if (isMailRecipientLinked) {
                                    updates.paymentRecipientRef = ref;
                                    updates.paymentRecipientSnapshot = snapshot;
                                    updates.recipientRef = ref;
                                    updates.recipientSnapshot = snapshot;
                                }
                                dispatch({
                                    type: 'UPDATE_BLOCK',
                                    payload: { blockId: block.id, updates }
                                });
                            }}
                        />
                    </div>

                    {/* Case à cocher : Destinataire du mail différent du bénéficiaire du paiement */}
                    <div className="pt-1">
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                            <input 
                                type="checkbox" 
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                checked={!isMailRecipientLinked}
                                onChange={(e) => {
                                    const isSeparate = e.target.checked;
                                    dispatch({
                                        type: 'UPDATE_BLOCK',
                                        payload: {
                                            blockId: block.id,
                                            updates: {
                                                mailRecipientLinked: !isSeparate,
                                                mailRecipientRef: !isSeparate ? null : block.mailRecipientRef,
                                                mailRecipientSnapshot: !isSeparate ? null : block.mailRecipientSnapshot
                                            }
                                        }
                                    });
                                }}
                            />
                            <span>Le destinataire du mail est différent du bénéficiaire du paiement</span>
                        </label>
                    </div>

                    {/* Bénéficiaire du paiement (Apparaît si case cochée) */}
                    {!isMailRecipientLinked && (
                        <div className="bg-amber-50/80 p-3 rounded-md border border-amber-200 space-y-2 mt-2">
                            <div className="flex justify-between items-center">
                                <label className="block text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                                    Bénéficiaire du paiement (Banque / ING)
                                </label>
                                <div className="flex gap-1 bg-amber-200/60 p-0.5 rounded">
                                    {[
                                        { id: 'Monsieur', label: 'Mr' },
                                        { id: 'Madame', label: 'Mme' },
                                        { id: 'ACP', label: 'ACP' },
                                        { id: 'Société', label: 'Sté' }
                                    ].map(opt => {
                                        const isSel = (block.paymentCivility || 'Monsieur') === opt.id;
                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => dispatch({
                                                    type: 'UPDATE_BLOCK',
                                                    payload: { blockId: block.id, updates: { paymentCivility: opt.id } }
                                                })}
                                                className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
                                                    isSel 
                                                        ? 'bg-amber-800 text-white shadow-sm' 
                                                        : 'text-amber-900 hover:bg-amber-300/60'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <SingleRecipientSelector 
                                recipientRef={block.paymentRecipientRef || block.recipientRef}
                                recipientSnapshot={block.paymentRecipientSnapshot || block.recipientSnapshot}
                                localContacts={state.localContacts}
                                occupants={occupants}
                                intervenants={intervenants}
                                documentCandidates={state.documentCandidates || []}
                                onSelect={(ref, snapshot) => {
                                    dispatch({
                                        type: 'UPDATE_BLOCK',
                                        payload: {
                                            blockId: block.id,
                                            updates: { paymentRecipientRef: ref, paymentRecipientSnapshot: snapshot, recipientRef: ref, recipientSnapshot: snapshot }
                                        }
                                    });
                                }}
                                onCreateContact={(newContact) => {
                                    dispatch({ type: 'ADD_LOCAL_CONTACT', payload: { contact: newContact, blockId: block.id } });
                                }}
                            />
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase">IBAN</label>
                        <input 
                            type="text" 
                            className={`${FIELD_CLS} font-mono uppercase`}
                            placeholder={activeContact?.iban || "BEXX XXXX XXXX XXXX"}
                            value={block.ibanOverride || ''}
                            autoComplete="off"
                            data-form-type="other"
                            onChange={e => dispatch({ 
                                type: 'UPDATE_BLOCK', 
                                payload: { blockId: block.id, updates: { ibanOverride: e.target.value } } 
                            })}
                        />
                        {ibanCandidates.length > 0 && (
                            <select
                                className="mt-1 w-full text-[11px] text-slate-700 bg-white border border-slate-200 rounded p-1 shadow-xs cursor-pointer"
                                value=""
                                autoComplete="off"
                                onChange={(e) => {
                                    if (e.target.value) {
                                        dispatch({
                                            type: 'UPDATE_BLOCK',
                                            payload: { blockId: block.id, updates: { ibanOverride: e.target.value } }
                                        });
                                    }
                                }}
                            >
                                <option value="">-- Suggerer un IBAN ({ibanCandidates.length} disponible{ibanCandidates.length > 1 ? 's' : ''}) --</option>
                                {ibanCandidates.map((item, idx) => (
                                    <option key={idx} value={item.iban}>
                                        {item.ibanDisplay} [{item.provenance}]{!item.isValidFormat ? ' ⚠️ format non standard' : ''}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                    <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase">Statut du paiement</label>
                        <div className="flex gap-2 bg-slate-200 p-1 rounded-md">
                            <button
                                onClick={() => dispatch({ 
                                    type: 'UPDATE_BLOCK', 
                                    payload: { blockId: block.id, updates: { closureMode: CLOSURE_MODE.ATTENTE } } 
                                })}
                                className={`flex-1 py-1 text-xs font-semibold rounded transition-colors ${
                                    block.closureMode !== CLOSURE_MODE.CLOTURE 
                                        ? 'bg-white text-indigo-600 shadow-sm' 
                                        : 'text-slate-600 hover:text-slate-800'
                                }`}
                            >
                                Avance
                            </button>
                            <button
                                onClick={() => dispatch({ 
                                    type: 'UPDATE_BLOCK', 
                                    payload: { blockId: block.id, updates: { closureMode: CLOSURE_MODE.CLOTURE } } 
                                })}
                                className={`flex-1 py-1 text-xs font-semibold rounded transition-colors ${
                                    block.closureMode === CLOSURE_MODE.CLOTURE 
                                        ? 'bg-white text-indigo-600 shadow-sm' 
                                        : 'text-slate-600 hover:text-slate-800'
                                }`}
                            >
                                Clôture
                            </button>
                        </div>
                        {block.closureMode !== CLOSURE_MODE.CLOTURE && (
                            <div className="flex items-center justify-between gap-1.5 mt-2 pt-1.5 border-t border-slate-100">
                                <span className="text-[10px] font-semibold text-slate-500 uppercase">Factures pour :</span>
                                <div className="flex gap-1">
                                    <button
                                        type="button"
                                        onClick={() => dispatch({
                                            type: 'UPDATE_BLOCK',
                                            payload: { blockId: block.id, updates: { advanceType: 'solde_tva' } }
                                        })}
                                        className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-colors ${
                                            block.advanceType !== 'tva_only'
                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        Solde + TVA
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => dispatch({
                                            type: 'UPDATE_BLOCK',
                                            payload: { blockId: block.id, updates: { advanceType: 'tva_only' } }
                                        })}
                                        className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-colors ${
                                            block.advanceType === 'tva_only'
                                                ? 'bg-indigo-600 text-white shadow-xs'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        TVA uniquement
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase">Remarque éventuelle</label>
                    <textarea 
                        className={FIELD_CLS}
                        rows="2"
                        placeholder="Texte libre à insérer dans l'e-mail..."
                        value={block.remarque || ''}
                        onChange={e => dispatch({ 
                            type: 'UPDATE_BLOCK', 
                            payload: { blockId: block.id, updates: { remarque: e.target.value } } 
                        })}
                    />
                    <div className="flex justify-between items-center mt-1">
                        <div>
                            {refineError && (
                                <p className="text-[10px] text-red-500 font-medium">{refineError}</p>
                            )}
                        </div>
                        <div className="flex gap-1.5 items-center">
                            {block.remarqueOriginal !== undefined && block.remarqueOriginal !== null && (
                                <button
                                    onClick={() => dispatch({ 
                                        type: 'REVERT_REFINED_REMARQUE', 
                                        payload: { blockId: block.id } 
                                    })}
                                    className="text-[10px] text-slate-500 hover:text-slate-700 flex items-center gap-1 font-medium"
                                    title="Rétablir le texte original"
                                >
                                    <RotateCcw className="w-2.5 h-2.5" />
                                    Rétablir l'original
                                </button>
                            )}
                            <button
                                onClick={handleRefineRemarque}
                                disabled={!block.remarque?.trim() || isRefiningRemarque}
                                className={`text-[10px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${
                                    !block.remarque?.trim() || isRefiningRemarque
                                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200'
                                }`}
                            >
                                {isRefiningRemarque ? (
                                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                ) : (
                                    <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                                )}
                                {isRefiningRemarque ? 'Affinage IA...' : 'Affinage IA'}
                            </button>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase">Référence (Communication)</label>
                    <input 
                        type="text" 
                        className={FIELD_CLS}
                        placeholder="Référence de communication ING..."
                        value={block.referenceCommunication !== undefined ? block.referenceCommunication : dossierName}
                        onChange={e => dispatch({ 
                            type: 'UPDATE_BLOCK', 
                            payload: { blockId: block.id, updates: { referenceCommunication: e.target.value } } 
                        })}
                    />
                    {referenceCandidates.length > 0 && (
                        <select
                            className="mt-1 w-full text-[11px] text-slate-700 bg-white border border-slate-200 rounded p-1 shadow-xs cursor-pointer"
                            value=""
                            autoComplete="off"
                            onChange={(e) => {
                                if (e.target.value) {
                                    dispatch({
                                        type: 'UPDATE_BLOCK',
                                        payload: { blockId: block.id, updates: { referenceCommunication: e.target.value } }
                                    });
                                }
                            }}
                        >
                            <option value="">-- Insérer une référence du dossier ({referenceCandidates.length}) --</option>
                            {referenceCandidates.map((item, idx) => (
                                <option key={idx} value={item.value}>
                                    {item.value} [{item.provenance}]
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* Postes alloués & Sélection */}
            <div className="border-t border-slate-200 pt-3">
                <h4 className="text-xs font-semibold text-slate-700 mb-2">Postes alloués ({blockAllocations.length})</h4>
                
                {hasAllocations ? (
                    <ul className="space-y-1 mb-3">
                        {blockAllocations.map(alloc => {
                            const exp = expenses.find(e => e.id === alloc.expenseId);
                            if (!exp) return null;
                            const resolvedView = resolveExpenseView(exp);
                            const val = cleanAmount(alloc.montant);

                            return (
                                <li key={alloc.id} className="flex justify-between items-center text-sm py-1 border-b border-slate-100 last:border-0">
                                    <div className="flex items-center gap-2 truncate pr-2">
                                        <span className="truncate text-slate-900 font-bold">{getDisplayLabel(resolvedView, exp)}</span>
                                        {alloc.origin === 'prorata' && (
                                            <span className="px-1.5 py-0.5 rounded-sm bg-indigo-50 text-indigo-600 text-[9px] font-bold uppercase tracking-wider">Prorata</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`font-medium ${val < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                                            {val.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                                        </span>
                                        <button 
                                            onClick={() => dispatch({ type: 'REMOVE_ALLOCATION', payload: alloc.id })}
                                            className="text-slate-400 hover:text-red-500 p-0.5 rounded transition-colors"
                                            title="Retirer l'allocation (renvoie le poste à gauche)"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-200 rounded-md p-2.5 mb-3">
                        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-indigo-800 font-medium">
                            Ajoutez au moins un poste à ce paiement pour pouvoir générer le mail et l'export bancaire.
                        </p>
                    </div>
                )}

                <div className={`flex flex-col gap-2 p-2 rounded border transition-colors ${
                    !hasAllocations
                        ? 'bg-indigo-50/60 border-indigo-300 ring-2 ring-indigo-500/20'
                        : 'bg-slate-50 border-slate-200'
                }`}>
                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Poste à ajouter</label>
                            <select 
                                className="w-full text-xs border-slate-300 rounded p-1.5 bg-white text-slate-900 font-medium"
                                value={expenseToAdd}
                                onChange={e => setExpenseToAdd(e.target.value)}
                            >
                                <option value="" className="text-slate-500 bg-white">-- Choisir un poste --</option>
                                {availableExpenses.map(exp => {
                                    const reste = getResteAVentiler(exp, state.allocations);
                                    const resolved = resolveExpenseView(exp);
                                    return (
                                        <option key={exp.id} value={exp.id} className="text-slate-900 bg-white py-1 font-semibold">
                                            {getDisplayLabel(resolved, exp)} (Dispo: {reste.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €)
                                        </option>
                                    );
                                })}
                            </select>
                        </div>
                        <div className="w-24">
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Montant (opt.)</label>
                            <input 
                                type="number" 
                                className={FIELD_CLS}
                                placeholder="Tout"
                                value={splitAmount}
                                onChange={e => setSplitAmount(e.target.value)}
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <button 
                            onClick={handleAddAllocation}
                            disabled={!expenseToAdd}
                            className={`p-1.5 rounded transition-colors ${expenseToAdd ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                            title="Ajouter au paiement"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>

                    {availableExpenses.length > 0 && (
                        <button
                            type="button"
                            onClick={handleAddAllAvailable}
                            className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-indigo-700 bg-indigo-100/70 hover:bg-indigo-200/80 border border-indigo-300 rounded py-1.5 transition-colors shadow-xs"
                            title="Affecte à ce paiement tous les postes du panier non encore alloués, pour leur montant restant exact"
                        >
                            <ListPlus className="w-3.5 h-3.5" />
                            Ajouter tous les postes disponibles ({availableExpenses.length})
                        </button>
                    )}
                </div>
            </div>

            {/* Pied du bloc : Total & Exportation de ce règlement */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-200 bg-slate-50 -mx-5 -mb-5 p-4 rounded-b-xl">
                <div className="text-xs font-bold text-slate-700">
                    Total : {totalBlockEuro.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleCopyINGBlock}
                        disabled={!hasAllocations}
                        className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded shadow-sm transition-colors ${
                            hasAllocations
                                ? 'bg-[#ff6200] hover:bg-[#e65800] text-white'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                        title={hasAllocations ? "Copier le format ING pour ce paiement" : "Allouez au moins 1 poste pour activer la copie ING"}
                    >
                        <Copy className="w-3.5 h-3.5" />
                        {copyFeedback === 'ing' ? 'Copié ✓' : 'Copier (ING)'}
                    </button>
                    <button 
                        onClick={handleCopyMail}
                        disabled={!hasAllocations}
                        className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded shadow-sm transition-colors ${
                            hasAllocations
                                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                        title={hasAllocations ? "Copier l'e-mail personnalisé pour ce destinataire" : "Allouez au moins 1 poste pour activer la copie du mail"}
                    >
                        <Mail className="w-3.5 h-3.5" />
                        {copyFeedback === 'mail' ? 'Copié ✓' : 'Copier le mail'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SplitterRecipientBlock;
