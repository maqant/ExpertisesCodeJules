import React, { useContext, useState, useRef } from 'react';
import { ExpertiseContext } from '../context/ExpertiseContext';
import { processGlobalIngestion } from '../services/aiManager';
import { findMatchingDossier } from '../services/utils/bridgeMatcher.js';
import { useSidebarUI } from '../context/SidebarUIContext';
import AnalysisDestinationModal from './modals/AnalysisDestinationModal';
import DossiersModal from './modals/DossiersModal';

const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.msg', '.txt', '.edi'];

const isAcceptedFile = (file) => {
    const name = (file.name || '').toLowerCase();
    return ACCEPTED_EXTENSIONS.some(ext => name.endsWith(ext));
};

const getFileEmoji = (file) => {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.msg')) return '📧';
    if (name.endsWith('.pdf')) return '📄';
    if (file.type?.startsWith('image/')) return '🖼️';
    return '📎';
};

const formatSize = (bytes) => {
    if (!bytes) return '0 Ko';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
};

const Assistant = ({ onResetForm }) => {
    const context = useContext(ExpertiseContext);
    const {
        aiConfig, savedDossiers, loadDossier,
        setPendingAiData, setAiStatus, setRawContexts,
        addDebugLog, commitLogSession
    } = context;

    const { setIsQuickDecompteOpen } = useSidebarUI();

    const [files, setFiles] = useState([]);
    const [rawText, setRawText] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);
    const [showTextArea, setShowTextArea] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Contrôle des modales d'intention & sélection
    const [showDestinationModal, setShowDestinationModal] = useState(false);
    const [showClassifySelectionModal, setShowClassifySelectionModal] = useState(false);
    const [pendingAnalysisResult, setPendingAnalysisResult] = useState(null);

    const fileInputRef = useRef(null);

    const handleAddFiles = (newFiles) => {
        const valid = [];
        for (const f of newFiles) {
            if (isAcceptedFile(f) && !files.some(ex => ex.name === f.name && ex.size === f.size)) {
                valid.push(f);
            }
        }
        if (valid.length > 0) {
            setFiles(prev => [...prev, ...valid]);
        }
    };

    const handleRemoveFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsDragOver(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleAddFiles(Array.from(e.dataTransfer.files));
        }
    };

    // Injecter les données analysées par l'IA dans l'état courant
    const injectAnalysisResult = (resultData, extractedFiles = []) => {
        if (!resultData) return;
        const occupants = (resultData.occupants || []).map(o => ({ ...o, id: o.id || crypto.randomUUID() }));
        const expenses = (resultData.expenses || []).map(e => ({ ...e, id: e.id || crypto.randomUUID(), compteDe: e.compteDe || 'unassigned' }));
        
        setPendingAiData({
            ...resultData,
            occupants,
            expenses,
            files: extractedFiles
        });
    };

    // Déclenchement au clic sur "🔮 Analyser avec l'IA"
    const handleStartClick = () => {
        if (files.length === 0 && !rawText.trim()) return;
        setShowDestinationModal(true);
    };

    // Exécution de l'analyse selon le choix retenu
    const handleChoiceSelected = async (intent) => {
        setShowDestinationModal(false);
        setIsAnalyzing(true);
        setAiStatus('processing');

        try {
            // Option 3: Nouveau dossier -> Réinitialiser le formulaire d'abord !
            if (intent === 'NEW' && typeof onResetForm === 'function') {
                onResetForm();
            }

            // Exécution du pipeline IA unifié
            const result = await processGlobalIngestion({
                files,
                providedApiKey: aiConfig?.apiKey,
                onStatusChange: setAiStatus,
                agentsModel: aiConfig?.model,
                addDebugLog
            });

            if (result && result.success && result.data) {
                if (result.contexts) setRawContexts(result.contexts);

                if (intent === 'ADD_CURRENT' || intent === 'NEW') {
                    // Option 1 & 3: Injecter directement (fonctionne aussi en mode "Nouveau non sauvegardé" sans erreur)
                    injectAnalysisResult(result.data, result.extractedFiles);
                } else if (intent === 'CLASSIFY') {
                    // Option 2: Recherche par référence
                    let matchedDossier = null;
                    for (const f of files) {
                        matchedDossier = findMatchingDossier(f.name, savedDossiers);
                        if (matchedDossier) break;
                    }
                    if (!matchedDossier && rawText.trim()) {
                        matchedDossier = findMatchingDossier(rawText.slice(0, 500), savedDossiers);
                    }

                    if (matchedDossier) {
                        // Dossier trouvé -> Charger le dossier puis injecter
                        loadDossier(matchedDossier);
                        injectAnalysisResult(result.data, result.extractedFiles);
                    } else {
                        // Aucun dossier correspondant -> Ouvrir la modale de sélection de destination
                        setPendingAnalysisResult({
                            data: result.data,
                            extractedFiles: result.extractedFiles
                        });
                        setShowClassifySelectionModal(true);
                    }
                }

                // Réinitialiser les fichiers/texte droppés
                setFiles([]);
                setRawText('');
            } else {
                alert("L'analyse IA n'a pas pu extraire de données valides.");
            }
        } catch (err) {
            console.error('[Assistant] Erreur d\'analyse:', err);
            alert('Erreur lors de l\'analyse : ' + err.message);
        } finally {
            setIsAnalyzing(false);
            setAiStatus('idle');
            if (typeof commitLogSession === 'function') commitLogSession();
        }
    };

    // Callback si sélection manuelle d'un dossier après Classer (sans match)
    const handleManualDossierSelected = (dossier) => {
        setShowClassifySelectionModal(false);
        if (dossier) {
            loadDossier(dossier);
            if (pendingAnalysisResult) {
                injectAnalysisResult(pendingAnalysisResult.data, pendingAnalysisResult.extractedFiles);
            }
        }
        setPendingAnalysisResult(null);
    };

    const hasFiles = files.length > 0;
    const canAnalyze = (hasFiles || rawText.trim()) && !isAnalyzing;

    return (
        <div className="bg-slate-900/90 rounded-xl border border-indigo-500/30 p-3 space-y-2.5 shadow-lg relative print:hidden">
            {/* Titre du composant */}
            <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm">✨</span>
                    <span className="text-xs font-extrabold text-white tracking-wide">Assistant</span>
                </div>
                {hasFiles && (
                    <span className="text-[9px] font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                        {files.length} fichier{files.length > 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {/* Zone de Drag & Drop avec pointillés (Hauteur optimale) */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`min-h-[125px] rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 p-4 flex flex-col items-center justify-center text-center ${
                    isDragOver
                        ? 'border-indigo-400 bg-indigo-500/20 scale-[1.01]'
                        : 'border-indigo-500/40 hover:border-indigo-400 bg-slate-950/60 hover:bg-slate-950/80'
                }`}
            >
                <input 
                    ref={fileInputRef} 
                    type="file" 
                    multiple 
                    accept=".pdf,.jpg,.jpeg,.png,.msg,.txt,.edi"
                    onChange={(e) => { handleAddFiles(Array.from(e.target.files)); e.target.value = null; }}
                    className="hidden"
                />
                <div className="text-2xl mb-1.5 pointer-events-none">
                    {isDragOver ? '📥' : '📁'}
                </div>
                <p className="text-xs font-bold text-slate-200 pointer-events-none">
                    {isDragOver ? 'Relâchez vos fichiers ici' : 'Glisser-déposer vos documents ou cliquer'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 pointer-events-none">
                    PDF · Images · Emails (.msg, .eml)
                </p>
            </div>

            {/* Liste des fichiers en attente d'analyse (Chips) */}
            {hasFiles && (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {files.map((file, idx) => (
                        <div 
                            key={idx} 
                            className="flex items-center justify-between bg-slate-800/90 border border-slate-700 px-2.5 py-1.5 rounded-lg text-[10px]"
                        >
                            <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                <span>{getFileEmoji(file)}</span>
                                <span className="font-medium text-slate-200 truncate">{file.name}</span>
                                <span className="text-slate-500 text-[9px]">({formatSize(file.size)})</span>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveFile(idx); }}
                                className="text-slate-400 hover:text-red-400 transition-colors p-0.5"
                                title="Enlever"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Zone Texte Brut Dépliable */}
            <div className="pt-1">
                <button
                    onClick={() => setShowTextArea(!showTextArea)}
                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 transition-colors focus:outline-none"
                >
                    <span>{showTextArea ? '▼' : '▶'}</span>
                    <span>📝 Coller du texte brut (optionnel)</span>
                </button>

                {showTextArea && (
                    <textarea
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        placeholder="Collez ici le corps d'un mail ou du texte brut d'expertise..."
                        className="mt-2 w-full h-24 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 outline-none resize-none font-mono"
                    />
                )}
            </div>

            {/* Bouton Analyser principal */}
            <button
                onClick={handleStartClick}
                disabled={!canAnalyze}
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-extrabold py-2.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
                {isAnalyzing ? (
                    <>
                        <span className="animate-spin text-sm">🌀</span>
                        <span>Analyse par l'IA en cours...</span>
                    </>
                ) : (
                    <>
                        <span>🔮</span>
                        <span>Analyser avec l'IA</span>
                    </>
                )}
            </button>

            {/* Bouton Gestionnaire Financier Rapide */}
            <button
                onClick={() => setIsQuickDecompteOpen(true)}
                className="w-full bg-slate-800 hover:bg-emerald-900/40 border border-slate-700 hover:border-emerald-500/60 text-slate-300 hover:text-emerald-300 text-xs font-bold py-2 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
            >
                <span>📊</span>
                <span>Gestionnaire Financier Rapide</span>
            </button>

            {/* Modale des 3 choix d'intention */}
            <AnalysisDestinationModal
                isOpen={showDestinationModal}
                onClose={() => setShowDestinationModal(false)}
                onChoice={handleChoiceSelected}
            />

            {/* Modale de sélection manuelle d'un dossier si CLASSIFY sans match */}
            <DossiersModal
                isOpenOverride={showClassifySelectionModal}
                onCloseOverride={() => handleManualDossierSelected(null)}
                onSelectOverride={handleManualDossierSelected}
                customTitle="Choisir le dossier de destination"
            />
        </div>
    );
};

export default Assistant;
