import React, { useContext, useState, useRef } from 'react';
import { ExpertiseContext } from '../context/ExpertiseContext';
import { extractDataFromDocument, extractValidAttachmentsFromMsg, extractAdministrativeData, extractNarrativeData, extractFinancialData, processGlobalIngestion, refineText, refineCauseWithInput } from '../services/aiManager';
import AnnexModal from './AnnexModal';
import GlobalAiAssistant from './GlobalAiAssistant'; // v5.9.4 - Relocation & Restore
import SmartBridgeDropzone from './SmartBridgeDropzone';
import SmartBridgeModal from './SmartBridgeModal'; // v5.9.4
import GeneratedDocModal from './GeneratedDocModal'; // v6.0.0
import { findMatchingDossier } from '../services/utils/bridgeMatcher.js'; // v5.9.4
import { generateDocument } from '../services/generators/generatorEngine.js'; // v6.0.0
import { Eye } from 'lucide-react';
import UniversalIngestionModal from './UniversalIngestionModal';
import packageInfo from '../../package.json';
import localforage from 'localforage';

const DropZone = ({ onFiles, label = "Glisser ici", accept = "*", className = "", onDragFinish }) => {
    const [isOver, setIsOver] = useState(false);
    return (
        <div 
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsOver(false); if (onDragFinish) onDragFinish(); }}
            onDrop={async (e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                setIsOver(false); 
                if (onDragFinish) onDragFinish(); 
                if (e.dataTransfer.files) {
                    const { cloneFilesEagerly } = await import('../services/utils/aiHelpers.js');
                    const safeFiles = await cloneFilesEagerly(e.dataTransfer.files);
                    onFiles(safeFiles);
                } 
            }}
            className={`relative z-[60] px-3 py-1.5 w-auto rounded border-2 border-dashed flex items-center justify-center transition-all cursor-pointer ${isOver ? 'border-indigo-400 bg-indigo-500 text-white scale-105' : 'border-indigo-500/50 hover:border-indigo-400 bg-indigo-900/80'} ${className}`}
            title="Glisser-déposer vos fichiers ici"
            onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.accept = accept;
                input.onchange = (e) => onFiles(Array.from(e.target.files));
                input.click();
            }}
        >
            <span className={`text-xs font-bold ${isOver ? 'text-white' : 'text-indigo-200'}`}>{label}</span>
        </div>
    );
};

const AttachmentUI = ({ docId, title = "Lier un fichier PDF", onDragFinish, onUpload = null }) => {
    const { attachedFiles, handleRemoveFile, handleAttachFile, handleOpenFile } = useContext(ExpertiseContext);
    let files = attachedFiles[docId] || [];
    if (!Array.isArray(files)) files = [files];

    const handleFiles = (files) => {
        if (onUpload) {
            onUpload(files);
        } else {
            files.forEach(f => handleAttachFile(docId, f));
        }
    };

    return (
        <div className="flex items-center gap-1 ml-auto shrink-0 flex-wrap justify-end">
            {files.map(file => {
                if (!file.name) return null;
                return (
                    <span key={file.dbKey} className="text-[9px] bg-indigo-900/50 text-indigo-300 px-1 py-0.5 rounded flex items-center gap-1 border border-indigo-500/30 font-normal" title={file.name}>
                        📎 {file.pages}p
                        <button onClick={(e) => { e.preventDefault(); handleOpenFile(file.dbKey, true); }} className="text-blue-400 hover:text-blue-300 ml-0.5 mr-0.5" title="Ouvrir le document">👁️</button>
                        <button onClick={(e) => { e.preventDefault(); handleRemoveFile(docId, file.dbKey); }} className="text-red-400 hover:text-red-300 ml-0.5">✕</button>
                    </span>
                );
            })}
            <DropZone onDragFinish={onDragFinish} onFiles={handleFiles} accept=".pdf" />
        </div>
    );
};

const AccordionHeader = ({ id, num }) => {
    const { blockTitles, handleTitleChange } = useContext(ExpertiseContext);
    const dragTimer = useRef(null);
    const wasAutoOpened = useRef(false);
    const [isEditing, setIsEditing] = useState(false);

    const handleDragEnterHeader = (e) => {
        e.preventDefault();
        const detailsEl = e.currentTarget.parentElement;
        if (detailsEl && !detailsEl.hasAttribute('open')) {
            dragTimer.current = setTimeout(() => {
                detailsEl.setAttribute('open', '');
                wasAutoOpened.current = true;

                // Add a temporary leave listener to the details element
                const onLeaveDetails = (leaveEvent) => {
                    if (!detailsEl.contains(leaveEvent.relatedTarget)) {
                        if (wasAutoOpened.current) {
                            detailsEl.removeAttribute('open');
                            wasAutoOpened.current = false;
                        }
                        detailsEl.removeEventListener('dragleave', onLeaveDetails);
                        detailsEl.removeEventListener('drop', onDropDetails);
                    }
                };

                const onDropDetails = () => {
                    // If dropped inside, keep it open
                    wasAutoOpened.current = false;
                    detailsEl.removeEventListener('dragleave', onLeaveDetails);
                    detailsEl.removeEventListener('drop', onDropDetails);
                };

                detailsEl.addEventListener('dragleave', onLeaveDetails);
                detailsEl.addEventListener('drop', onDropDetails);

            }, 600);
        }
    };

    const handleDragLeaveHeader = (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            if (dragTimer.current) {
                clearTimeout(dragTimer.current);
                dragTimer.current = null;
            }
        }
    };

    const handleDropHeader = () => {
        if (dragTimer.current) {
            clearTimeout(dragTimer.current);
            dragTimer.current = null;
        }
    };

    return (
        <summary
            className="p-2 flex items-center group-open:border-b border-slate-700 cursor-pointer select-none bg-slate-800/80 hover:bg-slate-700/80 rounded-t"
            onDragEnter={handleDragEnterHeader}
            onDragLeave={handleDragLeaveHeader}
            onDrop={handleDropHeader}
            onDragOver={(e) => e.preventDefault()}
        >
            <span className="text-xs font-bold text-indigo-400 shrink-0 mr-2 pointer-events-none">{num}.</span>
            {!isEditing ? (
                <span 
                    className="text-xs font-bold uppercase text-indigo-300 w-full hover:bg-slate-900/50 px-1 rounded transition-colors inline-block"
                    title="Double-cliquez pour renommer"
                    onDoubleClick={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation(); 
                        setIsEditing(true); 
                    }}
                >
                    {blockTitles[id]}
                </span>
            ) : (
                <input 
                    type="text" 
                    value={blockTitles[id]} 
                    onChange={(e) => handleTitleChange(id, e.target.value)} 
                    onClick={(e) => e.stopPropagation()} 
                    className="bg-transparent border-none outline-none text-xs font-bold uppercase text-indigo-300 w-full hover:bg-slate-900/50 px-1 rounded transition-colors" 
                    autoFocus
                    onDoubleClick={(e) => e.stopPropagation()}
                    onBlur={() => setIsEditing(false)}
                    onKeyDown={(e) => { 
                        if (e.key === 'Enter') setIsEditing(false); 
                    }}
                />
            )}
        </summary>
    );
};

