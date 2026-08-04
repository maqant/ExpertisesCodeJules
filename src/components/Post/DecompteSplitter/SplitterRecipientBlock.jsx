import React, { useState } from 'react';
import { useDecompteSplitter } from './DecompteSplitterProvider.jsx';
import { cleanAmount } from '../../../store/financeStore.js';
import { getResteAVentiler, isResteEpuise, ALLOCATION_STATUS, CLOSURE_MODE } from '../../../domain/decompteSplitter/allocationModel.js';
import { getBlockTotalEuro, resolveBlockRecipientContact } from '../../../domain/decompteSplitter/blockRecipientModel.js';
import RecipientSelector from './RecipientSelector.jsx';
import { Trash2, Plus, ArrowRightLeft, Sparkles, RotateCcw, Copy } from 'lucide-react';
import { resolveExpenseView } from '../../../domain/decompteSplitter/labelResolver.js';

export const SplitterRecipientBlock = ({ block, expenses, occupants, intervenants, dossierName }) => {
    const { state, dispatch } = useDecompteSplitter();
    const [splitAmount, setSplitAmount] = useState('');
    const [expenseToAdd, setExpenseToAdd] = useState('');

    const blockAllocations = state.allocations.filter(a => a.blockId === block.id);
    const totalBlockEuro = getBlockTotalEuro(block.id, state.allocations, expenses);

    const activeContact = resolveBlockRecipientContact(block, state.localContacts, { occupants, intervenants });

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

            {/* Formulaire destinataire (ING / Excel) */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                Destinataire du paiement (ING / Excel)
                            </label>
                            <button
                                onClick={() => dispatch({
                                    type: 'UPDATE_BLOCK',
                                    payload: {
                                        blockId: block.id,
                                        updates: {
                                            isMailRecipientLinked: !block.isMailRecipientLinked,
                                            mailRecipientRef: !block.isMailRecipientLinked ? null : block.mailRecipientRef,
                                            mailRecipientSnapshot: !block.isMailRecipientLinked ? null : block.mailRecipientSnapshot
                                        }
                                    }
                                })}
                                className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors flex items-center gap-1 ${
                                    block.isMailRecipientLinked 
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold' 
                                        : 'bg-slate-100 border-slate-300 text-slate-500 hover:text-slate-700'
                                }`}
                                title={block.isMailRecipientLinked ? "Cliquez pour séparer le destinataire de l'e-mail" : "Cliquez pour lier le destinataire du paiement à l'e-mail"}
                            >
                                <ArrowRightLeft className="w-2.5 h-2.5" />
                                {block.isMailRecipientLinked ? 'Lié au paiement' : 'Séparer e-mail'}
                            </button>
                        </div>
                        <RecipientSelector 
                            recipientRef={block.recipientRef}
                            recipientSnapshot={block.recipientSnapshot}
                            localContacts={state.localContacts}
                            occupants={occupants}
                            intervenants={intervenants}
                            onSelectRecipient={(ref, snapshot) => {
                                const updates = { recipientRef: ref, recipientSnapshot: snapshot };
                                if (block.isMailRecipientLinked) {
                                    updates.mailRecipientRef = ref;
                                    updates.mailRecipientSnapshot = snapshot;
                                }
                                dispatch({
                                    type: 'UPDATE_BLOCK',
                                    payload: { blockId: block.id, updates }
                                });
                            }}
                            onCreateLocalContact={(newContact) => {
                                dispatch({ type: 'ADD_LOCAL_CONTACT', payload: newContact });
                                const ref = { kind: 'local', id: newContact.id };
                                const snapshot = { displayName: newContact.nom, iban: newContact.iban, isCompany: false };
                                const updates = { recipientRef: ref, recipientSnapshot: snapshot };
                                if (block.isMailRecipientLinked) {
                                    updates.mailRecipientRef = ref;
                                    updates.mailRecipientSnapshot = snapshot;
                                }
                                dispatch({
                                    type: 'UPDATE_BLOCK',
                                    payload: { blockId: block.id, updates }
                                });
                            }}
                        />
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Destinataire de l'e-mail
                        </label>
                        {block.isMailRecipientLinked ? (
                            <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-md text-xs text-slate-500 flex items-center justify-between">
                                <span>Identique au destinataire du paiement</span>
                                <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-medium">Synchronisé</span>
                            </div>
                        ) : (
                            <RecipientSelector 
                                recipientRef={block.mailRecipientRef}
                                recipientSnapshot={block.mailRecipientSnapshot}
                                localContacts={state.localContacts}
                                occupants={occupants}
                                intervenants={intervenants}
                                onSelectRecipient={(ref, snapshot) => dispatch({
                                    type: 'UPDATE_BLOCK',
                                    payload: { blockId: block.id, updates: { mailRecipientRef: ref, mailRecipientSnapshot: snapshot } }
                                })}
                                onCreateLocalContact={(newContact) => {
                                    dispatch({ type: 'ADD_LOCAL_CONTACT', payload: newContact });
                                    dispatch({
                                        type: 'UPDATE_BLOCK',
                                        payload: {
                                            blockId: block.id,
                                            updates: {
                                                mailRecipientRef: { kind: 'local', id: newContact.id },
                                                mailRecipientSnapshot: { displayName: newContact.nom, iban: newContact.iban, isCompany: false }
                                            }
                                        }
                                    });
                                }}
                            />
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase">IBAN</label>
                        <input 
                            type="text" 
                            className="w-full text-xs border-slate-300 rounded p-1.5 font-mono uppercase bg-white"
                            placeholder={activeContact?.iban || "BEXX XXXX XXXX XXXX"}
                            value={block.ibanOverride || ''}
                            onChange={e => dispatch({ 
                                type: 'UPDATE_BLOCK', 
                                payload: { blockId: block.id, updates: { ibanOverride: e.target.value } } 
                            })}
                        />
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
                                    block.closureMode === CLOSURE_MODE.ATTENTE 
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
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] font-medium text-slate-500 uppercase">Remarque éventuelle</label>
                        <div className="flex gap-1.5">
                            {block.remarqueOriginal !== undefined && (
                                <button
                                    onClick={() => dispatch({ 
                                        type: 'UPDATE_BLOCK', 
                                        payload: { blockId: block.id, updates: { remarque: block.remarqueOriginal } } 
                                    })}
                                    className="text-[10px] text-slate-500 hover:text-slate-700 flex items-center gap-1"
                                >
                                    <RotateCcw className="w-2.5 h-2.5" />
                                    Rétablir l'original
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    // Nano-agent remarque_refine
                                    const text = block.remarque || '';
                                    const refined = text.replace(/nous/gi, 'je').trim();
                                    dispatch({
                                        type: 'UPDATE_BLOCK',
                                        payload: { blockId: block.id, updates: { remarque: refined, remarqueOriginal: text } }
                                    });
                                }}
                                className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100"
                            >
                                <Sparkles className="w-2.5 h-2.5" />
                                Affinage IA
                            </button>
                        </div>
                    </div>
                    <textarea 
                        className="w-full text-xs border-slate-300 rounded p-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        rows="2"
                        placeholder="Texte libre à insérer dans l'e-mail..."
                        value={block.remarque || ''}
                        onChange={e => dispatch({ 
                            type: 'UPDATE_BLOCK', 
                            payload: { blockId: block.id, updates: { remarque: e.target.value } } 
                        })}
                    />
                </div>

                <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-1 uppercase">Référence (Communication)</label>
                    <input 
                        type="text" 
                        className="w-full text-xs border-slate-300 rounded p-1.5 bg-white"
                        placeholder="Référence de communication ING..."
                        value={block.referenceCommunication !== undefined ? block.referenceCommunication : dossierName}
                        onChange={e => dispatch({ 
                            type: 'UPDATE_BLOCK', 
                            payload: { blockId: block.id, updates: { referenceCommunication: e.target.value } } 
                        })}
                    />
                </div>
            </div>

            {/* Postes alloués & Sélection */}
            <div className="border-t border-slate-200 pt-3">
                <h4 className="text-xs font-semibold text-slate-700 mb-2">Postes alloués ({blockAllocations.length})</h4>
                
                {blockAllocations.length > 0 ? (
                    <ul className="space-y-1 mb-3">
                        {blockAllocations.map(alloc => {
                            const exp = expenses.find(e => e.id === alloc.expenseId);
                            if (!exp) return null;
                            const resolvedView = resolveExpenseView(exp);
                            const val = cleanAmount(alloc.montant);

                            return (
                                <li key={alloc.id} className="flex justify-between items-center text-sm py-1 border-b border-slate-100 last:border-0">
                                    <div className="flex items-center gap-2 truncate pr-2">
                                        <span className="truncate text-slate-700 font-medium">{resolvedView.computedLabel}</span>
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
                    <p className="text-xs text-slate-400 italic mb-3">Aucun poste assigné à ce destinataire.</p>
                )}

                <div className="flex gap-2 items-end bg-slate-50 p-2 rounded border border-slate-200">
                    <div className="flex-1">
                        <label className="block text-[10px] text-slate-500 mb-1">Poste à ajouter</label>
                        <select 
                            className="w-full text-xs border-slate-300 rounded p-1.5 bg-white"
                            value={expenseToAdd}
                            onChange={e => setExpenseToAdd(e.target.value)}
                        >
                            <option value="">-- Choisir un poste --</option>
                            {expenses.map(exp => {
                                const isSuspended = state.allocations.some(a => a.expenseId === exp.id && a.status === ALLOCATION_STATUS.SUSPENDED);
                                if (isSuspended) return null;

                                const reste = getResteAVentiler(exp, state.allocations);
                                // Validation symétrique : les montants négatifs (reste < -0.001) sont conservés et sélectionnables !
                                if (isResteEpuise(reste)) return null;

                                const resolved = resolveExpenseView(exp);
                                return (
                                    <option key={exp.id} value={exp.id}>
                                        {resolved.computedLabel} (Dispo: {reste.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €)
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                    <div className="w-24">
                        <label className="block text-[10px] text-slate-500 mb-1">Montant (opt.)</label>
                        <input 
                            type="number" 
                            className="w-full text-xs border-slate-300 rounded p-1.5 bg-white"
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
                        className={`p-1.5 rounded transition-colors ${expenseToAdd ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                        title="Ajouter au paiement"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Pied du bloc : Total du règlement */}
            <div className="flex justify-between items-center pt-3 border-t border-slate-200 bg-slate-50 -mx-5 -mb-5 p-4 rounded-b-xl">
                <div className="text-xs font-bold text-slate-700">
                    Total : {totalBlockEuro.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                </div>
            </div>
        </div>
    );
};

export default SplitterRecipientBlock;
