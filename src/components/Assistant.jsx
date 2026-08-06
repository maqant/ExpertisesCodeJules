import React, { useContext, useState, useRef } from 'react';
import { ExpertiseContext } from '../context/ExpertiseContext';
import { processGlobalIngestion } from '../services/aiManager';
import { findMatchingDossier } from '../services/utils/bridgeMatcher.js';
import { useSidebarUI } from '../context/SidebarUIContext';
import { generateDocument } from '../services/generators/generatorEngine.js';
import { useIngestionFlowStore, STEPS as INGESTION_STEPS } from '../store/ingestionFlowStore';
import AnalysisDestinationModal from './modals/AnalysisDestinationModal';
import DossiersModal from './modals/DossiersModal';
import GeneratedDocModal from './GeneratedDocModal';

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
    const { startIngestion, setStep: setIngestionStep } = useIngestionFlowStore();

    const [files, setFiles] = useState([]);
    const [rawText, setRawText] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);
    const [showTextArea, setShowTextArea] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Contrôle des modales d'intention & sélection
    const [showDestinationModal, setShowDestinationModal] = useState(false);
    const [showClassifySelectionModal, setShowClassifySelectionModal] = useState(false);
    const [pendingAnalysisResult, setPendingAnalysisResult] = useState(null);

    // Résultat GeneratedDoc (mail de décompte)
    const [generatedDecompteText, setGeneratedDecompteText] = useState(null);
    const [isDecompteModalOpen, setIsDecompteModalOpen] = useState(false);

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
        const formData = resultData.formData || resultData;
        const occupants = (resultData.occupants || []).map(o => ({ ...o, id: o.id || crypto.randomUUID() }));
        const expenses = (resultData.expenses || []).map(e => ({ ...e, id: e.id || crypto.randomUUID(), compteDe: e.compteDe || 'unassigned' }));
        const experts = resultData.experts || [];
        const intervenants = resultData.intervenants || [];
        
        const activeBrioOverrides = useIngestionFlowStore.getState().brioOverrides || {};

        // Fichiers à attacher : PJ extraites des MSG + fichiers originaux non-MSG (PDF, images, etc.)
        const allPendingFiles = [
            ...(extractedFiles || []),
            ...files.filter(f => !f.name.toLowerCase().endsWith('.msg'))
        ];

        setPendingAiData({
            formData: { ...(typeof formData === 'object' ? formData : {}), ...activeBrioOverrides },
            occupants,
            expenses,
            experts,
            intervenants,
            pendingFiles: allPendingFiles,
            _rawInputText: resultData._rawInputText || null
        });
    };

    // Déclenchement au clic sur "🔮 Analyser avec l'IA"
    const handleStartClick = () => {
        if (files.length === 0 && !rawText.trim()) return;
        setShowDestinationModal(true);
    };

    // Pipeline générique d'analyse IA et injection dans le dossier courant
    const runAnalysisPipeline = async (filesToProcess) => {
        setIsAnalyzing(true);
        setAiStatus('processing');

        try {
            const result = await processGlobalIngestion({
                files: filesToProcess,
                providedApiKey: aiConfig?.apiKey,
                onStatusChange: setAiStatus,
                agentsModel: aiConfig?.model,
                addDebugLog
            });

            if (result && result.success && result.data) {
                if (result.contexts) setRawContexts(result.contexts);
                injectAnalysisResult(result.data, result.extractedFiles);
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

    // Exécution de l'analyse selon le choix retenu
    const handleChoiceSelected = async (intent) => {
        setShowDestinationModal(false);

        // Option 3: Nouveau dossier -> Réinitialiser le formulaire & déclencher Brio
        if (intent === 'NEW') {
            if (typeof onResetForm === 'function') {
                onResetForm();
            }
            if (files.length > 0) {
                startIngestion(files, aiConfig);
            }
            setIngestionStep(INGESTION_STEPS.BRIO);
            await runAnalysisPipeline(files);
            return;
        }

        // Option 1: Ajouter à ce dossier
        if (intent === 'ADD_CURRENT') {
            await runAnalysisPipeline(files);
            return;
        }

        // Option 2: Classer dans un autre dossier -> Choisir/Détecter le dossier AVANT l'analyse !
        if (intent === 'CLASSIFY') {
            let matchedDossier = null;
            for (const f of files) {
                matchedDossier = findMatchingDossier(f.name, savedDossiers);
                if (matchedDossier) break;
            }
            if (!matchedDossier && rawText.trim()) {
                matchedDossier = findMatchingDossier(rawText.slice(0, 500), savedDossiers);
            }

            if (matchedDossier) {
                // Dossier correspondant trouvé par référence -> Charger d'abord, puis analyser
                loadDossier(matchedDossier);
                await runAnalysisPipeline(files);
            } else {
                // Aucun dossier correspondant -> Ouvrir la liste des dossiers pour sélection AVANT analyse
                setShowClassifySelectionModal(true);
            }
            return;
        }

        // Option 4: Mail de décompte
        if (intent === 'DECOMPTE') {
            setIsAnalyzing(true);
            setAiStatus('processing');
            try {
                const result = await processGlobalIngestion({
                    files,
                    providedApiKey: aiConfig?.apiKey,
                    onStatusChange: setAiStatus,
                    agentsModel: aiConfig?.model,
                    addDebugLog
                });

                if (result && result.success && result.data) {
                    if (result.contexts) setRawContexts(result.contexts);
                    const expenses = (result.data?.expenses || []).map(e => ({
                        ...e,
                        id: e.id || crypto.randomUUID(),
                        compteDe: e.compteDe || 'unassigned'
                    }));
                    const text = await generateDocument('declaration', {
                        formData: result.data?.formData || {},
                        rawContexts: result.contexts || {},
                        references: [],
                        occupants: [],
                        expenses,
                    });
                    setGeneratedDecompteText(text);
                    setIsDecompteModalOpen(true);
                } else {
                    alert("L'analyse IA n'a pas pu extraire de données valides.");
                }
            } catch (err) {
                console.error('[Assistant] Erreur décompte:', err);
                alert('Erreur lors de la génération du décompte : ' + err.message);
            } finally {
                setIsAnalyzing(false);
                setAiStatus('idle');
                if (typeof commitLogSession === 'function') commitLogSession();
            }
            return;
        }
    };

    // Callback si sélection manuelle d'un dossier après Classer (sans match préalable)
    const handleManualDossierSelected = async (dossier) => {
        setShowClassifySelectionModal(false);
        if (dossier) {
            loadDossier(dossier);
            await runAnalysisPipeline(files);
        }
    };

    const hasFiles = files.length > 0;
    const canAnalyze = (hasFiles || rawText.trim()) && !isAnalyzing;

    return (
        <div className="bg-slate-900 rounded-xl border border-pechard-blue/40 p-2.5 space-y-2 shadow-lg relative print:hidden">
            {/* Titre du composant */}
            <div className="flex items-center justify-between border-b border-pechard-blue/20 pb-1.5">
                <div className="flex items-center gap-2">
                    <span className="text-xs">✨</span>
                    <span className="text-xs font-extrabold text-white tracking-wide">Assistant</span>
                </div>
                {hasFiles && (
                    <span className="text-[9px] font-bold bg-pechard-blue/20 text-pechard-blue-light px-2 py-0.5 rounded-full border border-pechard-blue/40">
                        {files.length} fichier{files.length > 1 ? 's' : ''}
                    </span>
                )}
            </div>

            {/* Zone de Drag & Drop compacte (-25% hauteur) */}
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`min-h-[90px] rounded-lg border-2 border-dashed cursor-pointer transition-all duration-200 p-2.5 flex flex-col items-center justify-center text-center ${
                    isDragOver
                        ? 'border-pechard-blue bg-pechard-blue/20 scale-[1.01]'
                        : 'border-pechard-blue/40 hover:border-pechard-blue bg-slate-950/60 hover:bg-slate-950/80'
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
                <div className="text-xl mb-1 pointer-events-none">
                    {isDragOver ? '📥' : '📁'}
                </div>
                <p className="text-xs font-bold text-slate-200 pointer-events-none">
                    {isDragOver ? 'Relâchez vos fichiers ici' : 'Glisser-déposer vos documents ou cliquer'}
                </p>
                <p className="text-[9px] text-slate-400 mt-0.5 pointer-events-none">
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
            <div className="pt-0.5">
                <button
                    onClick={() => setShowTextArea(!showTextArea)}
                    className="text-[10px] font-bold text-pechard-blue-light hover:text-white flex items-center gap-1.5 transition-colors focus:outline-none"
                >
                    <span>{showTextArea ? '▼' : '▶'}</span>
                    <span>📝 Coller du texte brut (optionnel)</span>
                </button>

                {showTextArea && (
                    <textarea
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                        placeholder="Collez ici le corps d'un mail ou du texte brut d'expertise..."
                        className="mt-1.5 w-full h-20 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-500 focus:border-pechard-blue outline-none resize-none font-mono"
                    />
                )}
            </div>

            {/* Bouton Analyser principal */}
            <button
                onClick={handleStartClick}
                disabled={!canAnalyze}
                className="w-full bg-pechard-blue hover:bg-pechard-blue-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-extrabold py-2 px-3 rounded-xl shadow-pechard transition-all flex items-center justify-center gap-2"
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


            {/* Bouton Gestionnaire Financier Rapide — remplacé par le choix dans la modale d'analyse */}
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

            {/* Résultat du mail de décompte généré (option DECOMPTE) */}
            <GeneratedDocModal
                isOpen={isDecompteModalOpen}
                generatedText={generatedDecompteText}
                onClose={() => { setIsDecompteModalOpen(false); setGeneratedDecompteText(null); }}
            />
        </div>
    );
};

export default Assistant;
