import React, { useState } from 'react';
import { useDecompteSplitter } from './DecompteSplitterProvider.jsx';
import { CLOSURE_MODE, getResteAVentiler, ALLOCATION_STATUS } from '../../../domain/decompteSplitter/allocationModel.js';
import SingleRecipientSelector from './SingleRecipientSelector.jsx';
import { useSingleRecipient } from '../../../hooks/useSingleRecipient.js';
import { resolveRecipientSnapshot } from '../../../services/utils/contactUtils.js';
import { Trash2, Plus, Copy, Mail, Sparkles, RotateCcw, Link2, Unlink, Loader2 } from 'lucide-react';
import { cleanAmount } from '../../../store/financeStore.js';
import { buildEmailTemplate } from '../../../services/export/emailTemplateBuilder.js';
import { buildINGTsvExport } from '../../../services/export/tsvBuilder.js';
import { refineRemarqueText } from '../../../services/ai/remarqueRefiner.js';

const SplitterRecipientBlock = ({ block, expenses, occupants, intervenants, dossierName }) => {
    const { state, dispatch } = useDecompteSplitter();
    
    // Destinataire du PAIEMENT (ING / Excel)
    const paymentRecipientRef = block.paymentRecipientRef || block.recipientRef;
    const paymentRecipientState = useSingleRecipient({ 
        occupants, 
        intervenants, 
        localContacts: state.localContacts,
        recipientRef: paymentRecipientRef 
    });

    // Destinataire de l'E-MAIL
    const isMailLinked = block.mailRecipientLinked !== false;
    const mailRecipientRef = isMailLinked ? paymentRecipientRef : (block.mailRecipientRef || paymentRecipientRef);
    const mailRecipientState = useSingleRecipient({
        occupants,
        intervenants,
        localContacts: state.localContacts,
        recipientRef: mailRecipientRef
    });

    const [expenseToAdd, setExpenseToAdd] = useState('');
    const [splitAmount, setSplitAmount] = useState('');
    const [isRefining, setIsRefining] = useState(false);
    const [aiError, setAiError] = useState(null);

    const blockAllocations = state.allocations.filter(a => a.blockId === block.id && a.status === 'assigned');
    const totalAlloue = blockAllocations.reduce((sum, a) => sum + cleanAmount(a.montant), 0);

    const handleSelectPaymentRef = (ref) => {
        dispatch({
            type: 'SET_BLOCK_PAYMENT_RECIPIENT',
            payload: { blockId: block.id, recipientRef: ref }
        });
    };

    const handleSelectMailRef = (ref) => {
        dispatch({
            type: 'SET_BLOCK_MAIL_RECIPIENT',
            payload: { blockId: block.id, mailRecipientRef: ref }
        });
    };

    const handleToggleLinkMode = () => {
        if (!isMailLinked) {
            dispatch({ type: 'LINK_MAIL_TO_PAYMENT', payload: { blockId: block.id } });
        } else {
            dispatch({
                type: 'SET_BLOCK_MAIL_RECIPIENT',
                payload: { blockId: block.id, mailRecipientRef: paymentRecipientRef }
            });
        }
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
        const paymentSnapshot = block.paymentRecipientSnapshot || block.recipientSnapshot || resolveRecipientSnapshot(paymentRecipientRef, paymentRecipientState.candidates);
        const mailSnapshot = block.mailRecipientSnapshot || (isMailLinked ? paymentSnapshot : resolveRecipientSnapshot(mailRecipientRef, mailRecipientState.candidates));
        
        const text = buildEmailTemplate(
            { 
                ...block, 
                paymentRecipientSnapshot: paymentSnapshot, 
                mailRecipientSnapshot: mailSnapshot,
                recipientSnapshot: paymentSnapshot 
            }, 
            state.allocations, 
            expenses
        );
        if (text) {
            navigator.clipboard.writeText(text);
        }
    };

    const handleCopyING = () => {
        const tsvContent = buildINGTsvExport(state, expenses, dossierName, block.id, paymentRecipientState.candidates);
        navigator.clipboard.writeText(tsvContent);
    };

    const handleRefineRemarque = async () => {
        if (!block.remarque || !block.remarque.trim() || isRefining) return;
        setIsRefining(true);
        setAiError(null);

        try {
            const mailSnapshot = block.mailRecipientSnapshot || (isMailLinked ? block.paymentRecipientSnapshot || block.recipientSnapshot : null) || resolveRecipientSnapshot(mailRecipientRef, mailRecipientState.candidates);
            const refined = await refineRemarqueText({
                remarque: block.remarque,
                context: {
                    mailRecipientSnapshot: mailSnapshot,
                    dossierName
                }
            });
            dispatch({
                type: 'APPLY_REFINED_REMARQUE',
                payload: { blockId: block.id, refinedText: refined }
            });
        } catch (err) {
            console.error('[RemarqueRefiner Error]', err);
            setAiError(err.message || "Erreur d'affinage IA");
        } finally {
            setIsRefining(false);
        }
    };

    const handleRevertRemarque = () => {
        dispatch({
            type: 'REVERT_REFINED_REMARQUE',
            payload: { blockId: block.id }
        });
    };

    return (
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Bloc de règlement
                </span>
                <button 
                    onClick={() => dispatch({ type: 'REMOVE_BLOCK', payload: block.id })}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    title="Supprimer ce bloc"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>

            {/* SÉLECTEURS DE DESTINATAIRES (PAIEMENT vs MAIL) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                        💳 Destinataire du paiement (ING / Excel)
                    </label>
                    <SingleRecipientSelector 
                        recipientState={paymentRecipientState} 
                        onSelectRef={handleSelectPaymentRef}
                        onCreateContact={handleCreateContact}
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                        <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                            ✉️ Destinataire de l'e-mail
                        </label>
                        <button
                            type="button"
                            onClick={handleToggleLinkMode}
                            className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded transition-colors ${
                                isMailLinked 
                                    ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' 
                                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            }`}
                            title={isMailLinked ? "Cliquer pour dissocier le destinataire e-mail" : "Cliquer pour lier au destinataire du paiement"}
                        >
                            {isMailLinked ? <Link2 className="w-3 h-3" /> : <Unlink className="w-3 h-3" />}
                            {isMailLinked ? 'Lié au paiement' : 'Personnalisé'}
                        </button>
                    </div>
                    <SingleRecipientSelector 
                        recipientState={mailRecipientState} 
                        onSelectRef={handleSelectMailRef}
                        onCreateContact={handleCreateContact}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">IBAN</label>
                    <input 
                        type="text" 
                        placeholder="BEXX XXXX XXXX XXXX"
                        className="w-full text-sm border-slate-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500 uppercase"
                        value={block.ibanOverride || ''}
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

            {/* REMARQUE ÉVENTUELLE & BOUTON NANO-AGENT IA */}
            <div>
                <div className="flex justify-between items-center mb-1">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        Remarque éventuelle
                    </label>
                    <div className="flex items-center gap-2">
                        {block.remarqueOriginal !== null && (
                            <button
                                type="button"
                                onClick={handleRevertRemarque}
                                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-1.5 py-0.5 rounded transition-colors"
                                title="Rétablir le texte original avant affinage IA"
                            >
                                <RotateCcw className="w-3 h-3" />
                                Rétablir l'original
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleRefineRemarque}
                            disabled={!block.remarque || !block.remarque.trim() || isRefining}
                            className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2.5 py-1 rounded-md transition-colors disabled:opacity-50"
                            title="Reformuler avec le nano-agent IA (gpt-5.6-luna) pour un rendu fluide dans le mail"
                        >
                            {isRefining ? <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-600" />}
                            {isRefining ? 'Affinage en cours...' : 'Affinage IA ✨'}
                        </button>
                    </div>
                </div>
                <textarea 
                    rows={2}
                    className="w-full text-sm border-slate-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500 resize-none"
                    placeholder="Texte libre à insérer dans l'e-mail..."
                    value={block.remarque || ''}
                    onChange={e => dispatch({ 
                        type: 'UPDATE_BLOCK', 
                        payload: { blockId: block.id, updates: { remarque: e.target.value } } 
                    })}
                />
                {aiError && (
                    <p className="text-[11px] text-red-600 mt-1">{aiError}</p>
                )}
            </div>

            <div className="mt-1">
                <label className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Référence (Communication)</label>
                <input 
                    type="text" 
                    className="w-full text-sm border-slate-300 rounded-md focus:border-indigo-500 focus:ring-indigo-500"
                    placeholder="Référence de communication ING..."
                    value={block.referenceCommunication !== undefined ? block.referenceCommunication : dossierName}
                    onChange={e => dispatch({ 
                        type: 'UPDATE_BLOCK', 
                        payload: { blockId: block.id, updates: { referenceCommunication: e.target.value } } 
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
                                    <div className="flex items-center gap-2 truncate pr-2">
                                        <span className="truncate text-slate-600">{exp.desc || exp.type}</span>
                                        {alloc.origin === 'prorata' && (
                                            <span className="px-1.5 py-0.5 rounded-sm bg-indigo-50 text-indigo-600 text-[9px] font-bold uppercase tracking-wider">Prorata</span>
                                        )}
                                    </div>
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
                                const isSuspended = state.allocations.some(a => a.expenseId === exp.id && a.status === ALLOCATION_STATUS.SUSPENDED);
                                if (isSuspended) return null;

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
                <div className="flex gap-2">
                    <button 
                        onClick={handleCopyING}
                        disabled={blockAllocations.length === 0 || (!paymentRecipientRef && !block.paymentRecipientSnapshot?.displayName && !block.recipientSnapshot?.displayName)}
                        className="flex items-center gap-1.5 text-xs font-medium bg-[#ff6200] text-white px-3 py-1.5 rounded hover:bg-[#e65800] disabled:opacity-50 transition-colors"
                        title="Copier spécifiquement ce paiement pour la macro ING"
                    >
                        <Copy className="w-3.5 h-3.5" />
                        Copier (ING)
                    </button>
                    <button 
                        onClick={handleCopyMail}
                        disabled={blockAllocations.length === 0 || (!paymentRecipientRef && !mailRecipientRef)}
                        className="flex items-center gap-1.5 text-xs font-medium bg-slate-800 text-white px-3 py-1.5 rounded hover:bg-slate-700 disabled:opacity-50 transition-colors"
                    >
                        <Mail className="w-3.5 h-3.5" />
                        Copier le mail
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SplitterRecipientBlock;
