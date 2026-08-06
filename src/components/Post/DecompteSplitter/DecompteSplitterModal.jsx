import React, { useMemo, useEffect, useState, useRef } from 'react';
import { useFinanceStore } from '../../../store/financeStore.js';
import { DecompteSplitterProvider, useDecompteSplitter } from './DecompteSplitterProvider.jsx';
import SplitterGlobalBasket from './SplitterGlobalBasket.jsx';
import SplitterRecipientBlock from './SplitterRecipientBlock.jsx';
import { validateDraft } from '../../../domain/decompteSplitter/allocationModel.js';
import { buildTsvExport, buildINGTsvExport } from '../../../services/export/tsvBuilder.js';
import { buildAllCandidates } from '../../../services/utils/contactUtils.js';
import { X, Plus, Copy, AlertTriangle, Check, Ban, Loader2, UploadCloud, ClipboardPaste, Save, FilePlus } from 'lucide-react';
import DropZone from '../../DropZone.jsx';
import { ingestDocument } from './ingestionOrchestrator.js';
import { integrateToDossier } from '../../../services/decompteIntegrationService.js';

import { useSidebarUI } from '../../../context/SidebarUIContext.jsx';

const SplitterInner = ({ onClose, dossierName, initialFiles = [] }) => {
    const { pii } = useFinanceStore();
    const { state, dispatch } = useDecompteSplitter();

    const expenses = state.extractedExpenses || [];
    const validation = validateDraft(expenses, state);

    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const dragCounter = useRef(0);

    const handleCopyTSV = () => {
        const currentDate = new Date().toLocaleDateString('fr-FR');
        const tsvContent = buildTsvExport(state, expenses, currentDate);
        navigator.clipboard.writeText(tsvContent);
    };

    const handleCopyING = () => {
        const allCandidates = buildAllCandidates({
            occupants: pii?.occupants || [],
            intervenants: pii?.prestataires || [],
            localContacts: state.localContacts || []
        });
        const tsvContent = buildINGTsvExport(state, expenses, dossierName, null, allCandidates);
        navigator.clipboard.writeText(tsvContent);
    };

    const [isSaved, setIsSaved] = useState(false);

    const handleDrop = async (files, opts = {}) => {
        if (!files || files.length === 0) return;
        const fileArray = Array.from(files);
        for (let i = 0; i < fileArray.length; i++) {
            const file = fileArray[i];
            const isAppend = opts.isAppend ?? (i > 0 || state.ingestionStatus === 'ready');
            await ingestDocument(file, dispatch, { isAppend });
        }
    };

    const handleSendToDossier = () => {
        if (!validation.isValid) return;
        
        try {
            const result = integrateToDossier(state);
            alert(`Succès ! \n${result.addedExpensesCount} frais créés.\n${result.paymentAdded ? `Paiement global de ${result.totalEuroStr} € enregistré.` : ''}`);
            setIsSaved(true);
            setTimeout(() => onClose(), 2000);
        } catch (err) {
            alert(`Erreur lors de l'intégration: ${err.message}`);
        }
    };

    // Drag and drop sur toute la modale (accumule les documents)
    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDraggingOver(true);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current -= 1;
        if (dragCounter.current === 0) {
            setIsDraggingOver(false);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleModalDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        dragCounter.current = 0;
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleDrop(e.dataTransfer.files, { isAppend: state.ingestionStatus === 'ready' });
        }
    };

    useEffect(() => {
        const handleGlobalPaste = (e) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                        e.preventDefault();
                        handleDrop([blob], { isAppend: state.ingestionStatus === 'ready' });
                        break;
                    }
                }
            }
        };

        window.addEventListener('paste', handleGlobalPaste);
        return () => window.removeEventListener('paste', handleGlobalPaste);
    }, [state.ingestionStatus]);

    // Auto-ingestion des fichiers transmis lors de l'ouverture (ex: option 4 Assistant)
    useEffect(() => {
        if (initialFiles && initialFiles.length > 0 && state.ingestionStatus === 'idle') {
            handleDrop(initialFiles, { isAppend: false });
        }
    }, [initialFiles, state.ingestionStatus]);

    const handlePasteButtonClick = async () => {
        try {
            const items = await navigator.clipboard.read();
            for (const item of items) {
                const imageTypes = item.types.filter(type => type.startsWith('image/'));
                if (imageTypes.length > 0) {
                    const blob = await item.getType(imageTypes[0]);
                    const file = new File([blob], 'screenshot.png', { type: imageTypes[0] });
                    handleDrop([file], { isAppend: state.ingestionStatus === 'ready' });
                    return;
                }
            }
            alert("Aucune image trouvée dans le presse-papier. Assurez-vous d'avoir fait une capture d'écran.");
        } catch (err) {
            console.error("Erreur d'accès au presse-papier:", err);
            alert("Impossible de lire le presse-papier. Utilisez Ctrl+V ou autorisez l'accès dans votre navigateur.");
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
                        <h2 className="text-2xl font-bold text-slate-800 mb-3">Importer un document financier</h2>
                        <p className="text-slate-500 mb-8 leading-relaxed">Glissez une lettre de décompte ou de paiement (PDF/image). L'IA détectera automatiquement le type de document.</p>
                        
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <DropZone 
                                onFiles={(files) => handleDrop(files, { isAppend: false })} 
                                accept=".pdf,image/*" 
                                label="Glissez la lettre de décompte de la compagnie (PDF) ici pour extraire les postes à ventiler." 
                            />
                            
                            <div className="mt-4 flex items-center justify-center">
                                <div className="h-px bg-slate-200 flex-1"></div>
                                <span className="px-3 text-xs text-slate-400 font-medium">OU</span>
                                <div className="h-px bg-slate-200 flex-1"></div>
                            </div>
                            
                            <div className="flex gap-3 mt-4">
                                <button 
                                    onClick={handlePasteButtonClick}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl transition-colors font-medium text-sm"
                                >
                                    <ClipboardPaste className="w-4 h-4 text-slate-500" />
                                    Coller (Ctrl+V)
                                </button>
                                
                                <button 
                                    onClick={() => dispatch({ type: 'MANUAL_ENTRY' })}
                                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl transition-colors font-medium text-sm shadow-sm"
                                >
                                    <Plus className="w-4 h-4 text-slate-500" />
                                    Saisie manuelle
                                </button>
                            </div>
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
                    <p className="text-slate-500 mt-2 text-sm text-center max-w-md">Lecture et classification du document financier. Cette opération peut prendre quelques secondes.</p>
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

        if (isSaved) {
            return (
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-emerald-50">
                    <div className="mb-6 inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100 text-emerald-600">
                        <Check className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Sauvegardé avec succès !</h2>
                    <p className="text-slate-500">Les données ont été injectées dans le dossier.</p>
                </div>
            );
        }

        // Mode Décompte (ventilation active avec possibilité d'ajouter un 2e document)
        const integrity = state.detectedMeta?.integrity;

        return (
            <div className="flex flex-1 overflow-hidden relative">
                {/* Overlay de chargement léger lors de l'ajout d'un 2e document */}
                {state.ingestionStatus === 'parsing_append' && (
                    <div className="absolute inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center">
                        <div className="bg-white p-6 rounded-2xl shadow-2xl flex items-center gap-4 border border-indigo-100 animate-bounce">
                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm">Analyse du 2e document par l'IA...</h3>
                                <p className="text-xs text-slate-500 mt-0.5">Ajout des postes et règlements au panier global.</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Bandeau d'intégrité financière (Auto-correction ou Avertissement) */}
                {integrity && integrity.warnings && integrity.warnings.length > 0 && (
                    <div className={`absolute top-2 left-1/2 -translate-x-1/2 z-40 max-w-2xl text-xs px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 border ${
                        integrity.status === 'AUTO_CORRECTED'
                            ? 'bg-indigo-900 text-white border-indigo-500'
                            : 'bg-amber-900 text-amber-100 border-amber-500'
                    }`}>
                        <Sparkles className="w-4 h-4 text-indigo-300 shrink-0" />
                        <span className="flex-1">{integrity.warnings.join(' ')}</span>
                    </div>
                )}

                {/* Toast d'erreur lors de l'ajout d'un 2e document */}
                {state.appendError && (
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 bg-red-600 text-white text-xs px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{state.appendError}</span>
                        <button onClick={() => dispatch({ type: 'CLEAR_APPEND_ERROR' })} className="ml-2 font-bold hover:text-red-200">✕</button>
                    </div>
                )}

                {/* Colonne de gauche (1/3) : Panier Global */}
                <div className="w-1/3 min-w-[320px] max-w-sm border-r border-slate-200 bg-slate-50 flex flex-col">
                    <SplitterGlobalBasket 
                        expenses={expenses} 
                        onAddDocument={(file) => handleDrop([file], { isAppend: true })}
                    />
                </div>

                {/* Colonne de droite (2/3) : Destinataires & Paiements */}
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
                            
                            {dossierName && (
                                <button 
                                    onClick={handleSendToDossier}
                                    disabled={!validation.isValid}
                                    className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded shadow-sm transition-colors ${
                                        validation.isValid 
                                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                            : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-transparent'
                                    }`}
                                    title={!validation.isValid ? "Corrigez les erreurs pour envoyer au dossier" : "Créer les lignes de frais et le versement dans le dossier"}
                                >
                                    {validation.isValid ? <Save className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                    Envoyer au dossier
                                </button>
                            )}
                            
                            <button 
                                onClick={handleCopyTSV}
                                disabled={!validation.isValid}
                                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded shadow-sm transition-colors ${
                                    validation.isValid 
                                        ? 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50' 
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-transparent'
                                }`}
                                title={!validation.isValid ? "Corrigez les erreurs pour exporter" : "Copier format standard avec en-têtes"}
                            >
                                {validation.isValid ? <Copy className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                Format Complet
                            </button>

                            <button 
                                onClick={handleCopyING}
                                disabled={!validation.isValid}
                                className={`flex items-center gap-1.5 text-xs font-semibold px-4 py-1.5 rounded shadow-sm transition-colors ${
                                    validation.isValid 
                                        ? 'bg-[#ff6200] hover:bg-[#e65800] text-white'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                                title={!validation.isValid ? "Corrigez les erreurs pour exporter" : "Format exact pour coller dans la macro SEPA d'ING"}
                            >
                                {validation.isValid ? <Copy className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                Copier pour macro ING
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
                                    intervenants={pii.prestataires}
                                    dossierName={dossierName}
                                />
                            ))
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div 
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center p-4 md:p-8"
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleModalDrop}
        >
            <div className="bg-white w-full max-w-7xl h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden relative">
                
                {/* Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-800 text-white">
                    <div>
                        <h1 className="text-xl font-bold">Gestionnaire financier</h1>
                        <p className="text-xs text-slate-300 mt-0.5">Ingestion de décomptes et de paiements assistée par l'IA</p>
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

                {/* Overlay visuel lors du glisser-déposer d'un 2e document */}
                {isDraggingOver && state.ingestionStatus === 'ready' && (
                    <div className="absolute inset-0 z-50 bg-indigo-900/85 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-white border-4 border-dashed border-indigo-400 m-2 rounded-xl pointer-events-none animate-pulse">
                        <UploadCloud className="w-16 h-16 mb-4 text-indigo-200" />
                        <h3 className="text-2xl font-bold">Déposer un 2e document (décompte / paiement)</h3>
                        <p className="text-sm text-indigo-200 mt-2 text-center max-w-md">
                            L'IA extraira les nouveaux postes et créera le versement correspondant sans supprimer vos ventilations actuelles.
                        </p>
                    </div>
                )}

                {/* Body dynamique (DropZone ou Splitter) */}
                {renderBody()}
            </div>
        </div>
    );
};

export const DecompteSplitterModal = ({ isOpen: isOpenOverride, onClose: onCloseOverride, dossierName, initialFiles: initialFilesOverride }) => {
    const sidebarUI = useSidebarUI();
    const isOpen = isOpenOverride !== undefined ? isOpenOverride : (sidebarUI?.isDecompteSplitterOpen || false);
    const onClose = onCloseOverride || (sidebarUI?.closeDecompteSplitter || (() => {}));
    const initialFiles = initialFilesOverride || sidebarUI?.decompteSplitterFiles || [];

    if (!isOpen) return null;
    
    return (
        <DecompteSplitterProvider>
            <SplitterInner onClose={onClose} dossierName={dossierName} initialFiles={initialFiles} />
        </DecompteSplitterProvider>
    );
};

export default DecompteSplitterModal;