const Sidebar = () => {
    const context = useContext(ExpertiseContext);
    if (!context) return null;

    const {
        ingestionModal, openIngestion, closeIngestion,
        activeTab, setActiveTab, sidebarWidth, isResizing, uiZoom, pastedJson, setPastedJson,
        orgaAdvancedMode, setOrgaAdvancedMode,
        showSubtotals, setShowSubtotals, currentDossierId, setCurrentDossierId,
        expandedOccId, setExpandedOccId, expandedExpId, setExpandedExpId,
        savedDossiers, setSavedDossiers, dossierSearch, setDossierSearch, expertsList, setExpertsList, franchises, setFranchises,
        showExpertDropdown, setShowExpertDropdown, showExpertDropdownContradictoire, setShowExpertDropdownContradictoire,
        showFranchiseDropdown, setShowFranchiseDropdown, prestatairesList, handleAddPrestataire, formData, setFormData, blockTitles, setBlockTitles,
        references, occupants, setOccupants, expenses, setExpenses, blocksVisible, setBlocksVisible, customBlocks, setCustomBlocks,
        blockOrder, setBlockOrder, blockWidths, setBlockWidths, styles, setStyles, startResizing, handleReset, handleChange, handleTitleChange, handleNewDossier,
        saveDossier, saveDossierAs, loadDossier, deleteDossier, generatePDF, addRef, updateRef, removeRef,
        addOcc, updateOcc, removeOcc, sortOccupantsByFloor, addExpense, updateExpense, removeExpense,
        reorganizeExpenses, handleJsonImport, handlePasteImport, copyPrompt, exportGlobalData,
        attachedFiles, attachedPhotos, attachedFreeAnnexes, dynamicFreeAnnexes, isMerging, handleAttachFile, handleRemoveFile, handleAttachPhoto, handleRemovePhoto,
        handleAttachFreeAnnex, handleRemoveFreeAnnex, handleUpdateFreeAnnex,
        getPaginationInfo, hideAnnexIndex, setHideAnnexIndex, coverPageCount, setCoverPageCount, downloadDossierPDF,
        isAiModeActive, aiConfig, toggleAiMode, updateAiConfig,
        processJsonData, setPendingAiData, causeTimeline, addCauseTimelineItem,
        toggleExpenseType,
        intervenantsList, setIntervenantsList,
        aiStatus, setAiStatus,
        rawContexts, setRawContexts,
        bridgeFiles, setBridgeFiles,  // v6.1.1 - Smart Bridge file queue
        isDebugMode, toggleDebugMode, addDebugLog,  // v6.2.0 - Debug Mode
        isDeepThinkingMode, // v6.3.2 - Mode Lourd
        commitLogSession, clearDebugLogs // v6.3.3
    } = context;


    const [addExpertForm, setAddExpertForm] = useState({ nom: '', tel: '' });
    const [isDraggingOverFrais, setIsDraggingOverFrais] = useState(false);
    const [isDraggingOverInfos, setIsDraggingOverInfos] = useState(false);
    const [isDraggingOverCause, setIsDraggingOverCause] = useState(false);
    const [isDraggingOverAnnexes, setIsDraggingOverAnnexes] = useState(false);
    const [showAiDossierPrompt, setShowAiDossierPrompt] = useState(false);
    const [aiDossierRef, setAiDossierRef] = useState('');
    const [droppedMsgFile, setDroppedMsgFile] = useState(null);
    // v5.6.2 - Refining state pour la Sidebar
    const [refiningCause, setRefiningCause] = useState(false);
    const [isRefiningNote, setIsRefiningNote] = useState(false);
    const [isDraggingOverMagic, setIsDraggingOverMagic] = useState(false);
    const [isAiDossierLoading, setIsAiDossierLoading] = useState(false);

    // v5.9.4 - Smart Bridge State
    const [isBridgeModalOpen, setIsBridgeModalOpen] = useState(false);
    const [currentBridgeFile, setCurrentBridgeFile] = useState(null);
    const [bridgeMatchResult, setBridgeMatchResult] = useState(null);

    // v6.0.0 - Generator State
    const [generatedText, setGeneratedText] = useState(null);
    const [isGeneratorModalOpen, setIsGeneratorModalOpen] = useState(false);

    // v6.4.1 - Bulk Photo Selection and Move
    const [selectedPhotos, setSelectedPhotos] = useState([]);
    const [isMovingPhotos, setIsMovingPhotos] = useState(false);
    
    // v6.4.4 - Convert photo to devis
    const [processingPhotoId, setProcessingPhotoId] = useState(null);

    const handleTogglePhotoSelect = (dbKey) => {
        setSelectedPhotos(prev => prev.includes(dbKey) ? prev.filter(k => k !== dbKey) : [...prev, dbKey]);
    };

    const handleMoveSelectedPhotos = async (targetOccId) => {
        if (!targetOccId || selectedPhotos.length === 0) return;
        setIsMovingPhotos(true);
        
        for (const dbKey of selectedPhotos) {
            let sourceId = null;
            let photoObj = null;
            
            if (attachedPhotos['unassigned']?.some(p => p.dbKey === dbKey)) {
                sourceId = 'unassigned';
                photoObj = attachedPhotos['unassigned'].find(p => p.dbKey === dbKey);
            } else {
                for (const occId of Object.keys(attachedPhotos)) {
                    if (occId !== 'unassigned' && attachedPhotos[occId]?.some(p => p.dbKey === dbKey)) {
                        sourceId = occId;
                        photoObj = attachedPhotos[occId].find(p => p.dbKey === dbKey);
                        break;
                    }
                }
            }
            
            if (sourceId && photoObj && sourceId !== targetOccId) {
                const bytes = await localforage.getItem(dbKey);
                if (bytes) {
                    const mime = photoObj.isPdf ? 'application/pdf' : 'image/jpeg';
                    const file = new File([bytes], photoObj.name, { type: mime });
                    await handleAttachPhoto(targetOccId, file);
                    handleRemovePhoto(sourceId, dbKey);
                }
            }
        }
        
        setSelectedPhotos([]);
        setIsMovingPhotos(false);
    };

    // v6.4.4 - Convert photo to devis logic
    const handleConvertPhotoToDevis = async (dbKey) => {
        setProcessingPhotoId(dbKey);
        try {
            const bytes = await localforage.getItem(dbKey);
            if (!bytes) throw new Error("Fichier introuvable en local");
            
            const photoObj = attachedPhotos['unassigned']?.find(p => p.dbKey === dbKey);
            if (!photoObj) throw new Error("Photo introuvable dans unassigned");

            const mime = photoObj.isPdf ? 'application/pdf' : 'image/jpeg';
            const file = new File([bytes], photoObj.name, { type: mime });
            
            // Appeler OpenAI
            const { extractFinancialData } = await import('../services/agents/financial.js');
            const apiKey = aiConfig.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
            const res = await extractFinancialData(file, apiKey, null, 'gpt-5.4', occupants);
            
            if (res.success && res.data.expenses && res.data.expenses.length > 0) {
                const expenseData = res.data.expenses[0];
                const newId = crypto.randomUUID();
                
                // Ajouter à ExpertContext (frais)
                const newExp = {
                    ...expenseData,
                    id: newId,
                    montant: expenseData.montantReclame || expenseData.montantDevis || expenseData.montantFacture || '',
                    montantReclame: expenseData.montantReclame || expenseData.montantDevis || expenseData.montantFacture || '',
                    montantValide: expenseData.montantValide || expenseData.montantReclame || expenseData.montantDevis || expenseData.montantFacture || '',
                    compteDe: expenseData.compteDe || 'unassigned'
                };
                setExpenses(prev => [...prev, newExp]);
                
                // Attacher la photo à la nouvelle ligne de frais
                await handleAttachPhoto(newId, file);
                
                // Retirer de 'unassigned'
                handleRemovePhoto('unassigned', dbKey);
                
                alert("✅ Document financier analysé avec succès ! Une ligne de frais a été créée.");
            } else {
                alert("❌ Aucun montant trouvé dans ce document.");
            }
        } catch (err) {
            console.error(err);
            alert("Erreur lors de l'analyse : " + err.message);
        } finally {
            setProcessingPhotoId(null);
        }
    };

    // v6.1.1 - Smart Bridge : reçoit un TABLEAU de fichiers depuis le dropzone
    const handleCopyResume = async () => {
        let text = "";
        
        if (formData.cause) text += "CAUSE :\n" + formData.cause + "\n\n";
        if (formData.franchise) text += "FRANCHISE :\n" + formData.franchise + "\n\n";
        if (formData.pertesIndirectes) text += "PERTES INDIRECTES :\n" + formData.pertesIndirectes + "\n\n";
        
        text += "PARTIES :\n";
        
        occupants?.forEach(o => {
            text += `- ${o.statut} : ${[o.nom, o.prenom].filter(Boolean).join(' ')}\n`;
            if (o.adresse) text += `  Adresse : ${o.adresse}\n`;
            if (o.email) text += `  Email : ${o.email}\n`;
            if (o.tel) text += `  Tél : ${o.tel}\n`;
        });
        
        intervenantsList?.forEach(i => {
            text += `- ${i.role || 'Intervenant'} : ${[i.nom, i.prenom].filter(Boolean).join(' ')}\n`;
            if (i.adresse) text += `  Adresse : ${i.adresse}\n`;
            if (i.email) text += `  Email : ${i.email}\n`;
            if (i.tel) text += `  Tél : ${i.tel}\n`;
        });
        
        try {
            await navigator.clipboard.writeText(text);
            alert("Résumé copié dans le presse-papier !");
        } catch (err) {
            alert("Erreur lors de la copie.");
        }
    };

    const handleSmartBridgeDrop = (filesArray) => {
        if (!filesArray || filesArray.length === 0) return;
        setCurrentBridgeFile(filesArray); // stocke le tableau complet
        // Matching sur le premier .msg trouvé (ou le premier fichier)
        const msgFile = filesArray.find(f => f.name.toLowerCase().endsWith('.msg')) || filesArray[0];
        const match = findMatchingDossier(msgFile.name, savedDossiers);
        setBridgeMatchResult(match);
        setIsBridgeModalOpen(true);
    };

    // v6.1.1 - Smart Bridge : analyse TOUS les fichiers d'un coup
    const triggerSmartBridgeAnalysis = async (filesArray) => {
        const allFiles = Array.isArray(filesArray) ? filesArray : [filesArray];
        if (allFiles.length === 0) return;
        setIsAiDossierLoading(true);
        if (typeof clearDebugLogs === 'function') clearDebugLogs();
        try {
            if (!isAiModeActive) {
                // Mode non-IA : extraire les PJ des MSGs
                const pendingFiles = [];
                for (const file of allFiles) {
                    if (file.name.toLowerCase().endsWith('.msg')) {
                        const { files: extracted } = await extractValidAttachmentsFromMsg(file);
                        pendingFiles.push(...extracted);
                    } else {
                        pendingFiles.push(file);
                    }
                }
                setPendingAiData({ formData: null, occupants: [], expenses: [], pendingFiles });
                return;
            }

            const result = await processGlobalIngestion(
                allFiles,
                aiConfig.apiKey,
                setAiStatus,
                aiConfig.model,
                { cause: formData?.cause },
                addDebugLog,
                isDeepThinkingMode
            );

            if (result.success && result.data) {
                const aiData = result.data;
                const occupants = (aiData.occupants || []).map(o => ({ ...o, id: o.id || crypto.randomUUID() }));
                const expenses = (aiData.expenses || []).map(e => ({ ...e, id: e.id || crypto.randomUUID(), compteDe: e.compteDe || 'unassigned' }));
                const allPendingFiles = [
                    ...(result.extractedFiles || []),
                    ...allFiles.filter(f => !f.name.toLowerCase().endsWith('.msg'))
                ];

                setPendingAiData({
                    formData: aiData.formData || null,
                    occupants,
                    expenses,
                    pendingFiles: allPendingFiles
                });

                // v6.0.0 - Context Vault
                const newContexts = [];
                if (aiData.formData?.cause) newContexts.push(aiData.formData.cause);
                if (aiData.formData?.divers) newContexts.push(aiData.formData.divers);
                if (newContexts.length > 0) {
                    setRawContexts(prev => [...prev, ...newContexts]);
                    console.log(`[Context Vault] +${newContexts.length} contexte(s) via SmartBridge`);
                }
            } else {
                alert("Erreur IA : " + (result.error || "Impossible d'extraire les données."));
            }
        } catch (err) {
            console.error("[SmartBridge] Erreur:", err);
            alert("Erreur : " + err.message);
        } finally {
            setIsAiDossierLoading(false);
            setAiStatus('idle');
            // v6.1.1 - Vider la file du Smart Bridge après analyse
            setBridgeFiles([]);
            if (typeof commitLogSession === 'function') commitLogSession();
        }
    };

    const resetAllDragStates = () => {
        setIsDraggingOverFrais(false);
        setIsDraggingOverInfos(false);
        setIsDraggingOverCause(false);
        setIsDraggingOverAnnexes(false);
    };



    const [isAnnexAiLoading, setIsAnnexAiLoading] = useState(false);
    const [showAnnexModal, setShowAnnexModal] = useState(false);
    const [annexModalMode, setAnnexModalMode] = useState('annexes-only');
    const [showPrintMenu, setShowPrintMenu] = useState(false);
    // Magic Drop states

    // Contract Magic Drop states
    const [isCauseAiLoading, setIsCauseAiLoading] = useState(false);

    const handleAnnexMagicDrop = async (files) => {
        if (!files || files.length === 0) return;
        setIsAnnexAiLoading(true);
        const aiProvider = aiConfig.provider;
        const aiModel = aiConfig.model;

        try {
            const file = files[0];
            if (!isAiModeActive) {
                if (file.name.toLowerCase().endsWith('.msg')) {
                    const { files: extractedFiles } = await extractValidAttachmentsFromMsg(file);
                    if (extractedFiles.length === 0) {
                        alert("Aucune pièce jointe valide (PDF/Image) trouvée dans cet email.");
                        return;
                    }
                    extractedFiles.forEach(extractedFile => {
                        openIngestion(extractedFile, 'annexe');
                    });
                } else {
                    openIngestion(file, 'annexe');
                }
                return;
            }

            if (isAiModeActive) {
                const result = await extractDataFromDocument(file, 'annexe', aiProvider, aiModel, aiConfig.apiKey, setAiStatus);
                if (result.success && result.data && result.data.title) {
                    openIngestion(file, 'annexe', { customName: result.data.title });
                } else {
                    openIngestion(file, 'annexe');
                }
            }
        } catch (err) {
            console.error("[Sidebar] Erreur lors du titrage de l'annexe :", err);
            openIngestion(files[0], 'annexe');
        } finally {
            setIsAnnexAiLoading(false);
            setAiStatus('idle');
        }
    };

    const handleCauseMagicDrop = async (files) => {
        if (!files || files.length === 0) return;
        setIsCauseAiLoading(true);
        
        try {
            if (!isAiModeActive) {
                const file = files[0];
                const filesToProcess = file.name.toLowerCase().endsWith('.msg') ? (await extractValidAttachmentsFromMsg(file)).files : [file];
                if (filesToProcess.length === 0) return alert("Aucune pièce jointe valide trouvée.");
                
                for (const f of filesToProcess) {
                    const arrayBuffer = await f.arrayBuffer();
                    const dbKey = `cause_${crypto.randomUUID()}_${f.name}`;
                    await localforage.setItem(dbKey, arrayBuffer);
                    addCauseTimelineItem('file', f, dbKey);
                }
                return;
            }

            // v5.6.3 - Logique incrémentale : passe la cause existante pour accumulation
            const result = await extractNarrativeData(files, aiConfig.apiKey, setAiStatus, aiConfig.model, formData.cause || '');
            if (result.success && result.data && result.data.cause) {
                // Mettre à jour formData.cause directement (persistance immédiate)
                setFormData(prev => ({ ...prev, cause: result.data.cause }));
                if (result.data.divers) {
                    setFormData(prev => ({ ...prev, divers: (prev.divers ? prev.divers + '\n\n' : '') + result.data.divers }));
                }
                addCauseTimelineItem('text', "Synthèse IA : " + result.data.cause);
                for (const f of files) {
                    const arrayBuffer = await f.arrayBuffer();
                    const dbKey = `cause_${crypto.randomUUID()}_${f.name}`;
                    await localforage.setItem(dbKey, arrayBuffer);
                    addCauseTimelineItem('file', f, dbKey);
                }
            } else {
                alert("Erreur lors de la synthèse : " + (result.error || "Réponse invalide"));
            }
        } catch (err) {
            alert("Erreur : " + err.message);
        } finally {
            setIsCauseAiLoading(false);
            setAiStatus('idle');
        }
    };
    const [isContractAiLoading, setIsContractAiLoading] = useState(false);

    const handleContractMagicDrop = async (files) => {
        if (!files || files.length === 0) return;
        setIsContractAiLoading(true);
        const aiProvider = aiConfig.provider;
        const aiModel = aiConfig.model;

        try {
            const file = files[0];
            if (!isAiModeActive) {
                if (file.name.toLowerCase().endsWith('.msg')) {
                    const { files: extractedFiles } = await extractValidAttachmentsFromMsg(file);
                    if (extractedFiles.length === 0) {
                        alert("Aucune pièce jointe valide (PDF/Image) trouvée dans cet email.");
                        return;
                    }
                    extractedFiles.forEach(extractedFile => {
                        openIngestion(extractedFile, 'cp');
                    });
                } else {
                    openIngestion(file, 'cp');
                }
                return;
            }

            if (isAiModeActive) {
                // v5.5.6 - Utilisation du nouvel Agent Administratif
                const result = await extractAdministrativeData([file], aiConfig.apiKey, setAiStatus, aiModel);
                if (result.success && result.data && result.data.formData) {
                    openIngestion(file, 'cp', result.data.formData);
                } else {
                    alert("Erreur lors de l'extraction : " + (result.error || "Format invalide"));
                    openIngestion(file, 'cp');
                }
            }
        } catch (err) {
            alert("Erreur : " + err.message);
            openIngestion(files[0], 'cp');
        } finally {
            setIsContractAiLoading(false);
            setAiStatus('idle');
        }
    };
    const [isAiLoading, setIsAiLoading] = useState(false);

    const handleMagicDrop = async (files, existingId = null) => {
        if (!files || files.length === 0) return;
        setIsAiLoading(true);
        const aiProvider = aiConfig.provider;
        const aiModel = aiConfig.model;

        try {
            const file = files[0];
            if (!isAiModeActive) {
                if (file.name.toLowerCase().endsWith('.msg')) {
                    const { files: extractedFiles } = await extractValidAttachmentsFromMsg(file);
                    if (extractedFiles.length === 0) {
                        alert("Aucune pièce jointe valide (PDF/Image) trouvée dans cet email.");
                        return;
                    }
                    extractedFiles.forEach(extractedFile => {
                        openIngestion(extractedFile, 'frais', null, existingId);
                    });
                } else {
                    openIngestion(file, 'frais', null, existingId);
                }
                return;
            }

            if (isAiModeActive) {
                // v5.5.6 - Utilisation du nouvel Agent Financier
                // v5.7.3 - Fix signature (occupants n'est plus passé à extractFinancialData directement)
                const result = await extractFinancialData([file], aiConfig.apiKey, setAiStatus, aiModel);
                if (result.success && result.data && result.data.expenses && result.data.expenses.length > 0) {
                    let exp = result.data.expenses[0];
                    // Mapping local avec la liste des occupants
                    if (exp.destinataireFacture && exp.destinataireFacture.trim() !== '') {
                        const destLower = exp.destinataireFacture.toLowerCase();
                        const matchedOcc = occupants.find(o => {
                            const nom = (o.nom || '').toLowerCase();
                            const prenom = (o.prenom || '').toLowerCase();
                            return destLower.includes(nom) || nom.includes(destLower) || 
                                   (prenom && (destLower.includes(prenom) || prenom.includes(destLower)));
                        });
                        if (matchedOcc) {
                            exp.compteDe = matchedOcc.id;
                        }
                    }
                    openIngestion(file, 'frais', exp, existingId);
                } else {
                    alert("Erreur lors de l'extraction : " + (result.error || "Format invalide"));
                    openIngestion(file, 'frais', null, existingId);
                }
            }
        } catch (err) {
            alert("Erreur : " + err.message);
            openIngestion(files[0], 'frais', null, existingId);
        } finally {
            setIsAiLoading(false);
            setAiStatus('idle');
        }
    };

    const [editingExpert, setEditingExpert] = useState(null);
    const [addFranchiseForm, setAddFranchiseForm] = useState({ moisAnnee: '', montant: '' });
    const draggedOccRef = useRef(null);
    const draggedExpRef = useRef(null);

    const handleAddExpert = () => {
        const nom = addExpertForm.nom.trim(); const tel = addExpertForm.tel.trim();
        if (!nom && !tel) return alert("Champ vide.");
        let newList = editingExpert ? expertsList.filter(e => e.nom !== editingExpert.oldNom || e.tel !== editingExpert.oldTel) : [...expertsList];
        newList.push({ nom, tel }); setExpertsList(newList); setAddExpertForm({ nom: '', tel: '' }); setEditingExpert(null);
    };

    const handleAddFranchise = () => {
        if (!addFranchiseForm.moisAnnee || !addFranchiseForm.montant) return alert("Erreur.");
        setFranchises([`${addFranchiseForm.moisAnnee} - ${addFranchiseForm.montant}`, ...franchises]); setAddFranchiseForm({ moisAnnee: '', montant: '' });
    };

    const formatExpertDisplay = (exp) => (exp.nom && exp.tel) ? `${exp.nom} - ${exp.tel}` : (exp.nom || exp.tel || 'Inconnu');

    const sortedExperts = [...expertsList].sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
    const filteredExperts = sortedExperts.filter(exp => (exp.nom || '').toLowerCase().startsWith((formData.expertInfos||'').split(' - ')[0].toLowerCase()));
    const filteredExpertsContradictoire = sortedExperts.filter(exp => (exp.nom || '').toLowerCase().startsWith((formData.expertContradictoire||'').split(' - ')[0].toLowerCase()));
    const filteredFranchises = [...franchises].filter(f => (f || '').toLowerCase().includes((formData.franchise || '').toLowerCase()));


    const activeDossier = savedDossiers.find(d => d.id === currentDossierId);
    const activeName = activeDossier ? activeDossier.name : 'Nouveau (Non sauvegardé)';

    return (
        <>
        <div id="sidebar" style={{ width: `${sidebarWidth}px` }} className="bg-slate-900 text-slate-200 flex flex-col shadow-xl z-10 shrink-0 h-screen overflow-hidden">
            <div className="p-3 border-b border-slate-700 bg-slate-800">
                <div className="flex justify-between items-center mb-1">
                    <div>
                        <h1 className="text-[11px] font-bold text-white leading-tight uppercase tracking-wider">Page de garde</h1>
                        <div className="flex items-center gap-1 mt-0.5 text-[9px]">
                            <span className="text-slate-500">Dossier :</span>
                            <span className="text-indigo-300 font-bold truncate max-w-[100px]">{activeName}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* AI Controls & Dev Mode */}
                        <div className="flex items-center gap-1 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">
                            <button
                                onClick={toggleAiMode}
                                className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${isAiModeActive ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-slate-300'}`}
                                title="Activer/Désactiver l'IA"
                            >
                                <span className={isAiModeActive ? 'animate-pulse' : ''}>✨</span> IA
                            </button>
                            <div className="w-px h-3 bg-slate-700 mx-0.5"></div>
                            <button
                                onClick={toggleDebugMode}
                                className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${isDebugMode ? 'bg-red-900/50 text-red-400' : 'text-slate-500 hover:text-slate-400'}`}
                                title="Console Développeur"
                            >
                                🦂
                            </button>
                        </div>
                        <div className="flex gap-1.5">
                            <button onClick={handleNewDossier} className="bg-slate-700 hover:bg-slate-600 text-white px-1.5 py-1 rounded text-[9px] font-bold border border-slate-600 transition-colors flex items-center justify-center gap-1" title="Nouveau dossier">
                                ➕ New
                            </button>
                            <button onClick={saveDossier} className="bg-indigo-600 hover:bg-indigo-500 text-white px-1.5 py-1 rounded text-[9px] font-bold shadow transition-colors flex items-center justify-center gap-1" title="Sauvegarder">
                                💾 Save
                            </button>
                            <button onClick={handleReset} className="bg-slate-900 text-red-400 hover:bg-slate-800 px-1.5 py-1 rounded text-[9px] font-bold border border-slate-700 transition-colors flex items-center justify-center gap-1" title="Réinitialiser la vue">
                                🔄 Reset
                            </button>
                        </div>
                    </div>
                </div>

                {/* AI Settings Inline Menu */}
                {/* Warning Message if AI active but no API key */}
                {isAiModeActive && !aiConfig.apiKey && (
                    <div className="bg-orange-900/40 border border-orange-500/50 p-1.5 mt-2 rounded text-[9px] text-orange-200 text-center">
                        ⚠️ Veuillez configurer votre clé API dans les réglages ⚙️
                    </div>
                )}

                {/* v5.9.4 - Smart Bridge (Relocation & Restore) - Toujours visible */}
                <div className="mt-2 mb-2">
                    <SmartBridgeDropzone onFileDrop={handleSmartBridgeDrop} />
                </div>

                <div className="flex space-x-2 bg-slate-900 p-1 rounded-lg border border-slate-700">
                    <button className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-colors ${activeTab === 'builder' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} onClick={() => setActiveTab('builder')}>Éditeur</button>
                    <button className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-colors ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} onClick={() => setActiveTab('settings')}>Paramètres</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4" style={{ zoom: uiZoom }}>
                {activeTab === 'settings' ? (
                    <div className="space-y-6">



                        <div className="bg-slate-800 p-4 rounded border border-slate-700 mt-6">
                            <h3 className="text-sm font-bold text-white mb-2 flex items-center justify-between">
                                <span>✨ Configuration IA</span>
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-slate-400 mb-1 text-xs">Clé API (OpenAI)</label>
                                    <input
                                        type="password"
                                        value={aiConfig.apiKey}
                                        onChange={(e) => updateAiConfig({ apiKey: e.target.value })}
                                        placeholder="sk-..."
                                        className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white focus:border-indigo-500 outline-none text-xs"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="block text-slate-400 mb-1 text-xs">Provider</label>
                                        <select
                                            value={aiConfig.provider}
                                            onChange={(e) => updateAiConfig({ provider: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white focus:border-indigo-500 outline-none text-xs"
                                        >
                                            <option value="openai">OpenAI</option>
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-slate-400 mb-1 text-xs">Modèle</label>
                                        <select
                                            value={aiConfig.model}
                                            onChange={(e) => updateAiConfig({ model: e.target.value })}
                                            className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-white focus:border-indigo-500 outline-none text-xs"
                                        >
                                            <option value="gpt-4o">gpt-4o</option>
                                            <option value="gpt-4o-mini">gpt-4o-mini</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-800 p-4 rounded border border-slate-700 mt-6">
                            <h3 className="text-sm font-bold text-white mb-2">📂 Gestion des dossiers</h3>
                            <div className="flex gap-2 mb-3">
                                <button onClick={saveDossier} className="flex-1 bg-slate-600 hover:bg-slate-500 text-white py-1.5 rounded text-xs font-bold shadow">💾 Sauvegarder</button>
                                {currentDossierId && <button onClick={saveDossierAs} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 rounded text-xs font-bold shadow">📁 Copier</button>}
                            </div>
                            {savedDossiers.length > 0 && <input type="text" placeholder="🔍 Rechercher..." value={dossierSearch} onChange={(e) => setDossierSearch(e.target.value)} className="input-field mb-3 w-full" />}
                            <div className="border-t border-slate-700 pt-3 max-h-48 overflow-y-auto pr-1">
                                {savedDossiers.length === 0 ? <p className="text-[10px] text-slate-400 italic text-center">Aucun dossier.</p> : 
                                    <ul className="space-y-2">
                                        {savedDossiers.filter(d => (d.name || '').toLowerCase().includes(dossierSearch.toLowerCase())).map(d => (
                                            <li 
                                                key={d.id} 
                                                onClick={() => loadDossier(d)}
                                                className="group flex justify-between items-center bg-slate-900 hover:bg-slate-800 p-1.5 rounded border border-slate-600 transition-colors cursor-pointer"
                                            >
                                                <div className="flex flex-col min-w-0 mr-2">
                                                    <span className="font-bold text-xs text-white truncate">{d.name}</span>
                                                    <span className="text-[9px] text-slate-400">{d.date}</span>
                                                </div>
                                                <button 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); // Empêche de charger le dossier quand on clique sur la poubelle
                                                        deleteDossier(d.id); 
                                                    }} 
                                                    className="text-slate-500 hover:text-red-400 hover:bg-red-400/10 p-1.5 rounded transition-colors opacity-40 group-hover:opacity-100 flex-shrink-0" 
                                                    title="Supprimer"
                                                >
                                                    🗑️
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                }
                            </div>
                        </div>

                        <div className="bg-slate-800 p-4 rounded border border-slate-700">
                            <h3 className="text-sm font-bold text-white mb-2">{editingExpert ? "✏️ Modifier l'Expert" : "➕ Base Experts"}</h3>
                            <div className="flex gap-2"><div className="flex-1"><label>Nom</label><input type="text" value={addExpertForm.nom} onChange={e=>setAddExpertForm({...addExpertForm, nom:e.target.value})} placeholder="GABER Lionel" className="input-field mb-0"/></div><div className="flex-1"><label>Tél</label><input type="text" value={addExpertForm.tel} onChange={e=>setAddExpertForm({...addExpertForm, tel:e.target.value})} placeholder="04XX XX XX" className="input-field mb-0"/></div></div>
                            <button onClick={handleAddExpert} className="w-full mt-2 bg-green-700 hover:bg-green-600 py-1.5 rounded text-xs font-bold">{editingExpert ? "Enregistrer" : "Ajouter"}</button>
                            <div className="mt-4 pt-4 border-t border-slate-700 max-h-48 overflow-y-auto pr-1">
                                <ul className="space-y-1 text-xs">
                                    {sortedExperts.map((exp, idx) => <li key={idx} className="flex justify-between items-center bg-slate-900 px-2 py-1.5 rounded border border-slate-700"><span>{formatExpertDisplay(exp)}</span><div><button onClick={()=>{setAddExpertForm({nom:exp.nom,tel:exp.tel});setEditingExpert({oldNom:exp.nom,oldTel:exp.tel})}}>✏️</button> <button onClick={()=>window.confirm('Supprimer ?')&&setExpertsList(expertsList.filter(e=>e!==exp))} className="text-red-400">🗑️</button></div></li>)}
                                </ul>
                            </div>
                        </div>

                        <div className="bg-slate-800 p-4 rounded border border-slate-700">
                            <h3 className="text-sm font-bold text-white mb-2">➕ Base Franchises</h3>
                            <div className="flex gap-2"><div className="flex-1"><label>Mois/Année</label><input type="text" value={addFranchiseForm.moisAnnee} onChange={e=>setAddFranchiseForm({...addFranchiseForm, moisAnnee:e.target.value})} placeholder="Mai 2026" className="input-field mb-0"/></div><div className="flex-1"><label>Montant</label><input type="text" value={addFranchiseForm.montant} onChange={e=>setAddFranchiseForm({...addFranchiseForm, montant:e.target.value})} placeholder="335,00 €" className="input-field mb-0"/></div></div>
                            <button onClick={handleAddFranchise} className="w-full mt-2 bg-slate-700 hover:bg-slate-600 py-1.5 rounded text-xs font-bold">Ajouter</button>
                            <div className="mt-4 pt-4 border-t border-slate-700 max-h-32 overflow-y-auto pr-1">
                                <ul className="space-y-1 text-xs text-slate-300">
                                    {franchises.map((f, idx) => <li key={idx} className="flex justify-between items-center bg-slate-900 px-2 py-1.5 rounded border border-slate-700"><span>{f}</span><button onClick={()=>window.confirm('Supprimer ?')&&setFranchises(franchises.filter(x=>x!==f))} className="hover:text-red-400 shrink-0">🗑️</button></li>)}
                                </ul>
                            </div>
                        </div>


                        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-4 rounded border border-blue-500 shadow-lg">
                            <h3 className="text-sm font-bold text-white mb-2">💾 Sauvegarde Globale</h3>
                            <button onClick={exportGlobalData} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-xs font-bold shadow mb-2">📥 Exporter Sauvegarde Totale (.json)</button>
                            <p className="text-[10px] text-indigo-200 leading-tight">Pour restaurer, utilisez simplement la zone "Importer Fichier" au-dessus avec votre fichier .json.</p>
                        </div>
                    </div>
                ) : (
                    <div>
                        {/* v5.9.4 - Relocation & Restore */}
                        <div className={!isAiModeActive ? "opacity-50 pointer-events-none select-none grayscale transition-all mb-4" : "transition-all mb-4"}>
                            <GlobalAiAssistant />
                        </div>
                        <details className="bg-slate-800/50 rounded border border-slate-700 mb-2 group" open>
                            <summary className="p-3 text-xs font-bold uppercase text-indigo-400 cursor-pointer select-none group-open:border-b border-slate-700">1. Titre Document</summary>
                            <div className="p-3 space-y-2">
                                <div className="flex gap-2 items-end"><div className="flex-1"><label className="flex items-center w-full">Date de l'expertise <AttachmentUI onDragFinish={resetAllDragStates} docId="doc_mail_expertise" title="Mail de confirmation" /></label><input type="date" name="dateExp" value={formData.dateExp} onChange={handleChange} className="input-field" /></div><div className="flex-1"><label>Heure</label><input type="time" name="heureExp" value={formData.heureExp} onChange={handleChange} className="input-field" /></div></div>
                                <div className="flex gap-2"><div className="flex-1"><label>Réf Péchard</label><input type="text" name="refPechard" value={formData.refPechard} onChange={handleChange} className="input-field" /></div><div className="flex-1"><label>Nom Résidence</label><input type="text" name="nomResidence" value={formData.nomResidence} onChange={handleChange} className="input-field" /></div></div>
                            </div>
                        </details>

                        <details className="bg-slate-800/50 rounded border border-slate-700 mb-2 group">
                            <AccordionHeader id="coord" num="2" />
                            <div className="p-3 space-y-2">
                                <label>Adresse du sinistre</label><input type="text" name="adresse" value={formData.adresse} onChange={handleChange} className="input-field" />
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <label>Franchise applicable</label>
                                        <input type="text" name="franchise" value={formData.franchise} onChange={(e) => { handleChange(e); setShowFranchiseDropdown(true); }} onFocus={() => setShowFranchiseDropdown(true)} onBlur={() => setTimeout(() => setShowFranchiseDropdown(false), 200)} className="input-field mb-0" placeholder="Ex: 335,00 €" />
                                        {showFranchiseDropdown && filteredFranchises.length > 0 && <ul className="absolute z-50 w-full bg-slate-700 border border-slate-500 rounded mt-[-2px] max-h-40 overflow-y-auto">{filteredFranchises.map((f, idx) => <li key={idx} className="px-2 py-1.5 text-xs text-white hover:bg-indigo-500 cursor-pointer" onMouseDown={() => { setFormData({ ...formData, franchise: f }); setShowFranchiseDropdown(false); }}>{f}</li>)}</ul>}
                                    </div>
                                    <div className="flex-1"><label>Pertes indirectes</label><select name="pertesIndirectes" value={formData.pertesIndirectes} onChange={handleChange} className="input-field mb-0"><option value="">Sélectionner...</option><option value="0%">0%</option><option value="5%">5%</option><option value="10%">10%</option></select></div>
                                </div>
                                <div className="flex justify-end mt-1">
                                    <label className="flex items-center space-x-1.5 cursor-pointer text-[10px] text-slate-500 hover:text-slate-300 transition-colors" title="Chez AXA, on ne reçoit que 80% des montants HTVA">
                                        <input type="checkbox" name="isAxa" checked={formData.isAxa || false} onChange={(e) => setFormData({...formData, isAxa: e.target.checked})} className="w-3 h-3 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-0" />
                                        <span>Règle AXA (80% HTVA)</span>
                                    </label>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-700">
                                    <div><label>Bureau d'expertise</label><input type="text" name="bureau" value={formData.bureau} onChange={handleChange} placeholder="Ex: DION" className="input-field mb-0" list="bureau-suggestions" /><datalist id="bureau-suggestions"><option value="Expert interne" /><option value="DION Expertises" /><option value="DE ROO & PARTNERS" /></datalist></div>
                                    <div className="relative"><label>Expert en charge</label><input type="text" name="expertInfos" value={formData.expertInfos} onChange={(e) => { handleChange(e); setShowExpertDropdown(true); }} onFocus={() => setShowExpertDropdown(true)} onBlur={() => setTimeout(() => setShowExpertDropdown(false), 200)} placeholder="Taper le nom..." className="input-field mb-0" />
                                        {showExpertDropdown && filteredExperts.length > 0 && <ul className="absolute z-50 w-full bg-slate-700 border border-slate-500 rounded mt-[-2px] max-h-40 overflow-y-auto">{filteredExperts.map((exp, idx) => <li key={idx} className="px-2 py-1.5 text-xs text-white hover:bg-indigo-500 cursor-pointer" onMouseDown={() => { setFormData({ ...formData, expertInfos: formatExpertDisplay(exp) }); setShowExpertDropdown(false); }}>{formatExpertDisplay(exp)}</li>)}</ul>}
                                    </div>
                                </div>
                                <label className="flex items-center space-x-2 mt-4 cursor-pointer text-white font-bold bg-slate-700 p-2 rounded border border-slate-600"><input type="checkbox" name="isContradictoire" checked={formData.isContradictoire} onChange={handleChange} className="w-4 h-4" /><span>Expertise Contradictoire</span></label>
                                {formData.isContradictoire && (
                                    <div className="border-l-2 border-indigo-500 pl-3 ml-1 mt-2 space-y-2">
                                        <label>Compagnie (Tiers)</label><input type="text" name="cieContradictoire" value={formData.cieContradictoire} onChange={handleChange} className="input-field" />
                                        <div className="grid grid-cols-2 gap-2">
                                            <div><label>Bureau (Tiers)</label><input type="text" name="bureauContradictoire" value={formData.bureauContradictoire} onChange={handleChange} className="input-field mb-0" /></div>
                                            <div className="relative"><label>Expert en charge (Tiers)</label><input type="text" name="expertContradictoire" value={formData.expertContradictoire} onChange={(e) => { handleChange(e); setShowExpertDropdownContradictoire(true); }} onFocus={() => setShowExpertDropdownContradictoire(true)} onBlur={() => setTimeout(() => setShowExpertDropdownContradictoire(false), 200)} placeholder="Taper nom..." className="input-field mb-0" />
                                                {showExpertDropdownContradictoire && filteredExpertsContradictoire.length > 0 && <ul className="absolute z-50 w-full bg-slate-700 border border-slate-500 rounded mt-[-2px] max-h-40 overflow-y-auto">{filteredExpertsContradictoire.map((exp, idx) => <li key={idx} className="px-2 py-1.5 text-xs text-white hover:bg-indigo-500 cursor-pointer" onMouseDown={() => { setFormData({ ...formData, expertContradictoire: formatExpertDisplay(exp) }); setShowExpertDropdownContradictoire(false); }}>{formatExpertDisplay(exp)}</li>)}</ul>}
                                            </div>
                                        </div>
                                        <label>Pour le compte de</label>
                                        <select name="compteDeContradictoire" value={formData.compteDeContradictoire || ''} onChange={handleChange} className="input-field">
                                            <option value="">Choisissez...</option>
                                            {occupants.filter(o => o.nom).map(o => {
                                                const fullName = `${o.nom || ''} ${o.prenom || ''}`.trim();
                                                const displayName = o.etage && o.etage.trim() !== '' ? `${o.etage} - ${fullName}` : fullName;
                                                return <option key={o.id} value={o.id}>{displayName}</option>;
                                            })}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </details>

                        <details className="bg-slate-800/50 rounded border border-slate-700 mb-2 group">
                            <AccordionHeader id="infos" num="3" />
                            <div
                                className="p-3 space-y-2 relative"
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const key = aiConfig.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
                                    if (isAiModeActive && key) {
                                        setIsDraggingOverInfos(true);
                                    }
                                }}
                                onDragLeave={(e) => {
                                    if (!e.currentTarget.contains(e.relatedTarget)) {
                                        setIsDraggingOverInfos(false);
                                    }
                                }}
                                onDrop={async (e) => {
                                    e.preventDefault();
                                    setIsDraggingOverInfos(false);
                                    const key = aiConfig.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
                                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                        await handleContractMagicDrop(Array.from(e.dataTransfer.files));
                                    }
                                }}
                            >
                                {isDraggingOverInfos && (
                                    <div
                                        className="absolute inset-0 bg-indigo-900/40 backdrop-blur-[2px] border-2 border-indigo-400 border-dashed rounded z-50 flex items-center justify-center"
                                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        onDrop={async (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setIsDraggingOverInfos(false);
                                            const key = aiConfig.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
                                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                                await handleContractMagicDrop(Array.from(e.dataTransfer.files));
                                            }
                                        }}
                                    >
                                        <span className="text-white font-bold text-sm text-center px-4 pointer-events-none">🪄 Relâchez pour extraire les données du contrat</span>
                                    </div>
                                )}

                                <div className="flex gap-2 items-end">
                                    <div className="flex-1"><label>Date du sinistre</label><input type="date" name="dateSinistre" value={formData.dateSinistre} onChange={handleChange} className="input-field mb-0" /></div>
                                    <div className="flex-1"><label className="flex items-center w-full">Date déclaration <AttachmentUI onDragFinish={resetAllDragStates} docId="doc_mail_declaration" title="Mail Déclaration" /></label><input type="date" name="dateDeclaration" value={formData.dateDeclaration} onChange={handleChange} className="input-field mb-0" /></div>
                                </div>
                                <div className="mb-2">
                                    <label>Déclaré par (Nom)</label><input type="text" name="declarant" value={formData.declarant} onChange={handleChange} placeholder="Ex: Mme. X" className="input-field mb-0" />
                                </div>

                                <div className="flex gap-2 pt-2 border-t border-slate-600"><div className="flex-1"><label>Nom Compagnie</label><input type="text" name="nomCie" value={formData.nomCie} onChange={handleChange} className="input-field" /></div><div className="flex-1"><label>Nom Contrat</label><input type="text" name="nomContrat" value={formData.nomContrat} onChange={handleChange} className="input-field" /></div></div>
                                <div className="flex gap-2 items-end"><div className="flex-1"><label className="flex items-center w-full">N° Police <AttachmentUI onDragFinish={resetAllDragStates} docId="doc_cond_part" title="Cond. Particulières" onUpload={(files) => handleContractMagicDrop(files)} /></label><input type="text" name="numPolice" value={formData.numPolice} onChange={handleChange} className="input-field mb-2" /></div><div className="flex-1"><label className="flex items-center w-full">N° Cond. Générales <AttachmentUI onDragFinish={resetAllDragStates} docId="doc_cond_gen" title="Cond. Générales" /></label><input type="text" name="numConditionsGenerales" value={formData.numConditionsGenerales} onChange={handleChange} className="input-field mb-2" /></div></div>
                                <div><label>N° Sinistre Cie</label><input type="text" name="numSinistreCie" value={formData.numSinistreCie} onChange={handleChange} className="input-field mb-0" /></div>
                                {/* v6.0.0 - Bouton de génération de déclaration */}
                                {isAiModeActive && aiConfig.apiKey && (
                                    <div className="mt-3 pt-2 border-t border-slate-600">
                                        <button
                                            onClick={async () => {
                                                try {
                                                    setAiStatus('generating');
                                                    const text = await generateDocument(
                                                        'declaration',
                                                        { formData, rawContexts, references, expenses, occupants },
                                                        aiConfig.apiKey,
                                                        aiConfig.model
                                                    );
                                                    setGeneratedText(text);
                                                    setIsGeneratorModalOpen(true);
                                                } catch (err) {
                                                    console.error('[Generator] Erreur:', err);
                                                    alert('Erreur de génération : ' + err.message);
                                                } finally {
                                                    setAiStatus('idle');
                                                    if (typeof commitLogSession === 'function') commitLogSession();
                                                }
                                            }}
                                            disabled={aiStatus !== 'idle'}
                                            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold py-2 px-3 rounded text-xs transition-all flex items-center justify-center gap-2 shadow"
                                        >
                                            🤖 Générer la déclaration (IA)
                                        </button>
                                        {rawContexts.length === 0 && (
                                            <p className="text-[9px] text-amber-400/70 mt-1 italic text-center">Conseil : ingérez d'abord des documents pour enrichir le contexte.</p>
                                        )}
                                    </div>
                                )}
                                <div className="mt-4 pt-2 border-t border-slate-600">
                                    <div className="flex justify-between items-center mb-2"><label className="text-white mb-0">Références tierces</label><button onClick={addRef} className="bg-slate-600 px-2 py-1 rounded text-[10px]">+ Ajouter</button></div>
                                    {references.map((r) => (
                                        <div key={r.id} className="flex gap-2 relative group mb-1">
                                            <input type="text" autoFocus value={r.nom} onChange={e=>updateRef(r.id, 'nom', e.target.value)} placeholder="Nom (Ex: Syndic)" className="input-field mb-0 w-1/2" /><input type="text" value={r.ref} onChange={e=>updateRef(r.id, 'ref', e.target.value)} placeholder="Référence" className="input-field mb-0 w-1/2" /><button onClick={()=>removeRef(r.id)} className="absolute -right-2 top-1 text-red-400 opacity-0 group-hover:opacity-100">✕</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </details>

                        <details className="bg-slate-800/50 rounded border border-slate-700 mb-2 group">
                            <AccordionHeader id="cause" num="4" />
                            <div
                                className="p-3 relative"
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const key = aiConfig.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
                                    if (isAiModeActive && key) {
                                        setIsDraggingOverCause(true);
                                    }
                                }}
                                onDragLeave={(e) => {
                                    if (!e.currentTarget.contains(e.relatedTarget)) {
                                        setIsDraggingOverCause(false);
                                    }
                                }}
                                onDrop={async (e) => {
                                    e.preventDefault();
                                    setIsDraggingOverCause(false);
                                    const key = aiConfig.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
                                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                        if (isAiModeActive && key) {
                                            await handleCauseMagicDrop(Array.from(e.dataTransfer.files));
                                        } else {
                                            Array.from(e.dataTransfer.files).forEach(f => handleAttachFile('doc_rapport_cause', f));
                                        }
                                    }
                                }}
                            >
                                {isDraggingOverCause && (
                                    <div
                                        className="absolute inset-0 bg-indigo-900/40 backdrop-blur-[2px] border-2 border-indigo-400 border-dashed rounded z-50 flex items-center justify-center"
                                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        onDrop={async (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setIsDraggingOverCause(false);
                                            const key = aiConfig.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
                                            if (isAiModeActive && key && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                                await handleCauseMagicDrop(Array.from(e.dataTransfer.files));
                                            }
                                        }}
                                    >
                                        <span className="text-white font-bold text-sm text-center px-4 pointer-events-none">🪄 Relâchez pour synthétiser les documents de cause</span>
                                    </div>
                                )}

                                <div className="flex items-center justify-between mb-2 mt-2">
                                    <label className="text-xs font-bold text-slate-300">Fil Chronologique</label>
                                </div>
                                <div className="flex gap-2 mb-3">
                                    <textarea id="newCauseNote" placeholder="Coller un mail, ajouter une note, une observation terrain..." className="input-field mb-0 flex-1 text-xs resize-y min-h-[32px] max-h-[120px]" rows={1} disabled={isRefiningNote} onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            document.getElementById('causeNoteSubmitBtn')?.click();
                                        }
                                    }} />
                                    <button id="causeNoteSubmitBtn" disabled={isRefiningNote} onClick={async (e) => {
                                        e.preventDefault();
                                        const input = document.getElementById('newCauseNote');
                                        const val = input.value.trim();
                                        if(!val) return;
                                        
                                        addCauseTimelineItem('text', val);
                                        input.value = '';
                                        
                                        // v5.6.5 - Affinage intelligent via IA
                                        if (isAiModeActive && aiConfig.apiKey) {
                                            setIsRefiningNote(true);
                                            try {
                                                const result = await refineCauseWithInput(formData.cause || '', val, aiConfig.apiKey);
                                                if (result.success) {
                                                    setFormData(prev => ({ ...prev, cause: result.cause }));
                                                }
                                            } catch (err) {
                                                console.error('[Sidebar] Erreur affinage cause:', err);
                                                // Fallback : concaténation simple
                                                const currentCause = formData.cause || '';
                                                setFormData(prev => ({ ...prev, cause: currentCause ? currentCause + '\n\n' + val : val }));
                                            } finally {
                                                setIsRefiningNote(false);
                                            }
                                        } else {
                                            // Sans IA : concaténation simple
                                            const currentCause = formData.cause || '';
                                            setFormData(prev => ({ ...prev, cause: currentCause ? currentCause + '\n\n' + val : val }));
                                        }
                                    }} className={`px-3 rounded text-xs font-bold shadow transition-all ${isRefiningNote ? 'bg-amber-600 text-white animate-pulse cursor-wait' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}>{isRefiningNote ? '⏳' : '+'}</button>
                                </div>
                                {isRefiningNote && (
                                    <div className="text-[9px] text-amber-400 italic mb-2 flex items-center gap-1">
                                        <span className="animate-spin inline-block">⚙️</span> Affinage intelligent en cours...
                                    </div>
                                )}
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                    {causeTimeline && causeTimeline.length > 0 ? causeTimeline.map(item => (
                                        <div key={item.id} className={`p-2 rounded border ${item.type === 'file' ? 'border-blue-500/30 bg-blue-900/20' : 'border-amber-500/30 bg-amber-900/20'}`}>
                                            <div className="flex justify-between items-center text-[9px] text-slate-400 mb-1">
                                                <span className="font-bold">{item.type === 'file' ? '📄 RAPPORT' : '📝 NOTE'}</span>
                                                <span>{item.date}</span>
                                            </div>
                                            {item.type === 'file' ? (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-blue-300 font-bold truncate max-w-[200px]" title={item.fileName}>{item.fileName}</span>
                                                    <button onClick={(e) => { e.preventDefault(); context.handleOpenFile(item.dbKey); }} className="text-[14px] text-blue-400 hover:text-blue-300" title="Ouvrir">👁️</button>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-300 whitespace-pre-wrap">{item.content}</p>
                                            )}
                                        </div>
                                    )) : (
                                        <p className="text-[10px] text-slate-500 italic text-center py-2">Aucune note ou rapport.</p>
                                    )}
                                </div>

                                {/* v5.6.2 - Textarea Cause + Boutons Refining */}
                                <div className="mt-3 border-t border-slate-700 pt-3">
                                    <label className="text-xs font-bold text-slate-300 mb-1 block">Cause & Description</label>
                                    <textarea
                                        value={formData.cause || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, cause: e.target.value }))}
                                        rows={4}
                                        placeholder="Décrivez la cause du sinistre..."
                                        className="input-field mb-0 text-xs resize-y min-h-[60px]"
                                    />
                                    {formData.cause && formData.cause.length > 10 && (
                                        <div className="flex gap-1.5 mt-1.5">
                                            {[
                                                { directive: 'DEVELOP', icon: '+', label: 'Développer', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' },
                                                { directive: 'SUMMARIZE', icon: '−', label: 'Résumer', cls: 'bg-sky-500/10 text-sky-400 border-sky-500/30 hover:bg-sky-500/20' },
                                                { directive: 'TECH_FOCUS', icon: '🔧', label: 'Technique', cls: 'bg-violet-500/10 text-violet-400 border-violet-500/30 hover:bg-violet-500/20' },
                                                { directive: 'CONTEXT_FOCUS', icon: '👥', label: 'Contexte', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20' },
                                                { directive: 'REWRITE', icon: '🔄', label: 'Réécriture', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20' }
                                            ].map(btn => (
                                                <button
                                                    key={btn.directive}
                                                    disabled={refiningCause}
                                                    onClick={async (e) => {
                                                        e.preventDefault();
                                                        setRefiningCause(true);
                                                        const result = await refineText(formData.cause, btn.directive, aiConfig?.apiKey);
                                                        if (result.success) {
                                                            setFormData(prev => ({ ...prev, cause: result.text }));
                                                        }
                                                        setRefiningCause(false);
                                                    }}
                                                    className={`text-[9px] px-1.5 py-0.5 rounded border transition-all cursor-pointer ${
                                                        refiningCause
                                                            ? 'bg-slate-700 text-slate-500 border-slate-600 cursor-wait'
                                                            : btn.cls
                                                    }`}
                                                >
                                                    {refiningCause ? '⏳' : btn.icon} {btn.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </details>

                        <details className="bg-slate-800/50 rounded border border-slate-700 mb-2 group">
                            <AccordionHeader id="orga" num="5" />
                            <div className="p-3 space-y-2">
                                <div className="flex justify-between items-center mb-2 bg-slate-800 p-2 rounded border border-slate-700">
                                    <label className="flex items-center space-x-2 cursor-pointer text-white text-[11px] font-bold">
                                        <input type="checkbox" checked={orgaAdvancedMode} onChange={(e) => {
                                            setOrgaAdvancedMode(e.target.checked);
                                            setOccupants(occupants.map(o => ({ ...o, showDetails: e.target.checked })));
                                        }} className="w-4 h-4 rounded border-slate-600 bg-slate-700" />
                                        <span>Mode avancé</span>
                                    </label>
                                    <button onClick={sortOccupantsByFloor} className="bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-[10px] text-indigo-300 border border-slate-600 transition-colors">🔄 Trier par étage</button>
                                </div>
                                {occupants.map((o, index) => {
                                    const isExp = expandedOccId === o.id;
                                    return (
                                    <div key={o.id} draggable={!isExp} onDragStart={(e) => { if(isExp) { e.preventDefault(); return; } draggedOccRef.current = index; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/html', 'x'); }} onDragEnter={(e) => e.preventDefault()} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={(e) => { e.preventDefault(); const src = draggedOccRef.current; if (src === null || src === index) return; const newOccs = [...occupants]; const item = newOccs.splice(src, 1)[0]; newOccs.splice(index, 0, item); setOccupants(newOccs); draggedOccRef.current = null; }} onDragEnd={() => { draggedOccRef.current = null; }} className={`p-2 bg-slate-900 border ${isExp ? 'border-indigo-500' : 'border-slate-600'} rounded relative mb-1 ${!isExp ? 'cursor-move' : ''}`} >
                                        <button onClick={(e) => { e.stopPropagation(); removeOcc(o.id); }} className="absolute top-1 right-2 text-red-400 text-xs z-10">✕</button>
                                        {isExp && <button onClick={(e) => { e.stopPropagation(); setExpandedOccId(null); }} className="absolute top-1 right-8 text-indigo-300 text-[10px] z-10 hover:text-white">▲ Réduire</button>}
                                        {!isExp ? (
                                            <div className="text-xs text-slate-300 pr-6 flex items-center gap-2" onClick={() => setExpandedOccId(o.id)}><span className="text-slate-500 cursor-grab">⠿</span><span className="flex-1 truncate"><span className="font-bold text-white">{o.etage || 'Étage'}</span> - {o.statut} : {o.nom || 'NOM'} {o.prenom || ''}</span></div>
                                        ) : (
                                            <div className="mt-1 grid grid-cols-2 gap-2">
                                                <div><label>Étage / Unité</label><input type="text" autoFocus value={o.etage} onChange={e=>updateOcc(o.id, 'etage', e.target.value)} className="input-field mb-0" /></div>
                                                <div><label>Statut</label><select value={o.statut} onChange={e=>updateOcc(o.id, 'statut', e.target.value)} className="input-field mb-0"><option>Locataire</option><option>Propriétaire occupant</option><option>Propriétaire non occupant</option><option>Propriétaire (occupation inconnue)</option><option>ACP</option></select></div>
                                                <div><label>Nom de famille</label><input type="text" value={o.nom} onChange={e=>updateOcc(o.id, 'nom', e.target.value.toUpperCase())} placeholder="BIRON" className="input-field mb-0 font-bold" /></div>
                                                <div><label>Prénom</label><input type="text" value={o.prenom || ''} onChange={e=>updateOcc(o.id, 'prenom', e.target.value)} placeholder="Jean" className="input-field mb-0" /></div>
                                                <div className="col-span-2"><label>Téléphone</label><input type="text" value={o.tel} onChange={e=>updateOcc(o.id, 'tel', e.target.value)} className="input-field mb-0" /></div>
                                                <div className="col-span-2 flex flex-wrap gap-x-4 gap-y-1 mt-2 pt-2 border-t border-slate-700">
                                                    <label className="flex items-center space-x-2 cursor-pointer text-slate-300 text-[10px]">
                                                        <input type="checkbox" checked={o.showDetails} onChange={(e) => updateOcc(o.id, 'showDetails', e.target.checked)} className="w-3 h-3 rounded bg-slate-700" />
                                                        <span>Mode avancé</span>
                                                    </label>
                                                    <label className="flex items-center space-x-2 cursor-pointer text-cyan-300 text-[10px]">
                                                        <input type="checkbox" checked={o.hasContact || false} onChange={(e) => updateOcc(o.id, 'hasContact', e.target.checked)} className="w-3 h-3 rounded bg-slate-700" />
                                                        <span>Contact/Représentant ?</span>
                                                    </label>
                                                    <label className="flex items-center space-x-2 cursor-pointer text-orange-300 text-[10px]" title="Frais exclus de la réclamation">
                                                        <input type="checkbox" checked={o.contreExpert} onChange={(e) => updateOcc(o.id, 'contreExpert', e.target.checked)} className="w-3 h-3 rounded bg-slate-700" />
                                                        <span>Expert-client ?</span>
                                                    </label>
                                                </div>
                                                {(o.hasContact || o.contreExpert) && (
                                                    <div className="col-span-2 flex flex-wrap gap-2 mt-1">
                                                        {o.hasContact && <>
                                                            <div className="flex-1 min-w-[100px]"><label className="text-cyan-300 text-[10px]">Nom contact</label><input type="text" value={o.contactNom || ''} onChange={(e) => updateOcc(o.id, 'contactNom', e.target.value)} placeholder="Nom..." className="input-field mb-0 py-0.5 text-[10px] bg-slate-800 border-cyan-400/50 text-cyan-100" /></div>
                                                            <div className="flex-1 min-w-[100px]"><label className="text-cyan-300 text-[10px]">Tél contact</label><input type="text" value={o.contactTel || ''} onChange={(e) => updateOcc(o.id, 'contactTel', e.target.value)} placeholder="04XX..." className="input-field mb-0 py-0.5 text-[10px] bg-slate-800 border-cyan-400/50 text-cyan-100" /></div>
                                                        </>}
                                                        {o.contreExpert && <div className="flex-1 min-w-[100px]"><label className="text-orange-300 text-[10px]">Nom expert-client</label><input type="text" value={o.nomContreExpert || ''} onChange={(e) => updateOcc(o.id, 'nomContreExpert', e.target.value)} placeholder="Galtier..." className="input-field mb-0 py-0.5 text-[10px] bg-slate-800 border-orange-400/50 text-orange-100" /></div>}
                                                    </div>
                                                )}
                                                {o.showDetails && (
                                                    <div className="col-span-2 border-t border-slate-700 mt-2 pt-2">
                                                        <div className="mb-2 w-1/2 pr-1"><label>E-mail</label><input type="email" value={o.email} onChange={e=>updateOcc(o.id, 'email', e.target.value)} className="input-field mb-0" /></div>
                                                        <div className="mb-2 w-1/2 pr-1"><label>IBAN (Comptabilité)</label><input type="text" value={o.iban || ''} onChange={e=>updateOcc(o.id, 'iban', e.target.value)} placeholder="BE..." className="input-field mb-0 border-indigo-500" /></div>
                                                        <label className="text-indigo-300 font-bold mb-2">RC Familiale</label>
                                                        <div className="grid grid-cols-2 gap-2 mb-2"><div><label>Assuré ?</label><select value={o.rc} onChange={e=>updateOcc(o.id, 'rc', e.target.value)} className="input-field mb-0"><option>Non</option><option>Oui</option></select></div>{o.rc === 'Oui' && <div><label>N° Police RC</label><input type="text" value={o.rcPolice} onChange={e=>updateOcc(o.id, 'rcPolice', e.target.value)} className="input-field mb-0 border-indigo-500" /></div>}</div>
                                                        <label className="text-indigo-300 font-bold mb-2">Seconde Assurance</label>
                                                        <div className="grid grid-cols-2 gap-2"><div><label>Autre assurance ?</label><select value={o.secAssurance} onChange={e=>updateOcc(o.id, 'secAssurance', e.target.value)} className="input-field mb-0"><option>Non</option><option>Oui</option></select></div>{o.secAssurance === 'Oui' && <div><label>Type</label><input type="text" value={o.secType} onChange={e=>updateOcc(o.id, 'secType', e.target.value)} className="input-field mb-0 border-indigo-500" /></div>}{o.secAssurance === 'Oui' && <div><label>Compagnie (2e ass.)</label><input type="text" value={o.secCie} onChange={e=>updateOcc(o.id, 'secCie', e.target.value)} className="input-field mb-0 border-indigo-500" /></div>}{o.secAssurance === 'Oui' && <div><label>N° Police (2e ass.)</label><input type="text" value={o.secPolice} onChange={e=>updateOcc(o.id, 'secPolice', e.target.value)} className="input-field mb-0 border-indigo-500" /></div>}</div>
                                                    </div>
                                                )}
                                                
                                                <button 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setExpandedOccId(null); 
                                                        setTimeout(() => document.getElementById('add-occ-btn')?.focus(), 50); 
                                                    }} 
                                                    className="col-span-2 mt-2 bg-slate-700 hover:bg-slate-600 text-white py-1.5 rounded text-[11px] font-bold border border-slate-600 transition-colors"
                                                >
                                                    ✓ Valider la partie
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )})}
                                <button id="add-occ-btn" onClick={addOcc} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 py-1.5 rounded text-xs font-bold shadow">+ Ajouter une partie impliquée</button>

                                {/* v5.6.2 - Liste des Intervenants validés */}
                                {intervenantsList && intervenantsList.length > 0 && (
                                    <div className="mt-3 border-t border-slate-700 pt-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-bold text-amber-300">🤝 Autres Intervenants ({intervenantsList.length})</label>
                                        </div>
                                        <div className="space-y-1">
                                            {intervenantsList.map(inter => (
                                                <div key={inter.id} className="flex items-center gap-2 p-2 bg-amber-900/10 border border-amber-500/20 rounded">
                                                    <div className="flex-1 min-w-0">
                                                        <span className="text-xs font-bold text-white">{inter.nom} {inter.prenom}</span>
                                                        {inter.role && <span className="text-[10px] text-amber-400 ml-1">({inter.role})</span>}
                                                        {inter.societe && <span className="text-[10px] text-slate-400 ml-1">— {inter.societe}</span>}
                                                    </div>
                                                    <div className="flex gap-2 shrink-0 text-[10px] text-slate-400">
                                                        {inter.tel && <span>📞 {inter.tel}</span>}
                                                        {inter.email && <span>✉️ {inter.email}</span>}
                                                    </div>
                                                    <button onClick={() => setIntervenantsList(prev => prev.filter(i => i.id !== inter.id))} className="text-red-400 hover:text-red-300 text-xs shrink-0" title="Supprimer">✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </details>

                        <details className="bg-slate-800/50 rounded border border-slate-700 mb-2 group">
                            <AccordionHeader id="frais" num="6" />
                            <div
                                className="p-3 space-y-2 relative"
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation(); // Prevenir conflits
                                    const key = aiConfig.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
                                    if (isAiModeActive && key) {
                                        setIsDraggingOverFrais(true);
                                    }
                                }}
                                onDragLeave={(e) => {
                                    // Make sure we only leave if relatedTarget is not inside this div
                                    if (!e.currentTarget.contains(e.relatedTarget)) {
                                        setIsDraggingOverFrais(false);
                                    }
                                }}
                                onDrop={async (e) => {
                                    e.preventDefault();
                                    setIsDraggingOverFrais(false);
                                    const key = aiConfig.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
                                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                        await handleMagicDrop(Array.from(e.dataTransfer.files));
                                    }
                                }}
                            >
                                {isDraggingOverFrais && (
                                    <div
                                        className="absolute inset-0 bg-indigo-900/40 backdrop-blur-[2px] border-2 border-indigo-400 border-dashed rounded z-50 flex items-center justify-center"
                                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        onDrop={async (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setIsDraggingOverFrais(false);
                                            const key = aiConfig.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
                                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                                await handleMagicDrop(Array.from(e.dataTransfer.files));
                                            }
                                        }}
                                    >
                                        <span className="text-white font-bold text-sm pointer-events-none">🪄 Relâchez pour analyser la facture</span>
                                    </div>
                                )}

                                <div className="flex items-center justify-between mb-3 bg-slate-800 p-2 rounded border border-slate-700">
                                    <label className="flex items-center space-x-2 cursor-pointer text-white text-[11px] font-bold"><input type="checkbox" checked={showSubtotals} onChange={(e) => setShowSubtotals(e.target.checked)} className="w-4 h-4 rounded border-slate-600 bg-slate-700" /><span>Mode avancé</span></label>
                                    <button onClick={reorganizeExpenses} className="bg-slate-600 hover:bg-slate-500 px-3 py-1 rounded text-[10px] text-white">🔄 Réorganiser</button>
                                </div>
                                {expenses.map((exp, index) => {
                                    const isExp = expandedExpId === exp.id;
                                    return (
                                    <div key={exp.id} draggable={!isExp} onDragStart={(e) => { if(isExp) { e.preventDefault(); return; } draggedExpRef.current = index; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/html', 'x'); }} onDragEnter={(e) => e.preventDefault()} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={(e) => { e.preventDefault(); const src = draggedExpRef.current; if (src === null || src === index) return; const newExps = [...expenses]; const item = newExps.splice(src, 1)[0]; newExps.splice(index, 0, item); setExpenses(newExps); draggedExpRef.current = null; }} onDragEnd={() => { draggedExpRef.current = null; }} className={`p-2 bg-slate-900 border ${isExp ? 'border-indigo-500' : 'border-slate-600'} rounded relative mb-1 ${!isExp ? 'cursor-move' : ''}`} >
                                        <button onClick={(e) => { e.stopPropagation(); removeExpense(exp.id); }} className="absolute top-1 right-2 text-red-400 text-xs z-10">✕</button>
                                        {isExp && <button onClick={(e) => { e.stopPropagation(); setExpandedExpId(null); }} className="absolute top-1 right-8 text-indigo-300 text-[10px] z-10 hover:text-white">▲ Réduire</button>}
                                        {!isExp ? (
                                            <div className="text-xs text-slate-300 pr-6 flex items-center gap-2" onClick={() => setExpandedExpId(exp.id)}>
                                                <span className="text-slate-500 cursor-grab">⠿</span>
                                                <span className="flex-1 truncate"><span className="font-bold text-white">{exp.montant ? `${exp.montant} €` : '0,00 €'}</span> - {exp.prestataire || 'Nouveau frais'} {exp.compteDe ? `(${(()=>{ const o = occupants.find(occ=>occ.id===exp.compteDe); if(o) { const fn = `${o.nom||''} ${o.prenom||''}`.trim(); return o.etage && o.etage.trim() !== '' ? `${o.etage} - ${fn}` : fn; } return exp.compteDe; })()})` : ''}</span>
                                                {(attachedFiles[exp.id] || []).length > 0 && (
                                                    <div className="flex items-center">
                                                        <span className="bg-indigo-600/30 text-indigo-300 text-[9px] px-1.5 py-0.5 rounded ml-1">📎 {(attachedFiles[exp.id] || []).reduce((acc, f) => acc + (f.pages || 0), 0)}p</span>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const firstFile = attachedFiles[exp.id][0];
                                                                if (firstFile) {
                                                                    context.handleOpenFile(firstFile.dbKey, true);
                                                                }
                                                            }}
                                                            className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors ml-1 flex items-center justify-center"
                                                            title="Voir le document"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="mt-1 grid grid-cols-2 gap-2">
                                                <div><label>Montant (€)</label><input type="text" autoFocus value={exp.montant} onChange={e=>updateExpense(exp.id, 'montant', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExpense(); } }} placeholder="350.00" className="input-field mb-0 font-bold" /></div>
                                                <div><label>Type Montant</label><select value={exp.typeMontant || 'HTVA'} onChange={e=>updateExpense(exp.id, 'typeMontant', e.target.value)} className="input-field mb-0"><option>HTVA</option><option>Forfait</option><option>TVAC</option></select></div>
                                                <div className="col-span-2"><label>Description courte</label><input type="text" value={exp.desc} onChange={e=>updateExpense(exp.id, 'desc', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExpense(); } }} className="input-field mb-0" /></div>
                                                <div className="col-span-2">
                                                    <label>Pour le compte de</label>
                                                    <select value={exp.compteDe || ''} onChange={e => {
                                                        if (e.target.value === 'CREATE_NEW') {
                                                            const newId = addOcc();
                                                            updateExpense(exp.id, 'compteDe', newId);
                                                        } else {
                                                            updateExpense(exp.id, 'compteDe', e.target.value);
                                                        }
                                                    }} className="input-field mb-0 border-indigo-500">
                                                        <option value="">Choisissez...</option>
                                                        {occupants.filter(o => o.nom).map(o => {
                                                            const fullName = `${o.nom || ''} ${o.prenom || ''}`.trim();
                                                            const displayName = o.etage && o.etage.trim() !== '' ? `${o.etage} - ${fullName}` : fullName;
                                                            return <option key={o.id} value={o.id}>{displayName}</option>;
                                                        })}
                                                        <option disabled>──────────</option>
                                                        <option value="CREATE_NEW">[ + Créer une nouvelle partie ]</option>
                                                    </select>
                                                </div>
                                                {exp.typeMontant !== 'Forfait' && <>
                                                    {/* Si un seul document ou aucun, on remet l'affichage classique sans toggle encombrant */}
                                                    {(!attachedFiles[exp.id] || attachedFiles[exp.id].length <= 1) ? (
                                                        <>
                                                            <div>
                                                                <label className="text-[9px] text-slate-500 uppercase">Type</label>
                                                                <select 
                                                                    value={exp.type || 'Devis'} 
                                                                    onChange={e => updateExpense(exp.id, 'type', e.target.value)} 
                                                                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                                                                >
                                                                    <option value="Devis">Devis</option>
                                                                    <option value="Facture">Facture</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="text-[9px] text-slate-500 uppercase">Référence</label>
                                                                <input 
                                                                    type="text" 
                                                                    value={exp.ref || ''} 
                                                                    onChange={e => updateExpense(exp.id, 'ref', e.target.value)} 
                                                                    placeholder="Réf..." 
                                                                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" 
                                                                />
                                                            </div>
                                                        </>
                                                    ) : (
                                                        /* Si et seulement si on a injecté un deuxième document, l'interface Dual-State s'active */
                                                        <div className="col-span-2 bg-slate-800/80 p-2.5 rounded-lg border border-slate-700 flex flex-col gap-2 mt-1 animate-fadeIn">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex flex-col">
                                                                    <label className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Mode Multi-Documents Détecté</label>
                                                                    <span className="text-[9px] text-slate-400">Sélectionnez le document actif à envoyer au PVE</span>
                                                                </div>
                                                                <div className="flex bg-slate-900 rounded-md border border-slate-600 overflow-hidden shadow-inner">
                                                                    <button 
                                                                        type="button"
                                                                        onClick={(e) => { e.preventDefault(); toggleExpenseType(exp.id, 'Devis'); }}
                                                                        className={`px-4 py-1 text-[10px] font-bold transition-all ${exp.type !== 'Facture' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}
                                                                    >
                                                                        Devis Actif
                                                                    </button>
                                                                    <button 
                                                                        type="button"
                                                                        onClick={(e) => { e.preventDefault(); toggleExpenseType(exp.id, 'Facture'); }}
                                                                        className={`px-4 py-1 text-[10px] font-bold transition-all ${exp.type === 'Facture' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-300'}`}
                                                                    >
                                                                        Facture Active
                                                                    </button>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="grid grid-cols-2 gap-3 mt-1">
                                                                <div>
                                                                    <label className="text-[9px] text-slate-500 uppercase">{exp.type === 'Facture' ? 'Réf. Facture' : 'Réf. Devis'}</label>
                                                                    <input type="text" value={exp.ref || ''} onChange={e=>updateExpense(exp.id, 'ref', e.target.value)} placeholder="Référence..." className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none" />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[9px] text-slate-500 uppercase">{exp.type === 'Facture' ? 'Montant Devis (Historique)' : 'Montant Facture (Attente)'}</label>
                                                                    <input 
                                                                        type="text" 
                                                                        value={exp.type === 'Facture' ? (exp.montantDevis || '') : (exp.montantFacture || '')} 
                                                                        disabled 
                                                                        className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-xs text-slate-500 outline-none cursor-not-allowed" 
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="col-span-2"><label>Prestataire</label><input type="text" value={exp.prestataire} onChange={e=>updateExpense(exp.id, 'prestataire', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExpense(); } }} list="prestataires-list" className="input-field mb-0" /></div>
                                                </>}
                                                
                                                <div className="col-span-2 border-t border-slate-700 mt-2 pt-2">
                                                    {showSubtotals && (
                                                        <div className="grid grid-cols-[120px_auto] gap-2 items-start mb-2">
                                                            <div><label className="text-orange-300">Couverture</label><select value={exp.avisCouverture || 'Oui'} onChange={e=>updateExpense(exp.id, 'avisCouverture', e.target.value)} className="input-field mb-0 bg-slate-800 border-orange-400/50 text-orange-200"><option value="Oui">Oui</option><option value="Non">Non</option><option value="Autre">Autre</option></select></div>
                                                            {exp.avisCouverture !== 'Oui' && <div><label className="text-orange-300">Raison / Observation</label><input type="text" value={exp.noteCouverture || ''} onChange={e=>updateExpense(exp.id, 'noteCouverture', e.target.value)} placeholder={exp.avisCouverture === 'Non' ? "pourquoi ?" : "Ex: Vétusté..."} className="input-field mb-0 border-orange-400/50 bg-slate-800 text-orange-100" /></div>}
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between items-center border-t border-slate-700 pt-2">
                                                        <label className="text-indigo-300 font-bold block">📄 Justificatif (PDF)</label>
                                                        <DropZone onFiles={(files) => handleMagicDrop(files, exp.id)} accept=".pdf" />
                                                    </div>
                                                    {(attachedFiles[exp.id] || []).length > 0 && (
                                                        <div className="mt-2 space-y-1">
                                                            {(attachedFiles[exp.id] || []).map(f => (
                                                                <div key={f.dbKey} className="flex justify-between items-center bg-slate-800 p-1.5 rounded border border-slate-600">
                                                                    <div className="text-[10px] truncate max-w-[150px]" title={f.name}>
                                                                        <span className="font-bold text-white block truncate">{f.name}</span>
                                                                        <span className="text-slate-400">{f.pages} page(s)</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <button onClick={(e) => { e.preventDefault(); context.handleOpenFile(f.dbKey, true); }} className="text-[14px] text-blue-400 hover:text-blue-300" title="Ouvrir le fichier">👁️</button>
                                                                        <button onClick={() => handleRemoveFile(exp.id, f.dbKey)} className="text-[10px] text-red-400 hover:underline">✕</button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                <button 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        setExpandedExpId(null); 
                                                        setTimeout(() => document.getElementById('add-exp-btn')?.focus(), 50); 
                                                    }} 
                                                    className="col-span-2 mt-2 bg-slate-700 hover:bg-slate-600 text-white py-1.5 rounded text-[11px] font-bold border border-slate-600 transition-colors"
                                                >
                                                    ✓ Valider le frais
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )})}
                                <button id="add-exp-btn" onClick={() => { const newId = addExpense(); setExpandedExpId(newId); }} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 py-1.5 rounded text-xs font-bold shadow">+ Ajouter une ligne de frais</button>
                                <datalist id="prestataires-list">
                                    {[...new Set(expenses.reduce((acc, e) => { if (e.prestataire) acc.push(e.prestataire); return acc; }, []))]
                                        .sort((a, b) => a.localeCompare(b))
                                        .map(p => <option key={p} value={p} />)}
                                </datalist>
                            </div>
                        </details>

                        <details className="bg-slate-800/50 rounded border border-slate-700 mb-2 group">
                            <AccordionHeader id="photos" num="7" />
                            <div className="p-3 space-y-4">
                                {/* Bulk Selection UI */}
                                {selectedPhotos.length > 0 && (
                                    <div className="sticky top-0 z-10 bg-indigo-900/90 border border-indigo-500 p-2 rounded mb-2 flex items-center justify-between shadow-lg backdrop-blur">
                                        <span className="text-xs text-white font-bold">{selectedPhotos.length} photo(s) sélect.</span>
                                        <div className="flex gap-2">
                                            <select
                                                className="bg-slate-800 text-[10px] text-white border border-slate-600 rounded px-1 py-1"
                                                value=""
                                                onChange={(e) => handleMoveSelectedPhotos(e.target.value)}
                                                disabled={isMovingPhotos}
                                            >
                                                <option value="">Déplacer vers...</option>
                                                {(occupants || []).map(occ => <option key={occ.id} value={occ.id}>{occ.nom || 'Inconnu'}</option>)}
                                            </select>
                                            <button onClick={() => setSelectedPhotos([])} className="text-[10px] text-slate-300 hover:text-white bg-slate-700 px-2 rounded">✕</button>
                                        </div>
                                    </div>
                                )}
                                {occupants.length === 0 ? (
                                    <p className="text-[10px] text-slate-400 italic">Ajoutez d'abord des intervenants dans la section "Organisation du bâtiment".</p>
                                ) : (
                                    occupants.map(occ => (
                                        <div key={occ.id} className="bg-slate-900 border border-slate-700 p-3 rounded">
                                            <div className="flex justify-between items-center mb-2">
                                                <h4 className="text-white text-xs font-bold">{occ.nom || 'Inconnu'}</h4>
                                                <DropZone
                                                    onFiles={(files) => {
                                                        Array.from(files).forEach(file => {
                                                            handleAttachPhoto(occ.id, file);
                                                        });
                                                    }}
                                                    label="📸"
                                                    accept="image/*,application/pdf"
                                                />
                                            </div>
                                            {(attachedPhotos[occ.id] || []).length > 0 ? (
                                                <div className="grid grid-cols-2 gap-2 mt-2">
                                                    {attachedPhotos[occ.id].map(photo => (
                                                        <div key={photo.dbKey} className={`relative group rounded overflow-hidden border ${selectedPhotos.includes(photo.dbKey) ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-slate-600'} aspect-video bg-slate-800 flex items-center justify-center`}>
                                                            <div className={`absolute top-1 left-1 z-10 ${selectedPhotos.includes(photo.dbKey) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                                                <input type="checkbox" checked={selectedPhotos.includes(photo.dbKey)} onChange={() => handleTogglePhotoSelect(photo.dbKey)} className="w-4 h-4 cursor-pointer accent-indigo-500" />
                                                            </div>
                                                            {photo.isPdf ? (
                                                                <div className="flex flex-col items-center justify-center text-center p-2">
                                                                    <span className="text-2xl">📄</span>
                                                                    <span className="text-[9px] text-slate-300 truncate max-w-full mt-1">{photo.name}</span>
                                                                    <span className="text-[8px] text-slate-500">{photo.pages}p</span>
                                                                </div>
                                                            ) : (
                                                                <img src={photo.dataUrl} alt={photo.name} className="max-w-full max-h-full object-contain" />
                                                            )}
                                                            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button onClick={(e) => { e.preventDefault(); context.handleOpenFile(photo.dbKey, photo.isPdf); }} className="bg-blue-500 hover:bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]" title="Ouvrir">👁️</button>
                                                                <button onClick={() => handleRemovePhoto(occ.id, photo.dbKey)} className="bg-red-500 hover:bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]" title="Supprimer">✕</button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-slate-500 italic mt-1">Aucun fichier attaché.</p>
                                            )}
                                        </div>
                                    ))
                                )}

                                {/* v5.5.10 - Photos en attente d'attribution */}
                                {(attachedPhotos['unassigned'] || []).length > 0 && (
                                    <div className="bg-amber-900/20 border border-amber-500/30 p-3 rounded mt-2">
                                        <h4 className="text-amber-300 text-xs font-bold mb-2 flex items-center gap-1">📸 Photos en attente d'attribution <span className="text-[9px] font-normal text-amber-400/60">({attachedPhotos['unassigned'].length})</span></h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            {attachedPhotos['unassigned'].map(photo => (
                                                <div key={photo.dbKey} className={`relative group rounded overflow-hidden border ${selectedPhotos.includes(photo.dbKey) ? 'border-indigo-500 ring-2 ring-indigo-500' : 'border-amber-500/30'} aspect-video bg-slate-800 flex items-center justify-center`}>
                                                    <div className={`absolute top-1 left-1 z-10 ${selectedPhotos.includes(photo.dbKey) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                                        <input type="checkbox" checked={selectedPhotos.includes(photo.dbKey)} onChange={() => handleTogglePhotoSelect(photo.dbKey)} className="w-4 h-4 cursor-pointer accent-indigo-500" />
                                                    </div>
                                                    {photo.isPdf ? (
                                                        <div className="flex flex-col items-center justify-center text-center p-2">
                                                            <span className="text-2xl">📄</span>
                                                            <span className="text-[9px] text-slate-300 truncate max-w-full mt-1">{photo.name}</span>
                                                        </div>
                                                    ) : (
                                                        <img src={photo.dataUrl} alt={photo.name} className="max-w-full max-h-full object-contain" />
                                                    )}
                                                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => handleConvertPhotoToDevis(photo.dbKey)} 
                                                            className="bg-indigo-600 hover:bg-indigo-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]" 
                                                            title="Transformer en Devis/Facture (IA)"
                                                            disabled={processingPhotoId === photo.dbKey}
                                                        >
                                                            {processingPhotoId === photo.dbKey ? '↻' : '🪄'}
                                                        </button>
                                                        <button onClick={() => handleRemovePhoto('unassigned', photo.dbKey)} className="bg-red-500 hover:bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]" title="Supprimer">✕</button>
                                                    </div>
                                                    {occupants.length > 0 && (
                                                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1">
                                                            <select 
                                                                className="w-full bg-slate-800 text-[9px] text-white border border-slate-600 rounded px-1 py-0.5"
                                                                defaultValue=""
                                                                onChange={async (e) => {
                                                                    const targetOccId = e.target.value;
                                                                    if (!targetOccId) return;
                                                                    // Récupérer le fichier depuis localforage et recréer un File object
                                                                    const bytes = await localforage.getItem(photo.dbKey);
                                                                    if (bytes) {
                                                                        const mime = photo.isPdf ? 'application/pdf' : 'image/jpeg';
                                                                        const file = new File([bytes], photo.name, { type: mime });
                                                                        await handleAttachPhoto(targetOccId, file);
                                                                        handleRemovePhoto('unassigned', photo.dbKey);
                                                                    }
                                                                }}
                                                            >
                                                                <option value="">→ Attribuer à...</option>
                                                                {occupants.map(occ => (
                                                                    <option key={occ.id} value={occ.id}>{occ.nom || 'Inconnu'}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </details>

                        <details className="bg-slate-800/50 rounded border border-slate-700 mb-2 group">
                            <AccordionHeader id="divers" num="8" />
                            <div className="p-3"><textarea name="divers" value={formData.divers} onChange={handleChange} rows="3" className="input-field resize-none m-0"></textarea></div>
                        </details>

                        <details className="bg-slate-800/50 rounded border border-slate-700 mb-2 group">
                            <AccordionHeader id="annexes_libres" num="9" />
                            <div
                                className="p-3 space-y-3 relative"
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const key = aiConfig.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
                                    if (isAiModeActive && key) {
                                        setIsDraggingOverAnnexes(true);
                                    }
                                }}
                                onDragLeave={(e) => {
                                    if (!e.currentTarget.contains(e.relatedTarget)) {
                                        setIsDraggingOverAnnexes(false);
                                    }
                                }}
                                onDrop={async (e) => {
                                    e.preventDefault();
                                    setIsDraggingOverAnnexes(false);
                                    const key = aiConfig.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
                                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                        await handleAnnexMagicDrop(Array.from(e.dataTransfer.files));
                                    }
                                }}
                            >
                                {(isDraggingOverAnnexes || isAnnexAiLoading) && (
                                    <div
                                        className="absolute inset-0 bg-indigo-900/40 backdrop-blur-[2px] border-2 border-indigo-400 border-dashed rounded z-50 flex items-center justify-center"
                                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        onDrop={async (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setIsDraggingOverAnnexes(false);
                                            const key = aiConfig.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
                                            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                                await handleAnnexMagicDrop(Array.from(e.dataTransfer.files));
                                            }
                                        }}
                                    >
                                        <span className="text-white font-bold text-sm text-center px-4 pointer-events-none">
                                            {isAnnexAiLoading ? "⏳ Analyse en cours..." : "🪄 Relâchez pour générer le titre de l'annexe"}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center bg-slate-900/50 p-2 rounded border border-slate-700 mb-2">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">📂 Glisser vos fichiers ici</span>
                                    <DropZone onFiles={(files) => handleAnnexMagicDrop(files)} label="➕" />
                                </div>
                                <div className="space-y-2">
                                    {dynamicFreeAnnexes.map(file => (
                                        <div key={file.id} className={`bg-slate-900 border ${file.isVirtual ? 'border-indigo-500 border-dashed' : 'border-slate-700'} p-2 rounded relative group`}>
                                            <div className="absolute top-1 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={(e) => { e.preventDefault(); context.handleOpenFile(file.dbKey, file.isPdf); }} className="text-blue-400 hover:text-blue-300 text-xs" title="Ouvrir">👁️</button>
                                                {!file.isVirtual && <button onClick={() => handleRemoveFreeAnnex(file.id, file.dbKey)} className="text-red-500 text-xs" title="Supprimer">✕</button>}
                                            </div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-lg">{file.isPdf ? '📄' : '🖼️'}</span>
                                                <input type="text" value={file.customName} onChange={(e) => !file.isVirtual && handleUpdateFreeAnnex(file.id, 'customName', e.target.value)} disabled={file.isVirtual} className="bg-transparent border-b border-slate-700 text-xs text-white focus:border-indigo-500 outline-none flex-1 disabled:opacity-70" placeholder="Nom du fichier..." />
                                            </div>
                                            <textarea value={file.desc} onChange={(e) => !file.isVirtual && handleUpdateFreeAnnex(file.id, 'desc', e.target.value)} disabled={file.isVirtual} className="w-full bg-slate-800 text-[10px] text-slate-300 p-1 rounded border border-slate-700 mt-1 resize-none h-10 disabled:opacity-70" placeholder="Description courte (facultatif)..." />
                                        </div>
                                    ))}
                                    {dynamicFreeAnnexes.length === 0 && <p className="text-[10px] text-slate-500 italic text-center">Aucune annexe libre.</p>}
                                </div>
                            </div>
                        </details>
                        
                        <div className="bg-slate-900 border border-slate-600 rounded p-3 mt-4">
                            <h3 className="text-xs font-bold text-white mb-2 uppercase">🧱 Gestion des blocs affichés</h3>
                            <div className="flex flex-wrap gap-2 mb-3 text-[10px]">
                                {['titre', 'coord', 'infos', 'cause', 'orga', 'frais', 'frais_liste', 'photos', 'divers', 'annexes_libres'].map(key => (
                                    <label key={key} className={`px-2 py-1 rounded cursor-pointer border ${blocksVisible[key] === false ? 'bg-slate-800 border-slate-600 text-slate-400' : 'bg-indigo-600 border-indigo-500 text-white'}`}><input type="checkbox" className="hidden" checked={blocksVisible[key] !== false} onChange={() => setBlocksVisible(p => ({...p, [key]: !p[key]}))} />{key === 'frais_liste' ? 'LISTE' : key.toUpperCase()}</label>
                                ))}
                            </div>
                            <button onClick={() => { 
                                const newId = `custom_${crypto.randomUUID()}`;
                                setCustomBlocks([...customBlocks, { id: newId, text: 'Nouveau texte libre...' }]); 
                                setStyles(prev => ({ ...prev, [newId]: { border: true, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' }})); 
                                setBlocksVisible(prev => ({ ...prev, [newId]: true })); 
                                setBlockOrder(prev => [...prev, newId]);
                                setBlockWidths(prev => ({ ...prev, [newId]: '100%' })); 
                            }} className="w-full bg-slate-700 hover:bg-slate-600 border border-slate-500 py-1.5 rounded text-xs font-bold">+ Ajouter un bloc "Texte libre"</button>
                            <button onClick={() => {
                                const newId = 'spacer_' + crypto.randomUUID();
                                setStyles(prev => ({ ...prev, [newId]: { spacerHeight: 20 } }));
                                setBlocksVisible(prev => ({ ...prev, [newId]: true }));
                                setBlockOrder(prev => [...prev, newId]);
                                setBlockWidths(prev => ({ ...prev, [newId]: '100%' }));
                            }} className="w-full bg-slate-700/60 hover:bg-slate-600 border border-slate-500/60 border-dashed py-1.5 rounded text-xs font-bold text-slate-300">↕ Ajouter un espaceur</button>
                        </div>
                    </div>
                )}
            </div>
            {showAnnexModal && <AnnexModal mode={annexModalMode} onClose={() => setShowAnnexModal(false)} />}
            
            <div className="p-4 border-t border-slate-700 bg-slate-900 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[10px] text-slate-400 bg-slate-800 p-2 rounded border border-slate-700">
                    <span>Nb pages rapport principal :</span>
                    <input type="number" min="1" value={coverPageCount} onChange={(e) => setCoverPageCount(parseInt(e.target.value) || 1)} className="w-12 bg-slate-900 border border-slate-600 rounded px-1 text-center text-white font-bold" />
                </div>
                <label className="flex items-center gap-2 text-[10px] text-slate-400 cursor-pointer select-none">
                    <input type="checkbox" checked={hideAnnexIndex} onChange={e => setHideAnnexIndex(e.target.checked)} className="w-3 h-3 rounded bg-slate-700" />
                    <span>Cacher l'index des annexes</span>
                </label>
                <div className="relative">
                    <button
                        onClick={() => setShowPrintMenu(p => !p)}
                        disabled={isMerging}
                        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-2.5 rounded font-bold text-white transition-colors text-sm shadow-lg flex items-center justify-center gap-2"
                    >
                        {isMerging ? '⏳ Génération...' : '🖨️ Imprimer'} <span className="text-xs">▾</span>
                    </button>
                    <button
                        onClick={handleCopyResume}
                        className="w-full mt-2 bg-slate-700 hover:bg-slate-600 py-2.5 rounded font-bold text-white transition-colors text-sm shadow-lg flex items-center justify-center gap-2"
                    >
                        📋 Copier le résumé brut
                    </button>
                    <div className="flex justify-between items-center mt-2 px-1 border-t border-slate-700/50 pt-2">
                        <a 
                            href="mailto:maquetantoine@gmail.com?subject=%5BExpertise%20App%5D%20Signalement%20de%20bug%20%2F%20Suggestion" 
                            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                        >
                            🪲 Bug / Suggestion
                        </a>

                        <span className="text-[10px] text-slate-600 font-mono font-bold select-none cursor-default" title="Version actuelle">v{packageInfo.version}</span>
                    </div>
                    {showPrintMenu && !isMerging && (
                        <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl z-50 overflow-hidden">
                            <button onClick={() => { setShowPrintMenu(false); generatePDF(); }} className="w-full text-left px-4 py-2.5 text-xs text-white hover:bg-slate-700 border-b border-slate-700 flex items-center gap-2">
                                <span>🖨️</span><span><strong>Page de garde</strong><br/><span className="text-slate-400">Impression navigateur (mise en page HTML)</span></span>
                            </button>
                            <button onClick={() => { setShowPrintMenu(false); downloadDossierPDF(null); }} className="w-full text-left px-4 py-2.5 text-xs text-white hover:bg-slate-700 border-b border-slate-700 flex items-center gap-2">
                                <span>📄</span><span><strong>Tout le dossier</strong><br/><span className="text-slate-400">Page de garde + toutes les annexes (1 PDF)</span></span>
                            </button>
                            <button onClick={() => { setShowPrintMenu(false); setAnnexModalMode('page+annexes'); setShowAnnexModal(true); }} className="w-full text-left px-4 py-2.5 text-xs text-white hover:bg-slate-700 border-b border-slate-700 flex items-center gap-2">
                                <span>📦</span><span><strong>Page de garde + annexes au choix</strong><br/><span className="text-slate-400">Sélection, index dynamiques, 1 PDF</span></span>
                            </button>
                            <button onClick={() => { setShowPrintMenu(false); setAnnexModalMode('annexes-only'); setShowAnnexModal(true); }} className="w-full text-left px-4 py-2.5 text-xs text-white hover:bg-slate-700 flex items-center gap-2">
                                <span>📋</span><span><strong>Annexes seules</strong><br/><span className="text-slate-400">Sans page de garde</span></span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

        </div>
        <div className={`w-1.5 bg-slate-400 hover:bg-indigo-500 ${isResizing ? 'active' : ''}`} onMouseDown={startResizing} style={{cursor: 'col-resize'}}></div>
        <UniversalIngestionModal />

        {/* Mini-dialog : Créer un dossier via IA (apparaît après drop ou clic) */}
        {showAiDossierPrompt && (
            <div className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => { setShowAiDossierPrompt(false); setDroppedMsgFile(null); setAiDossierRef(''); }}>
                <div className="bg-slate-900 rounded-xl border border-indigo-500/40 shadow-2xl p-6 w-full max-w-[400px]" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                        <span className="text-lg">{droppedMsgFile ? '📧' : '🪄'}</span> {droppedMsgFile ? 'E-mail détecté !' : 'Nouveau dossier via IA'}
                    </h3>
                    <p className="text-[10px] text-slate-400 mb-3 leading-tight">
                        {droppedMsgFile
                            ? <>Fichier : <span className="text-indigo-300 font-bold">{droppedMsgFile.name}</span><br/>Saisissez la référence pour créer le dossier et lancer l'extraction automatique.</>
                            : 'Saisissez la référence. Le dossier sera créé et l\'assistant IA s\'ouvrira pour y déposer vos documents.'
                        }
                    </p>
                    {/* Drop zone if no file yet */}
                    {!droppedMsgFile && (
                        <div
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                            onDrop={(e) => {
                                e.preventDefault(); e.stopPropagation();
                                const files = Array.from(e.dataTransfer.files);
                                if (files.length > 0) setDroppedMsgFile(files[0]);
                            }}
                            className="mb-3 border-2 border-dashed border-slate-600 hover:border-indigo-400 rounded-lg p-3 text-center cursor-pointer transition-colors"
                        >
                            <p className="text-[10px] text-slate-400">📁 Glissez un fichier ici (optionnel)</p>
                        </div>
                    )}
                    <input
                        type="text"
                        value={aiDossierRef}
                        onChange={(e) => setAiDossierRef(e.target.value)}
                        onKeyDown={async (e) => {
                            if (e.key === 'Enter' && aiDossierRef.trim() && !isAiDossierLoading) {
                                // Lancer le workflow
                                if (typeof clearDebugLogs === 'function') clearDebugLogs();
                                setIsAiDossierLoading(true);
                                try {
                                    handleReset();
                                    const newId = crypto.randomUUID();
                                    const newDossier = { id: newId, name: aiDossierRef.trim(), date: new Date().toLocaleString('fr-FR'), data: {} };
                                    const updated = [newDossier, ...savedDossiers];
                                    setSavedDossiers(updated);
                                    localStorage.setItem('expertise_dossiers_v1', JSON.stringify(updated));
                                    setCurrentDossierId(newId);
                                    
                                    if (droppedMsgFile) {
                                        if (!isAiModeActive) {
                                            if (droppedMsgFile.name.toLowerCase().endsWith('.msg')) {
                                                const { files: extractedFiles } = await extractValidAttachmentsFromMsg(droppedMsgFile);
                                                if (extractedFiles.length > 0) {
                                                    setTimeout(() => {
                                                        setPendingAiData(prev => prev ? { ...prev, pendingFiles: extractedFiles } : { parsedData: {}, pendingFiles: extractedFiles });
                                                    }, 50);
                                                } else {
                                                    alert("Aucune pièce jointe valide (PDF/Image) trouvée dans cet email.");
                                                }
                                            }
                                        } else {
                                            // v5.5.15 - Chef d'Orchestre via SAS (corrigé : plus de processJsonData)
                                            const result = await processGlobalIngestion(
                                                [droppedMsgFile],
                                                aiConfig.apiKey,
                                                setAiStatus,
                                                aiConfig.model,
                                                { cause: formData?.cause },
                                                addDebugLog
                                            );
                                            
                                            if (result.success && result.data) {
                                                const aiData = result.data;

                                                // Sécuriser les UUIDs des occupants
                                                const safeOccupants = (aiData.occupants || []).map(o => ({
                                                    ...o,
                                                    id: o.id || crypto.randomUUID()
                                                }));

                                                // Sécuriser les UUIDs des expenses
                                                const safeExpenses = (aiData.expenses || []).map(e => ({
                                                    ...e,
                                                    id: e.id || crypto.randomUUID(),
                                                    compteDe: e.compteDe || 'unassigned'
                                                }));

                                                // Construire pendingFiles à partir des PJ extraites par le Chef d'Orchestre
                                                const allPendingFiles = result.extractedFiles || [];

                                                // Passer par le SAS de validation
                                                setPendingAiData({
                                                    formData: aiData.formData || null,
                                                    experts: aiData.experts || [],
                                                    occupants: safeOccupants,
                                                    intervenants: aiData.intervenants || [],
                                                    expenses: safeExpenses,
                                                    pendingFiles: allPendingFiles,
                                                    technicalFilesToAttach: result.data.technicalFilesToAttach || []
                                                });
                                            } else {
                                                alert("Erreur IA : " + (result.error || "Réponse invalide"));
                                            }
                                        }
                                    } else {
                                        setActiveTab('settings');
                                    }
                                } finally {
                                    setIsAiDossierLoading(false);
                                    setShowAiDossierPrompt(false);
                                    setAiDossierRef('');
                                    setDroppedMsgFile(null);
                                    setAiStatus('idle');
                                }
                            }
                        }}
                        placeholder="Ex: Sinistre Dupont - 2026/05"
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white focus:border-indigo-500 outline-none placeholder-slate-500 mb-4"
                        autoFocus
                        disabled={isAiDossierLoading}
                    />
                    {isAiDossierLoading && (
                        <div className="mb-3">
                            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full animate-pulse" style={{ width: '100%' }} />
                            </div>
                            <p className="text-[9px] text-indigo-300 text-center mt-1">🧠 Extraction IA en cours...</p>
                        </div>
                    )}
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => { setShowAiDossierPrompt(false); setAiDossierRef(''); setDroppedMsgFile(null); }}
                            disabled={isAiDossierLoading}
                            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded transition-colors disabled:opacity-50">
                            Annuler
                        </button>
                        <button onClick={async () => {
                            if (!aiDossierRef.trim() || isAiDossierLoading) return;
                            setIsAiDossierLoading(true);
                            try {
                                handleReset();
                                const newId = crypto.randomUUID();
                                const newDossier = { id: newId, name: aiDossierRef.trim(), date: new Date().toLocaleString('fr-FR'), data: {} };
                                const updated = [newDossier, ...savedDossiers];
                                setSavedDossiers(updated);
                                localStorage.setItem('expertise_dossiers_v1', JSON.stringify(updated));
                                setCurrentDossierId(newId);
                                
                                if (droppedMsgFile) {
                                    if (!isAiModeActive) {
                                        if (droppedMsgFile.name.toLowerCase().endsWith('.msg')) {
                                            const { files: extractedFiles } = await extractValidAttachmentsFromMsg(droppedMsgFile);
                                            if (extractedFiles.length > 0) {
                                                setTimeout(() => {
                                                    setPendingAiData(prev => prev ? { ...prev, pendingFiles: extractedFiles } : { parsedData: {}, pendingFiles: extractedFiles });
                                                }, 50);
                                            } else {
                                                alert("Aucune pièce jointe valide (PDF/Image) trouvée dans cet email.");
                                            }
                                        }
                                    } else {
                                        // v5.5.10 - Chef d'Orchestre : on passe UNIQUEMENT le .msg
                                        // processGlobalIngestion gère lui-même l'extraction des PJ
                                        const result = await processGlobalIngestion(
                                            [droppedMsgFile],
                                            aiConfig.apiKey,
                                            setAiStatus,
                                            aiConfig.model,
                                            { cause: formData?.cause },
                                            addDebugLog
                                        );
                                        
                                        if (result.success && result.data) {
                                            const aiData = result.data;

                                            // Sécuriser les UUIDs des occupants
                                            const safeOccupants = (aiData.occupants || []).map(o => ({
                                                ...o,
                                                id: o.id || crypto.randomUUID()
                                            }));

                                            // Sécuriser les UUIDs des expenses
                                            const safeExpenses = (aiData.expenses || []).map(e => ({
                                                ...e,
                                                id: e.id || crypto.randomUUID(),
                                                compteDe: e.compteDe || 'unassigned'
                                            }));

                                            // Construire pendingFiles à partir des PJ extraites par le Chef d'Orchestre
                                            const allPendingFiles = result.extractedFiles || [];

                                            // UN SEUL appel : passer par le SAS (pas de processJsonData)
                                            setPendingAiData({
                                                formData: aiData.formData || null,
                                                experts: aiData.experts || [],
                                                occupants: safeOccupants,
                                                intervenants: aiData.intervenants || [],
                                                expenses: safeExpenses,
                                                pendingFiles: allPendingFiles
                                            });
                                        } else {
                                            alert("Erreur IA : " + (result.error || "Réponse invalide"));
                                        }
                                    }
                                } else {
                                    setActiveTab('settings');
                                }
                            } finally {
                                setIsAiDossierLoading(false);
                                setShowAiDossierPrompt(false);
                                setAiDossierRef('');
                                setDroppedMsgFile(null);
                                setAiStatus('idle');
                            }
                        }}
                            disabled={!aiDossierRef.trim() || isAiDossierLoading}
                            className={`px-4 py-2 text-xs font-bold rounded transition-colors ${aiDossierRef.trim() && !isAiDossierLoading ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}`}>
                            {droppedMsgFile ? '🚀 Créer & Analyser' : '✨ Créer & Ouvrir l\'IA'}
                        </button>
                    </div>
                </div>
            </div>
        )}
        {/* v5.9.4 - Smart Bridge Progress Overlay (centré, barre réelle) */}
        {aiStatus !== 'idle' && (() => {
            const STAGES = [
                { key: 'routing',    label: 'Tri des documents',        icon: '🗂️',  pct: 15 },
                { key: 'extracting', label: 'Agents IA en parallèle',   icon: '🤖',  pct: 55 },
                { key: 'financial',  label: 'Analyse financière',       icon: '💰',  pct: 80 },
                { key: 'attaching',  label: 'Assemblage du dossier',    icon: '📋',  pct: 100 },
                { key: 'generating', label: 'Génération document',      icon: '📝',  pct: 100 },
            ];
            const currentStage = STAGES.find(s => s.key === aiStatus) || STAGES[0];
            const stageIndex = STAGES.findIndex(s => s.key === aiStatus);

            return (
                <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-indigo-500/50 rounded-2xl shadow-2xl shadow-indigo-500/10 p-8 w-[440px] flex flex-col gap-5">
                        {/* Titre */}
                        <div className="flex items-center gap-3">
                            <span className="animate-spin text-2xl">🔄</span>
                            <div>
                                <p className="text-white font-bold text-base">Analyse IA en cours…</p>
                                <p className="text-slate-400 text-xs mt-0.5">Ne fermez pas la fenêtre</p>
                            </div>
                        </div>

                        {/* Barre de progression réelle */}
                        <div>
                            <div className="flex justify-between items-center mb-1.5">
                                <span className="text-indigo-300 text-sm font-semibold">
                                    {currentStage.icon} {currentStage.label}
                                </span>
                                <span className="text-slate-400 text-xs">{currentStage.pct}%</span>
                            </div>
                            <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-700 ease-out"
                                    style={{ width: `${currentStage.pct}%` }}
                                />
                            </div>
                        </div>

                        {/* Étapes visuelles */}
                        <div className="flex justify-between">
                            {STAGES.map((stage, idx) => (
                                <div key={stage.key} className="flex flex-col items-center gap-1 text-center">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm border-2 transition-all ${
                                        idx < stageIndex  ? 'bg-indigo-600 border-indigo-500 text-white' :
                                        idx === stageIndex ? 'bg-indigo-500/30 border-indigo-400 text-indigo-300 animate-pulse' :
                                                             'bg-slate-800 border-slate-600 text-slate-500'
                                    }`}>
                                        {idx < stageIndex ? '✓' : stage.icon}
                                    </div>
                                    <span className={`text-[9px] leading-tight max-w-[60px] ${idx <= stageIndex ? 'text-indigo-300' : 'text-slate-600'}`}>
                                        {stage.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        })()}


        {/* v5.9.4 - Smart Bridge Modal */}
        <SmartBridgeModal 
            isOpen={isBridgeModalOpen}
            matchedDossier={bridgeMatchResult}
            savedDossiers={savedDossiers}
            onClose={() => {
                setIsBridgeModalOpen(false);
                setCurrentBridgeFile(null);
                setBridgeMatchResult(null);
            }}
            onOpenMatched={() => {
                if (bridgeMatchResult) {
                    loadDossier(bridgeMatchResult);
                }
                setIsBridgeModalOpen(false);
                // v5.9.4 - Fix SAS Trigger
                triggerSmartBridgeAnalysis(currentBridgeFile);
            }}
            onManualSelect={(dossier) => {
                if (dossier) {
                    loadDossier(dossier);
                }
                setIsBridgeModalOpen(false);
                triggerSmartBridgeAnalysis(currentBridgeFile);
            }}
            onCreateNew={() => {
                setIsBridgeModalOpen(false);
                handleNewDossier();
                // v5.9.4 - Fix SAS Trigger
                triggerSmartBridgeAnalysis(currentBridgeFile);
            }}
        />
        {/* v6.0.0 - Generated Doc Modal */}
        <GeneratedDocModal
            isOpen={isGeneratorModalOpen}
            generatedText={generatedText}
            onClose={() => {
                setIsGeneratorModalOpen(false);
                setGeneratedText(null);
            }}
        />
        </>
    );
};

export default Sidebar;
