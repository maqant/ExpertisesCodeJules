import React, { useState } from 'react';
import { cleanAmount } from '../../../store/financeStore.js';
import { ALLOCATION_STATUS } from '../../../domain/decompteSplitter/allocationModel.js';
import { useDecompteSplitter } from './DecompteSplitterProvider.jsx';
import { getHumanLabel, resolveExpenseView } from '../../../domain/decompteSplitter/labelResolver.js';
import { formatPersonName } from '../../../services/utils/formatUtils.js';
import { Check, X } from 'lucide-react';

const ProrataBasePopover = ({ targetExpense, expenses, allocations, onApply, onClose }) => {
    const { state } = useDecompteSplitter();

    // 1. Identify eligible base expenses
    const eligibleExpenses = expenses.filter(exp => {
        if (exp.id === targetExpense.id) return false;
        const activeAllocs = allocations.filter(a => a.expenseId === exp.id && a.status !== ALLOCATION_STATUS.SUSPENDED);
        return activeAllocs.length > 0;
    });

    // 2. Local state for selection
    const [selectedIds, setSelectedIds] = useState(new Set(eligibleExpenses.map(e => e.id)));

    const toggleExpense = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const handleApply = () => {
        if (selectedIds.size === 0) {
            alert('Veuillez sélectionner au moins un frais de référence.');
            return;
        }
        onApply(Array.from(selectedIds));
    };

    return (
        <div className="absolute left-0 right-0 top-full mt-2 z-10 bg-white border border-slate-200 rounded-lg shadow-xl p-3">
            <h4 className="text-xs font-bold text-slate-700 mb-2">Base de calcul du prorata</h4>
            <div className="space-y-1.5 mb-3 max-h-40 overflow-y-auto custom-scrollbar">
                {eligibleExpenses.map(exp => {
                    const expAllocs = allocations.filter(a => a.expenseId === exp.id && a.status !== ALLOCATION_STATUS.SUSPENDED);
                    const allocatedTotal = expAllocs.reduce((s, a) => s + cleanAmount(a.montant), 0);
                    
                    const recipientNames = expAllocs.map(a => {
                        const block = (state?.blocks || []).find(b => b.id === a.blockId);
                        if (!block) return 'Destinataire non défini';
                        const snapshot = block.paymentRecipientSnapshot || block.recipientSnapshot;
                        const name = snapshot?.displayName || block.paymentRecipientNom || 'Destinataire non défini';
                        return formatPersonName(name);
                    });
                    const recipientLabel = recipientNames.length > 0 ? Array.from(new Set(recipientNames)).join(', ') : 'Non alloué';
                    const humanLabel = getHumanLabel(resolveExpenseView(exp), exp);
                    const fullDisplay = `${humanLabel} (${recipientLabel})`;

                    return (
                        <label key={exp.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded">
                            <input 
                                type="checkbox" 
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                checked={selectedIds.has(exp.id)}
                                onChange={() => toggleExpense(exp.id)}
                            />
                            <span className="truncate flex-1 text-slate-700 font-medium text-xs" title={fullDisplay}>{fullDisplay}</span>
                            <span className="font-semibold text-slate-800 whitespace-nowrap text-xs">{allocatedTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</span>
                        </label>
                    );
                })}
                {eligibleExpenses.length === 0 && (
                    <p className="text-xs text-slate-500 italic">Aucun autre poste disponible.</p>
                )}
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={onClose}
                    className="flex-1 py-1.5 px-2 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
                >
                    Annuler
                </button>
                <button 
                    onClick={handleApply}
                    disabled={selectedIds.size === 0}
                    className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                    <Check className="w-3.5 h-3.5" />
                    Appliquer
                </button>
            </div>
        </div>
    );
};

export default ProrataBasePopover;
