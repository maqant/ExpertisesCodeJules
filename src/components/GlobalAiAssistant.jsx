import React, { useContext, useState, useRef } from 'react';
import { ExpertiseContext } from '../context/ExpertiseContext';
import { processGlobalIngestion } from '../services/aiManager';

const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.msg'];
const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

const isAcceptedFile = (file) => {
    const name = (file.name || '').toLowerCase();
    if (ACCEPTED_EXTENSIONS.some(ext => name.endsWith(ext))) return true;
    if (ACCEPTED_MIME.includes(file.type)) return true;
    return false;
};

const getFileIcon = (file) => {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.msg')) return '📧';
    if (name.endsWith('.pdf')) return '📄';
    if (file.type?.startsWith('image/')) return '🖼️';
    return '📎';
};

const GlobalAiAssistant = () => {
    const {
        isAiModeActive, aiConfig,
        setPendingAiData
    } = useContext(ExpertiseContext);

    const [files, setFiles] = useState([]);
    const [rawText, setRawText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef(null);

    const handleAddFiles = (newFiles) => {
        const validFiles = [];
        const rejectedNames = [];
        for (const f of newFiles) {
            if (isAcceptedFile(f)) {
                // Avoid duplicates by name
                if (!files.some(existing => existing.name === f.name && existing.size === f.size)) {
                    validFiles.push(f);
                }
            } else {
                rejectedNames.push(f.name);
            }
        }
        if (rejectedNames.length > 0) {
            setError(`Fichier(s) non supporté(s) ignoré(s): ${rejectedNames.join(', ')}. Formats acceptés: PDF, images, .msg`);
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
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleAddFiles(Array.from(e.dataTransfer.files));
        }
    };

    const handleAnalyze = async () => {
        if (files.length === 0 && !rawText.trim()) return;

        setIsLoading(true);
        setError(null);

        try {
            const inputArray = [...files];
            if (rawText.trim()) {
                inputArray.push(rawText.trim());
            }

            // v5.5.5 - Utilisation du Chef d'Orchestre multi-agents
            const result = await processGlobalIngestion(
                inputArray,
                aiConfig.apiKey,
                null,
                aiConfig.model
            );

            if (result.success && result.data) {
                // v5.4.0 Magic Drop: Feed directly into pendingAiData (NOT processJsonData which bypasses the Sas)
                const aiData = result.data;

                // Ensure occupants have UUIDs
                const occupants = (aiData.occupants || []).map(o => ({
                    ...o,
                    id: o.id || crypto.randomUUID()
                }));

                // Ensure expenses have UUIDs
                const expenses = (aiData.expenses || []).map(e => ({
                    ...e,
                    id: e.id || crypto.randomUUID(),
                    compteDe: e.compteDe || 'unassigned'
                }));

                // Build pendingFiles: extracted MSG attachments + original non-MSG files
                const allPendingFiles = [
                    ...(result.extractedFiles || []),
                    ...files.filter(f => !f.name.toLowerCase().endsWith('.msg'))
                ];

                // Single synchronous call — no race condition
                setPendingAiData({
                    formData: aiData.formData || null,
                    occupants,
                    expenses,
                    pendingFiles: allPendingFiles
                });

                // Clear the form on success
                setFiles([]);
                setRawText('');
            } else {
                setError(result.error || "L'IA n'a pas pu extraire les données. Réessayez avec des documents plus clairs.");
            }
        } catch (err) {
            console.error("[GlobalAiAssistant] Error:", err);
            setError("Erreur inattendue : " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const canAnalyze = (files.length > 0 || rawText.trim()) && !isLoading;
    const hasApiKey = !!(aiConfig.apiKey || import.meta.env.VITE_OPENAI_API_KEY);

    return (
        <div className="bg-gradient-to-br from-slate-800 via-indigo-900/30 to-slate-800 p-4 rounded-lg border border-indigo-500/30 shadow-lg">
            <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-1.5">
                <span className="text-base">🧠</span> Assistant IA Global
            </h3>
            <p className="text-[10px] text-indigo-200/80 mb-3 leading-tight">
                Glissez vos documents (PDF, images, emails .msg) et/ou collez vos notes brutes. L'IA analysera le tout et vous proposera les données à importer.
            </p>

            {/* Dropzone */}
            <div
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false); }}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-all duration-200 mb-3 ${
                    isDragOver
                        ? 'border-indigo-400 bg-indigo-500/20 scale-[1.01]'
                        : 'border-slate-600 hover:border-indigo-400/60 bg-slate-800/50 hover:bg-slate-800/70'
                }`}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.jpg,.jpeg,.png,.msg"
                    onChange={(e) => { handleAddFiles(Array.from(e.target.files)); e.target.value = null; }}
                    className="hidden"
                />
                <div className="pointer-events-none">
                    <div className="text-2xl mb-1">{isDragOver ? '📥' : '📁'}</div>
                    <p className="text-xs font-bold text-slate-300">
                        {isDragOver ? 'Relâchez pour ajouter' : 'Glisser-déposer ou cliquer'}
                    </p>
                    <p className="text-[9px] text-slate-500 mt-0.5">PDF, Images, Emails (.msg)</p>
                </div>
            </div>

            {/* File list */}
            {files.length > 0 && (
                <div className="mb-3 space-y-1">
                    {files.map((file, index) => (
                        <div
                            key={`${file.name}-${index}`}
                            className="flex items-center gap-2 bg-slate-800 rounded px-2.5 py-1.5 border border-slate-700 group"
                        >
                            <span className="text-sm shrink-0">{getFileIcon(file)}</span>
                            <span className="text-xs text-white font-medium truncate flex-1" title={file.name}>
                                {file.name}
                            </span>
                            <span className="text-[9px] text-slate-500 shrink-0">
                                {(file.size / 1024).toFixed(0)} Ko
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveFile(index); }}
                                className="text-slate-500 hover:text-red-400 transition-colors text-xs shrink-0 opacity-0 group-hover:opacity-100"
                                title="Retirer"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Textarea */}
            <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Collez ici vos notes brutes, copier-coller d'emails, informations du dossier..."
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-xs font-mono leading-relaxed resize-y h-20 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none placeholder-slate-500 mb-3"
                disabled={isLoading}
            />

            {/* Error message */}
            {error && (
                <div className="bg-red-900/30 border border-red-500/40 text-red-300 text-[10px] p-2 rounded mb-3 leading-tight">
                    ❌ {error}
                </div>
            )}

            {/* Warning: no API key */}
            {!hasApiKey && isAiModeActive && (
                <div className="bg-orange-900/30 border border-orange-500/40 text-orange-300 text-[10px] p-2 rounded mb-3 leading-tight">
                    ⚠️ Aucune clé API configurée. L'analyse fonctionnera en mode simulation (mock).
                </div>
            )}

            {/* Analyze button */}
            <button
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2 ${
                    canAnalyze
                        ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30'
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
            >
                {isLoading ? (
                    <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Analyse en cours...</span>
                    </>
                ) : (
                    <>
                        <span>🔍</span>
                        <span>Analyser avec l'IA</span>
                    </>
                )}
            </button>

            {isLoading && (
                <div className="mt-2">
                    <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full animate-pulse" style={{ width: '100%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    </div>
                    <p className="text-[9px] text-slate-400 text-center mt-1">L'analyse multimodale peut prendre 5 à 15 secondes...</p>
                </div>
            )}
        </div>
    );
};

export default GlobalAiAssistant;
