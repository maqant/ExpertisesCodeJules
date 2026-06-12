import React, { useContext, useState, useRef } from 'react';
import { ExpertiseContext } from '../context/ExpertiseContext';
import { processGlobalIngestion } from '../services/aiManager';

// v6.1.1 - Smart Bridge redesign : compact file chips + accumulation persistée
const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.msg'];
const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

const isAcceptedFile = (file) => {
    const name = (file.name || '').toLowerCase();
    if (ACCEPTED_EXTENSIONS.some(ext => name.endsWith(ext))) return true;
    if (ACCEPTED_MIME.includes(file.type)) return true;
    return false;
};

const getFileEmoji = (file) => {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.msg')) return '📧';
    if (name.endsWith('.pdf')) return '📄';
    if (file.type?.startsWith('image/')) return '🖼️';
    return '📎';
};

const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
};

const GlobalAiAssistant = () => {
    const {
        isAiModeActive, aiConfig, formData,
        setPendingAiData, setAiStatus, setRawContexts,
        bridgeFiles: files, setBridgeFiles: setFiles  // v6.1.0 - persisté dans le contexte
    } = useContext(ExpertiseContext);

    const [rawText, setRawText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [showTextArea, setShowTextArea] = useState(false);
    const fileInputRef = useRef(null);

    const handleAddFiles = (newFiles) => {
        const validFiles = [];
        const rejectedNames = [];
        for (const f of newFiles) {
            if (isAcceptedFile(f)) {
                if (!files.some(ex => ex.name === f.name && ex.size === f.size)) {
                    validFiles.push(f);
                }
            } else {
                rejectedNames.push(f.name);
            }
        }
        if (rejectedNames.length > 0) {
            setError(`Format non supporté : ${rejectedNames.join(', ')}`);
            setTimeout(() => setError(null), 3000);
        }
        if (validFiles.length > 0) {
            setFiles(prev => [...prev, ...validFiles]);
            setError(null);
        }
    };

    const handleRemoveFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        if (e.dataTransfer.files?.length > 0) {
            handleAddFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); };
    const handleDragLeave = (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false);
    };

    const handleAnalyze = async () => {
        if (files.length === 0 && !rawText.trim()) return;
        setIsLoading(true);
        setError(null);

        try {
            const inputArray = [...files];
            if (rawText.trim()) inputArray.push(rawText.trim());

            const result = await processGlobalIngestion(
                inputArray,
                aiConfig.apiKey,
                setAiStatus,
                aiConfig.model,
                { cause: formData?.cause }
            );

            if (result.success && result.data) {
                const aiData = result.data;
                const occupants = (aiData.occupants || []).map(o => ({ ...o, id: o.id || crypto.randomUUID() }));
                const expenses = (aiData.expenses || []).map(e => ({ ...e, id: e.id || crypto.randomUUID(), compteDe: e.compteDe || 'unassigned' }));
                const allPendingFiles = [
                    ...(result.extractedFiles || []),
                    ...files.filter(f => !f.name.toLowerCase().endsWith('.msg'))
                ];
                setPendingAiData({ formData: aiData.formData || null, occupants, expenses, pendingFiles: allPendingFiles });
                const newContexts = [];
                if (rawText.trim()) newContexts.push(rawText.trim());
                if (aiData.formData?.cause) newContexts.push(aiData.formData.cause);
                if (aiData.formData?.divers) newContexts.push(aiData.formData.divers);
                if (newContexts.length > 0) setRawContexts(prev => [...prev, ...newContexts]);
                setFiles([]);
                setRawText('');
            } else {
                setError(result.error || "L'IA n'a pas pu extraire les données.");
            }
        } catch (err) {
            console.error('[GlobalAiAssistant] Error:', err);
            setError('Erreur : ' + err.message);
        } finally {
            setIsLoading(false);
            setAiStatus('idle');
        }
    };

    const totalFiles = files.length;
    const canAnalyze = (totalFiles > 0 || rawText.trim()) && !isLoading;
    const hasApiKey = !!(aiConfig.apiKey || import.meta.env.VITE_OPENAI_API_KEY);
    const hasFiles = totalFiles > 0;

    return (
        <div className="bg-gradient-to-br from-slate-800 via-indigo-900/30 to-slate-800 rounded-lg border border-indigo-500/30 shadow-lg overflow-hidden">

            {/* Header compact */}
            <div className="px-3.5 pt-3 pb-2.5 border-b border-indigo-500/15">
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>🧠</span> Assistant IA Global
                    {hasFiles && !isLoading && (
                        <span className="ml-auto text-[9px] font-normal text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded-full">
                            {totalFiles} en file
                        </span>
                    )}
                </h3>
            </div>

            <div className="p-3 space-y-2">

                {/* === ÉTAT VIDE : grande dropzone invitante === */}
                {!hasFiles && !isLoading && (
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 py-6 text-center ${
                            isDragOver
                                ? 'border-indigo-400 bg-indigo-500/20 scale-[1.02]'
                                : 'border-slate-600 hover:border-indigo-400/60 bg-slate-800/40 hover:bg-slate-800/60'
                        }`}
                    >
                        <input ref={fileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.msg"
                            onChange={(e) => { handleAddFiles(Array.from(e.target.files)); e.target.value = null; }}
                            className="hidden"
                        />
                        <div className="text-2xl mb-1">{isDragOver ? '📥' : '📁'}</div>
                        <p className="text-xs font-semibold text-slate-300">
                            {isDragOver ? 'Relâchez ici' : 'Glisser-déposer ou cliquer'}
                        </p>
                        <p className="text-[9px] text-slate-500 mt-0.5">PDF · Images · Emails .msg</p>
                    </div>
                )}

                {/* === ÉTAT CHARGÉ : chips compacts + dropzone miniature === */}
                {hasFiles && !isLoading && (
                    <div>
                        {/* Chips des fichiers */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {files.map((file, index) => (
                                <div
                                    key={`${file.name}-${index}`}
                                    className="group flex items-center gap-1 bg-slate-900/70 border border-slate-700/60 rounded-lg px-2 py-1 text-[10px] max-w-full"
                                    title={`${file.name} — ${formatSize(file.size)}`}
                                >
                                    <span className="shrink-0 text-xs">{getFileEmoji(file)}</span>
                                    <span className="text-slate-300 truncate" style={{ maxWidth: '120px' }}>
                                        {file.name.replace(/\.msg$|\.pdf$/i, '')}
                                    </span>
                                    <span className="text-slate-600 shrink-0">{formatSize(file.size)}</span>
                                    <button
                                        onClick={() => handleRemoveFile(index)}
                                        className="text-slate-600 hover:text-red-400 transition-colors shrink-0 ml-0.5 opacity-0 group-hover:opacity-100"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}

                            {/* Chip "+ Ajouter" discret */}
                            <div
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`flex items-center gap-1 border border-dashed rounded-lg px-2 py-1 text-[10px] cursor-pointer transition-all duration-150 ${
                                    isDragOver
                                        ? 'border-indigo-400 bg-indigo-500/20 text-indigo-300'
                                        : 'border-slate-600 text-slate-500 hover:border-indigo-400/60 hover:text-indigo-400 bg-slate-800/30'
                                }`}
                            >
                                <span>＋</span>
                                <span>{isDragOver ? 'Déposer' : 'Ajouter'}</span>
                            </div>
                        </div>

                        {/* Lien "tout effacer" très discret */}
                        <div className="flex justify-end">
                            <button
                                onClick={() => setFiles([])}
                                className="text-[9px] text-slate-600 hover:text-red-400 transition-colors"
                            >
                                Tout effacer
                            </button>
                        </div>
                    </div>
                )}

                {/* En cours d'analyse : mini spinner inline */}
                {isLoading && (
                    <div className="flex items-center gap-2 py-2">
                        <svg className="animate-spin h-3.5 w-3.5 text-indigo-400 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <div className="flex-1">
                            <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full animate-pulse w-full" />
                            </div>
                            <p className="text-[9px] text-slate-500 mt-0.5">Pipeline IA en cours… (5–20 sec)</p>
                        </div>
                    </div>
                )}

                {/* Zone texte optionnelle */}
                <div>
                    <button
                        onClick={() => setShowTextArea(p => !p)}
                        className="text-[10px] text-slate-500 hover:text-indigo-400 transition-colors flex items-center gap-1"
                    >
                        <span>{showTextArea ? '▾' : '▸'}</span> Coller du texte brut (optionnel)
                    </button>
                    {showTextArea && (
                        <textarea
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            placeholder="Collez ici vos notes brutes, emails copiés-collés…"
                            className="w-full mt-1.5 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-xs font-mono leading-relaxed resize-y h-16 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none placeholder-slate-500"
                            disabled={isLoading}
                        />
                    )}
                </div>

                {/* Erreurs */}
                {error && (
                    <div className="bg-red-900/30 border border-red-500/40 text-red-300 text-[10px] p-2 rounded leading-tight">
                        ❌ {error}
                    </div>
                )}
                {!hasApiKey && isAiModeActive && (
                    <div className="bg-orange-900/30 border border-orange-500/40 text-orange-300 text-[10px] p-2 rounded leading-tight">
                        ⚠️ Aucune clé API — mode simulation.
                    </div>
                )}

                {/* Bouton principal */}
                <button
                    onClick={handleAnalyze}
                    disabled={!canAnalyze}
                    className={`w-full py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                        canAnalyze
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.01]'
                            : 'bg-slate-700/50 text-slate-500 cursor-not-allowed'
                    }`}
                >
                    <span>🔍</span>
                    <span>
                        {isLoading
                            ? 'Analyse en cours…'
                            : totalFiles > 0
                                ? `Analyser ${totalFiles} fichier${totalFiles > 1 ? 's' : ''}`
                                : rawText.trim() ? 'Analyser le texte' : 'Analyser avec l\'IA'
                        }
                    </span>
                </button>
            </div>

            {/* Input caché réutilisé partout */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.msg"
                onChange={(e) => { handleAddFiles(Array.from(e.target.files)); e.target.value = null; }}
                className="hidden"
            />
        </div>
    );
};

export default GlobalAiAssistant;
