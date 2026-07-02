import React, { useMemo } from 'react';
import { useFinanceStore } from '../../../store/financeStore.js';
import { DecompteSplitterProvider, useDecompteSplitter } from './DecompteSplitterProvider.jsx';
import SplitterGlobalBasket from './SplitterGlobalBasket.jsx';
import SplitterRecipientBlock from './SplitterRecipientBlock.jsx';
import { validateDraft } from '../../../domain/decompteSplitter/allocationModel.js';
import { buildTsvExport } from '../../../services/export/tsvBuilder.js';
import { X, Plus, Copy, AlertTriangle, Check, Ban } from 'lucide-react';

const SplitterInner = ({ onClose }) => {
    const { metier, pii } = useFinanceStore();
    const { state, dispatch } = useDecompteSplitter();

    const expenses = metier.expenses;
    const validation = validateDraft(expenses, state);

    const handleCopyTSV = () => {
        const currentDate = new Date().toLocaleDateString('fr-FR');
        const tsvContent = buildTsvExport(state, expenses, currentDate);
        navigator.clipboard.writeText(tsvContent);
        // Toast possible ici
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4 md:p-8">
            <div className="bg-white w-full max-w-7xl h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-800 text-white">
                    <div>
                        <h1 className="text-xl font-bold">Gestionnaire de Décomptes</h1>
                        <p className="text-xs text-slate-300 mt-0.5">Ventilation multi-destinataires</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {!validation.isValid && (
                            <div className="flex items-center gap-2 text-xs font-medium text-amber-300 bg-amber-900/50 px-3 py-1.5 rounded-full border border-amber-500/30">
                                <AlertTriangle className="w-4 h-4" />
                                {validation.errors.length} erreur(s) bloquante(s)
                            </div>
                        )}
                        <button 
                            onClick={onClose}
                            className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body (2 columns) */}
                <div className="flex flex-1 overflow-hidden">
                    {/* Colonne de gauche (1/3) */}
                    <div className="w-1/3 min-w-[320px] max-w-sm border-r border-slate-200 bg-slate-50">
                        <SplitterGlobalBasket expenses={expenses} />
                    </div>

                    {/* Colonne de droite (2/3) */}
                    <div className="flex-1 flex flex-col bg-slate-100 overflow-hidden">
                        <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
                            <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Destinataires & Paiements</h2>
                            
                            <div className="flex items-center gap-3">
                                <button 
                                    onClick={() => dispatch({ type: 'ADD_BLOCK' })}
                                    className="flex items-center gap-1.5 text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded shadow-sm transition-colors"
                                >
                                    <Plus className="w-4 h-4 text-indigo-600" />
                                    Ajouter un paiement
                                </button>
                                
                                <button 
                                    onClick={handleCopyTSV}
                                    disabled={!validation.isValid}
                                    className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded shadow-sm transition-colors ${
                                        validation.isValid 
                                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    }`}
                                    title={!validation.isValid ? "Corrigez les erreurs pour exporter" : "Copier format TSV"}
                                >
                                    {validation.isValid ? <Copy className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                    Copier pour Excel
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                            {state.blocks.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
                                    <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center mb-2">
                                        <Plus className="w-8 h-8 text-slate-400" />
                                    </div>
                                    <p className="text-sm font-medium">Aucun paiement configuré.</p>
                                    <button 
                                        onClick={() => dispatch({ type: 'ADD_BLOCK' })}
                                        className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                                    >
                                        Créer le premier paiement
                                    </button>
                                </div>
                            ) : (
                                state.blocks.map(block => (
                                    <SplitterRecipientBlock 
                                        key={block.id} 
                                        block={block} 
                                        expenses={expenses}
                                        occupants={pii.occupants}
                                        intervenants={pii.prestataires} // En supposant que intervenants = prestataires/experts selon la structure existante
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const DecompteSplitterModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;
    
    return (
        <DecompteSplitterProvider>
            <SplitterInner onClose={onClose} />
        </DecompteSplitterProvider>
    );
};

export default DecompteSplitterModal;
