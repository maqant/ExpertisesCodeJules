import React, { useState, useMemo } from 'react';
import { useDecompteSplitter } from './DecompteSplitterProvider.jsx';
import { cleanAmount, useFinanceStore } from '../../../store/financeStore.js';
import { getResteAVentiler, ALLOCATION_STATUS } from '../../../domain/decompteSplitter/allocationModel.js';
import { computeDossierSuggestions } from '../../../domain/decompteSplitter/dossierExpenseMatcher.js';
import { CheckCircle2, AlertCircle, Ban, ArrowRightCircle, RotateCcw, Plus, Percent, Sparkles, X, Link2 } from 'lucide-react';
import { computeProrataWeights } from '../../../domain/decompteSplitter/prorataDistribution.js';
import ProrataBasePopover from './ProrataBasePopover.jsx';

const SplitterGlobalBasket = ({ expenses }) => {
    const { state, dispatch } = useDecompteSplitter();
    const { allocations, dismissedSuggestionIds } = state;
    const [activePopoverExpId, setActivePopoverExpId] = useState(null);

    // Frais officiels du dossier d'expertise (source des vrais noms)
    const dossierExpenses = useFinanceStore(s => s.metier?.expenses || []);

    // Scan & Suggest : dérivation PURE sans mutation d'office
    const suggestions = useMemo(() => {
        return computeDossierSuggestions(expenses, dossierExpenses, { dismissedIds: dismissedSuggestionIds });
    }, [expenses, dossierExpenses, dismissedSuggestionIds]);

    return (
        <div className="flex flex-col h-full bg-slate-50 border-r border-slate-200">
            <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-semibold text-slate-800">Panier Global</h2>
                    <p className="text-xs text-slate-500 mt-1">Postes extraits du décompte</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => {
                            const newExp = {
                                id: crypto.randomUUID(),
                                desc: 'Nouveau poste',
                                montantReclame: "0,00",
                                montantValide: "0,00",
                                typeMontant: 'HTVA',
                                origine: 'manuel'
                            };
                            dispatch({ type: 'ADD_MANUAL_EXPENSE', payload: newExp });
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        title="Ajouter une ligne de frais manuellement"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => dispatch({ type: 'RESET_INGESTION' })}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Vider et recommencer"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {expenses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                            <AlertCircle className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-600">Aucun poste financier n'a pu être extrait de ce document.</p>
                        <p className="text-xs text-slate-500 mt-2">Vérifiez le PDF ou recommencez.</p>
                    </div>
                ) : (
                    expenses.map(exp => {
                        const cible = cleanAmount(exp.montantValide || exp.montantReclame);
                        const reste = getResteAVentiler(exp, allocations);
                        const isSuspended = allocations.some(a => a.expenseId === exp.id && a.status === ALLOCATION_STATUS.SUSPENDED);
                        const suggestion = suggestions[exp.id];
                        
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
                            <div key={exp.id} className={`relative p-3 rounded-lg border shadow-sm transition-colors ${statusConfig.bg} ${statusConfig.border}`}>
                                <div className="flex justify-between items-start mb-1 gap-2">
                                    {exp.origine === 'manuel' ? (
                                        <>
                                            <input 
                                                className="text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:border-indigo-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5 w-3/5 outline-none transition-colors"
                                                value={exp.desc}
                                                onChange={(e) => dispatch({ type: 'UPDATE_MANUAL_EXPENSE', payload: { id: exp.id, changes: { desc: e.target.value } } })}
                                                placeholder="Nom du poste"
                                            />
                                            <div className="flex items-center gap-1">
                                                <input
                                                    className="text-sm font-bold text-slate-800 bg-white border border-slate-300 hover:border-indigo-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded px-1.5 py-0.5 w-20 text-right outline-none transition-colors"
                                                    value={exp.montantReclame}
                                                    onChange={(e) => dispatch({ type: 'UPDATE_MANUAL_EXPENSE', payload: { id: exp.id, changes: { montantReclame: e.target.value, montantValide: e.target.value } } })}
                                                    placeholder="0,00"
                                                />
                                                <span className="text-sm font-bold text-slate-800">€</span>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex flex-col truncate pr-2">
                                                <span className="text-sm font-medium text-slate-700 truncate" title={exp.desc || exp.type}>
                                                    {exp.desc || exp.type || 'Poste inconnu'}
                                                </span>
                                                {exp.linkedDossierExpenseId && (
                                                    <div className="flex items-center gap-1 text-[10px] text-indigo-600 mt-0.5">
                                                        <Link2 className="w-3 h-3 text-indigo-500" />
                                                        <span className="truncate" title={`Brut décompte: ${exp.descOriginale || ''}`}>Nom issu du dossier</span>
                                                        <button
                                                            onClick={() => dispatch({ type: 'REVERT_MATCH_SUGGESTION', payload: { expenseId: exp.id } })}
                                                            className="text-slate-400 hover:text-slate-700 underline ml-1"
                                                            title="Rétablir le libellé brut du décompte"
                                                        >
                                                            Rétablir
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-sm font-bold text-slate-800 whitespace-nowrap">
                                                {cible.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* SUGGESTION DE RÉCONCILIATION DISCRÈTE (Scan & Suggest) */}
                                {suggestion && !exp.linkedDossierExpenseId && (
                                    <div className="mt-2 bg-indigo-50/90 border border-indigo-200 rounded p-1.5 flex items-center justify-between gap-2">
                                        <button
                                            onClick={() => dispatch({ type: 'APPLY_MATCH_SUGGESTION', payload: { expenseId: exp.id, suggestion } })}
                                            className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-700 hover:text-indigo-900 truncate text-left"
                                            title={`Correspondance : ${suggestion.reason}. Cliquer pour renommer.`}
                                        >
                                            <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                            <span className="truncate">Suggérer : <strong>{suggestion.suggestedLabel}</strong></span>
                                        </button>
                                        <button
                                            onClick={() => dispatch({ type: 'DISMISS_MATCH_SUGGESTION', payload: { expenseId: exp.id } })}
                                            className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-indigo-100 transition-colors"
                                            title="Ignorer cette suggestion"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                                
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
                                        <>
                                            <button 
                                                onClick={() => dispatch({ type: 'SUSPEND_EXPENSE', payload: { expenseId: exp.id } })}
                                                className="flex-1 py-1 px-2 text-xs font-medium text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded transition-colors"
                                            >
                                                En suspens
                                            </button>
                                            {Math.abs(reste) > 0.001 && computeProrataWeights(exp.id, allocations).length > 0 && (
                                                <button
                                                    onClick={() => setActivePopoverExpId(activePopoverExpId === exp.id ? null : exp.id)}
                                                    className="flex items-center justify-center py-1 px-2 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 hover:text-indigo-700 rounded transition-colors"
                                                    title="Ventiler au prorata des autres postes"
                                                >
                                                    <Percent className="w-3.5 h-3.5 mr-1" />
                                                    Prorata
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                                {activePopoverExpId === exp.id && (
                                    <ProrataBasePopover
                                        targetExpense={exp}
                                        expenses={expenses}
                                        allocations={allocations}
                                        onClose={() => setActivePopoverExpId(null)}
                                        onApply={(baseExpenseIds) => {
                                            try {
                                                dispatch({ 
                                                    type: 'DISTRIBUTE_PRORATA', 
                                                    payload: { expense: exp, baseExpenseIds } 
                                                });
                                                setActivePopoverExpId(null);
                                            } catch (err) {
                                                alert(err.message || 'Erreur lors de la distribution au prorata.');
                                            }
                                        }}
                                    />
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default SplitterGlobalBasket;
