import React from 'react';
import { useDecompteSplitter } from './DecompteSplitterProvider.jsx';
import { cleanAmount } from '../../../store/financeStore.js';
import { getResteAVentiler, ALLOCATION_STATUS } from '../../../domain/decompteSplitter/allocationModel.js';
import { CheckCircle2, AlertCircle, Ban, ArrowRightCircle } from 'lucide-react';

const SplitterGlobalBasket = ({ expenses }) => {
    const { state, dispatch } = useDecompteSplitter();
    const { allocations } = state;

    return (
        <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200">
            <div className="p-4 border-b border-slate-200 bg-white">
                <h2 className="text-lg font-semibold text-slate-800">Panier Global</h2>
                <p className="text-xs text-slate-500 mt-1">Postes financiers à ventiler</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {expenses.length === 0 ? (
                    <div className="text-sm text-slate-400 italic text-center py-6">
                        Aucun poste financier à ventiler.
                    </div>
                ) : (
                    expenses.map(exp => {
                        const cible = cleanAmount(exp.montantValide || exp.montantReclame);
                        const reste = getResteAVentiler(exp, allocations);
                        const isSuspended = allocations.some(a => a.expenseId === exp.id && a.status === ALLOCATION_STATUS.SUSPENDED);
                        
                        let statusConfig = { bg: 'bg-white', border: 'border-slate-200', icon: null, text: '' };
                        
                        if (isSuspended) {
                            statusConfig = { bg: 'bg-slate-100 opacity-60', border: 'border-slate-300', icon: <Ban className="w-4 h-4 text-slate-500" />, text: 'En suspens' };
                        } else if (Math.abs(reste) < 0.001) {
                            statusConfig = { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />, text: 'Alloué' };
                        } else if (Math.abs(reste) !== Math.abs(cible)) {
                            statusConfig = { bg: 'bg-amber-50', border: 'border-amber-200', icon: <ArrowRightCircle className="w-4 h-4 text-amber-600" />, text: 'Partiel' };
                        } else {
                            statusConfig = { bg: 'bg-white', border: 'border-slate-200', icon: <AlertCircle className="w-4 h-4 text-slate-400" />, text: 'À ventiler' };
                        }

                        return (
                            <div key={exp.id} className={`p-3 rounded-lg border shadow-sm transition-colors ${statusConfig.bg} ${statusConfig.border}`}>
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-sm font-medium text-slate-700 truncate pr-2" title={exp.desc || exp.type}>
                                        {exp.desc || exp.type || 'Poste inconnu'}
                                    </span>
                                    <span className="text-sm font-bold text-slate-800 whitespace-nowrap">
                                        {cible.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                    </span>
                                </div>
                                
                                <div className="flex justify-between items-center mt-2">
                                    <div className="flex items-center gap-1.5">
                                        {statusConfig.icon}
                                        <span className="text-xs font-medium text-slate-600">{statusConfig.text}</span>
                                    </div>
                                    
                                    {!isSuspended && Math.abs(reste) > 0.001 && (
                                        <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                            Reste : {reste.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                        </span>
                                    )}
                                </div>

                                <div className="mt-3 flex gap-2">
                                    {isSuspended ? (
                                        <button 
                                            onClick={() => dispatch({ type: 'UNSUSPEND_EXPENSE', payload: { expenseId: exp.id } })}
                                            className="flex-1 py-1 px-2 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
                                        >
                                            Réactiver
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => dispatch({ type: 'SUSPEND_EXPENSE', payload: { expenseId: exp.id } })}
                                            className="flex-1 py-1 px-2 text-xs font-medium text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded transition-colors"
                                        >
                                            Mettre en suspens
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default SplitterGlobalBasket;
