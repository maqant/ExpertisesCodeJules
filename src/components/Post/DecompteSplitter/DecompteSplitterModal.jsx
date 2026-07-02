import React, { useMemo } from 'react';
import { useFinanceStore } from '../../../store/financeStore.js';
import { DecompteSplitterProvider, useDecompteSplitter } from './DecompteSplitterProvider.jsx';
import SplitterGlobalBasket from './SplitterGlobalBasket.jsx';
import SplitterRecipientBlock from './SplitterRecipientBlock.jsx';
import { validateDraft } from '../../../domain/decompteSplitter/allocationModel.js';
import { buildTsvExport } from '../../../services/export/tsvBuilder.js';
import { X, Plus, Copy, AlertTriangle, Check, Ban, Loader2, UploadCloud } from 'lucide-react';
import DropZone from '../../DropZone.jsx';
import { extractDecomptePostes, mapPostesToExpenses } from '../../../services/decompteExtractionService.js';

const SplitterInner = ({ onClose }) => {
    const { pii } = useFinanceStore();
    const { state, dispatch } = useDecompteSplitter();

    const expenses = state.extractedExpenses || [];
    const validation = validateDraft(expenses, state);

    const handleCopyTSV = () => {
        const currentDate = new Date().toLocaleDateString('fr-FR');
        const tsvContent = buildTsvExport(state, expenses, currentDate);
        navigator.clipboard.writeText(tsvContent);
        // Toast possible ici
    };


    const handleDrop = async (files) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        
        dispatch({ type: 'INGESTION_START' });
        try {
            const postes = await extractDecomptePostes(file);
            const mappedExpenses = mapPostesToExpenses(postes);
            dispatch({ type: 'INGESTION_SUCCESS', payload: mappedExpenses });
        } catch (err) {
            dispatch({ type: 'INGESTION_ERROR', payload: err.message });
        }
    };

    const renderBody = () => {
        if (state.ingestionStatus === 'idle') {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50">
                    <div className="max-w-xl w-full text-center">
                        <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-100 text-indigo-600 shadow-inner">
                            <UploadCloud className="w-10 h-10" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-3">Importer le décompte de la compagnie</h2>
                        <p className="text-slate-500 mb-8 leading-relaxed">Glissez la lettre de décompte de la compagnie (PDF) ici pour extraire les postes à ventiler.</p>
                        
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <DropZone 
                                onFiles={handleDrop} 
                                accept=".pdf,image/*" 
                                label="Glissez la lettre de décompte de la compagnie (PDF) ici pour extraire les postes à ventiler." 
                            />
                        </div>
                    </div>
                </div>
            );
        }

        if (state.ingestionStatus === 'parsing' || state.ingestionStatus === 'uploading') {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-6" />
                    <h2 className="text-xl font-semibold text-slate-800">Analyse par l'IA en cours...</h2>
                    <p className="text-slate-500 mt-2 text-sm text-center max-w-md">Lecture du document et extraction structurée des postes financiers. Cette opération peut prendre quelques secondes.</p>
                </div>
            );
        }

        if (state.ingestionStatus === 'error') {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50">
                    <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 text-red-600">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-semibold text-red-700 mb-3">Échec de l'extraction</h2>
                    <p className="text-slate-600 mb-8 text-center max-w-md bg-white p-4 rounded-lg border border-red-100 shadow-sm">{state.ingestionError}</p>
                    <button 
                        onClick={() => dispatch({ type: 'RESET_INGESTION' })}
                        className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl shadow font-medium transition-colors"
                    >
                        Réessayer avec un autre fichier
                    </button>
                </div>
            );
        }

        return (
            <div className="flex flex-1 overflow-hidden">
                {/* Colonne de gauche (1/3) */}
                <div className="w-1/3 min-w-[320px] max-w-sm border-r border-slate-200 bg-slate-50 flex flex-col">
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
        );
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4 md:p-8">
            <div className="bg-white w-full max-w-7xl h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">
                
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-800 text-white">
                    <div>
                        <h1 className="text-xl font-bold">Gestionnaire de Décomptes</h1>
                        <p className="text-xs text-slate-300 mt-0.5">Ventilation multi-destinataires assistée par l'IA</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {!validation.isValid && state.ingestionStatus === 'ready' && (
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

                {/* Body dynamique (DropZone ou Splitter) */}
                {renderBody()}
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
