import React, { useState } from 'react';
import { useDecompteSplitter } from './DecompteSplitterProvider.jsx';
import { CLOSURE_MODE, getResteAVentiler } from '../../../domain/decompteSplitter/allocationModel.js';
import SingleRecipientSelector from './SingleRecipientSelector.jsx';
import { useSingleRecipient } from '../../../hooks/useSingleRecipient.js';
import { resolveRecipientSnapshot } from '../../../services/utils/contactUtils.js';
import { Trash2, Plus, Copy, Mail } from 'lucide-react';
import { cleanAmount } from '../../../store/financeStore.js';
import { buildEmailTemplate } from '../../../services/export/emailTemplateBuilder.js';

const SplitterRecipientBlock = ({ block, expenses, occupants, intervenants }) => {
    const { state, dispatch } = useDecompteSplitter();
    
    // Hook local pour la sélection du destinataire
    const recipientState = useSingleRecipient({ 
        occupants, 
        intervenants, 
        localContacts: state.localContacts,
        recipientRef: block.recipientRef 
    });

    const [expenseToAdd, setExpenseToAdd] = useState('');
    const [splitAmount, setSplitAmount] = useState('');

    const blockAllocations = state.allocations.filter(a => a.blockId === block.id && a.status === 'assigned');
    const totalAlloue = blockAllocations.reduce((sum, a) => sum + cleanAmount(a.montant), 0);

    const handleSelectRef = (ref) => {
        dispatch({
            type: 'SET_BLOCK_RECIPIENT',
            payload: { blockId: block.id, recipientRef: ref }
        });
    };

    const handleCreateContact = (contact) => {
        dispatch({
            type: 'ADD_LOCAL_CONTACT',
            payload: { blockId: block.id, contact }
        });
    };

    const handleAddAllocation = () => {
        if (!expenseToAdd) return;
        const exp = expenses.find(e => e.id === expenseToAdd);
        if (!exp) return;

        const reste = getResteAVentiler(exp, state.allocations);
        const montantAAllouer = splitAmount ? cleanAmount(splitAmount) : reste;

        if (montantAAllouer > 0) {
            dispatch({
                type: 'ASSIGN_ALLOCATION',
                payload: {
                    expenseId: exp.id,
                    blockId: block.id,
                    montant: montantAAllouer.toString()
                }
            });
        }
        
        setExpenseToAdd('');
        setSplitAmount('');
    };

    const handleCopyMail = () => {
        const snapshot = block.recipientSnapshot || resolveRecipientSnapshot(block.recipientRef, recipientState.candidates);
        const text = buildEmailTemplate({ ...block, recipientSnapshot: snapshot }, state.allocations, expenses);
        if (text) {
            navigator.clipboard.writeText(text);
            // On pourrait ajouter un toast de succès ici
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 flex flex-col gap-4">
            <div className="flex justify-between items-start">
                <div className="flex-1 max-w-sm">
                    <SingleRecipientSelector 
                        recipientState={recipientState} 
                        onSelectRef={handleSelectRef}
                        onCreateContact={handleCreateContact}
                    />
                </div>
                <button 
                    onClick={() => dispatch({ type: 'REMOVE_BLOCK', payload: block.id })}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="Supprimer ce bloc"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">IBAN</label>
                    <input 
                        type="text" 
                        placeholder="BEXX XXXX XXXX XXXX"
                        className="w-full text-sm border-slate-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500 uppercase"
                        value={block.ibanOverride}
                        onChange={e => dispatch({ 
                            type: 'UPDATE_BLOCK', 
                            payload: { blockId: block.id, updates: { ibanOverride: e.target.value } } 
                        })}
                    />
                </div>
                <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Statut du paiement</label>
                    <div className="flex bg-slate-100 p-0.5 rounded-md">
                        <button
                            className={`flex-1 text-xs font-medium py-1.5 rounded-sm transition-colors ${block.closureMode === CLOSURE_MODE.ATTENTE ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => dispatch({ type: 'UPDATE_BLOCK', payload: { blockId: block.id, updates: { closureMode: CLOSURE_MODE.ATTENTE } } })}
                        >
                            Avance
                        </button>
                        <button
                            className={`flex-1 text-xs font-medium py-1.5 rounded-sm transition-colors ${block.closureMode === CLOSURE_MODE.CLOTURE ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                            onClick={() => dispatch({ type: 'UPDATE_BLOCK', payload: { blockId: block.id, updates: { closureMode: CLOSURE_MODE.CLOTURE } } })}
                        >
                            Clôture
                        </button>
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Remarque éventuelle</label>
                <textarea 
                    rows={2}
                    className="w-full text-sm border-slate-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500 resize-none"
                    placeholder="Texte libre à insérer dans l'e-mail..."
                    value={block.remarque}
                    onChange={e => dispatch({ 
                        type: 'UPDATE_BLOCK', 
                        payload: { blockId: block.id, updates: { remarque: e.target.value } } 
                    })}
                />
            </div>

            <div className="border-t border-slate-200 pt-3">
                <h4 className="text-xs font-semibold text-slate-700 mb-2">Postes alloués ({blockAllocations.length})</h4>
                
                {blockAllocations.length > 0 ? (
                    <ul className="space-y-1 mb-3">
                        {blockAllocations.map(alloc => {
                            const exp = expenses.find(e => e.id === alloc.expenseId);
                            if (!exp) return null;
                            return (
                                <li key={alloc.id} className="flex justify-between items-center text-sm py-1 border-b border-slate-100 last:border-0">
                                    <span className="truncate pr-2 text-slate-600">{exp.desc || exp.type}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-slate-800">{cleanAmount(alloc.montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                                        <button 
                                            onClick={() => dispatch({ type: 'REMOVE_ALLOCATION', payload: alloc.id })}
                                            className="text-slate-400 hover:text-red-500"
                                            title="Retirer l'allocation"
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
                            className="w-full text-xs border-slate-300 rounded p-1.5"
                            value={expenseToAdd}
                            onChange={e => setExpenseToAdd(e.target.value)}
                        >
                            <option value="">-- Choisir un poste --</option>
                            {expenses.map(exp => {
                                const reste = getResteAVentiler(exp, state.allocations);
                                if (reste <= 0.001) return null;
                                return (
                                    <option key={exp.id} value={exp.id}>
                                        {exp.desc || exp.type} (Dispo: {reste} €)
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                    <div className="w-24">
                        <label className="block text-[10px] text-slate-500 mb-1">Montant (opt.)</label>
                        <input 
                            type="number" 
                            className="w-full text-xs border-slate-300 rounded p-1.5"
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
                        className="p-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 rounded disabled:opacity-50 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="flex justify-between items-center border-t border-slate-200 pt-3 mt-1">
                <div className="text-sm font-semibold text-slate-800">
                    Total : {totalAlloue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </div>
                <button 
                    onClick={handleCopyMail}
                    disabled={blockAllocations.length === 0 || !block.recipientRef}
                    className="flex items-center gap-1.5 text-xs font-medium bg-slate-800 text-white px-3 py-1.5 rounded hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                    <Mail className="w-3.5 h-3.5" />
                    Copier le mail
                </button>
            </div>
        </div>
    );
};

export default SplitterRecipientBlock;
