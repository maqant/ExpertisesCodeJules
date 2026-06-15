// v6.1.1 - Smart Bridge : accumulation multi-fichiers + chips compacts
import React, { useState, useRef, useContext } from 'react';
import { ExpertiseContext } from '../context/ExpertiseContext';
import { cloneFilesEagerly } from '../services/utils/aiHelpers.js';

const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.msg'];
const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png'];

const isAccepted = (file) => {
    const name = (file.name || '').toLowerCase();
    return ACCEPTED_EXTENSIONS.some(ext => name.endsWith(ext)) || ACCEPTED_MIME.includes(file.type);
};

const emoji = (file) => {
    const n = (file.name || '').toLowerCase();
    if (n.endsWith('.msg')) return '📧';
    if (n.endsWith('.pdf')) return '📄';
    if (file.type?.startsWith('image/')) return '🖼️';
    return '📎';
};

const formatSize = (b) => b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} Ko` : `${(b / 1024 / 1024).toFixed(1)} Mo`;

const SmartBridgeDropzone = ({ onFileDrop }) => {
    const { bridgeFiles: files, setBridgeFiles: setFiles, isDeepThinkingMode, toggleDeepThinkingMode } = useContext(ExpertiseContext);
    const [isDragOver, setIsDragOver] = useState(false);
    const inputRef = useRef(null);

    const addFiles = (newFiles) => {
        const valid = [];
        for (const f of newFiles) {
            if (isAccepted(f) && !files.some(ex => ex.name === f.name && ex.size === f.size)) {
                valid.push(f);
            }
        }
        if (valid.length > 0) setFiles(prev => [...prev, ...valid]);
    };

    const removeFile = (i) => setFiles(prev => prev.filter((_, idx) => idx !== i));

    const handleDrop = async (e) => {
        e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
        if (e.dataTransfer.files?.length > 0) {
            // v6.3.2 - IMPORTANT: On extrait immédatement les fichiers de e.dataTransfer
            // avant tout await, sinon l'objet dataTransfer est vidé par le navigateur
            const filesList = Array.from(e.dataTransfer.files);
            const safeFiles = await cloneFilesEagerly(filesList);
            addFiles(safeFiles);
        }
    };

    const handleAnalyze = () => {
        if (files.length === 0) return;
        // Envoyer TOUS les fichiers au handler de la Sidebar
        onFileDrop(files);
    };

    const hasFiles = files.length > 0;

    return (
        <div className="rounded-lg overflow-hidden">
            {/* === ÉTAT VIDE : dropzone classique === */}
            {!hasFiles && (
                <div
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false); }}
                    onDrop={handleDrop}
                    onClick={() => inputRef.current?.click()}
                    className={`border border-dashed rounded-lg p-2.5 flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        isDragOver
                            ? 'border-indigo-400 bg-indigo-500/20 text-indigo-300 scale-[1.02]'
                            : 'border-slate-600 bg-slate-800/50 text-slate-400 hover:border-indigo-500/50 hover:bg-slate-800'
                    }`}
                >
                    <span className="text-xl pointer-events-none">🌉</span>
                    <div className="flex flex-col items-start text-left w-full">
                        <div className="flex items-center justify-between w-full">
                            <p className="text-[10px] font-bold text-white uppercase tracking-wider leading-tight pointer-events-none">Smart Bridge</p>
                            <label className="flex items-center gap-1 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                <span className={`text-[8px] font-bold uppercase ${isDeepThinkingMode ? 'text-indigo-300' : 'text-slate-500'}`}>Mode lourd</span>
                                <input type="checkbox" className="hidden" checked={isDeepThinkingMode} onChange={toggleDeepThinkingMode} />
                                <div className={`w-6 h-3 rounded-full flex items-center transition-colors ${isDeepThinkingMode ? 'bg-indigo-500' : 'bg-slate-600'}`}>
                                    <div className={`w-2.5 h-2.5 bg-white rounded-full shadow-sm transform transition-transform ${isDeepThinkingMode ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                </div>
                            </label>
                        </div>
                        <p className="text-[9px] leading-tight mt-1 pointer-events-none">Glissez vos mails (.msg) et documents</p>
                    </div>
                </div>
            )}

            {/* === ÉTAT CHARGÉ : chips + bouton Analyser === */}
            {hasFiles && (
                <div 
                    className={`bg-slate-800/60 border rounded-lg p-2 transition-all ${isDragOver ? 'border-indigo-400 bg-indigo-500/20' : 'border-indigo-500/30'}`}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false); }}
                    onDrop={handleDrop}
                >
                    {/* Header compact */}
                    <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 pointer-events-none">
                            <span className="text-sm">🌉</span>
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Smart Bridge</span>
                            <span className="text-[9px] text-indigo-400 bg-indigo-500/15 px-1.5 py-0.5 rounded-full font-medium">
                                {files.length}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1 cursor-pointer">
                                <span className={`text-[8px] font-bold uppercase ${isDeepThinkingMode ? 'text-indigo-300' : 'text-slate-500'}`}>Mode lourd</span>
                                <input type="checkbox" className="hidden" checked={isDeepThinkingMode} onChange={toggleDeepThinkingMode} />
                                <div className={`w-6 h-3 rounded-full flex items-center transition-colors ${isDeepThinkingMode ? 'bg-indigo-500' : 'bg-slate-600'}`}>
                                    <div className={`w-2.5 h-2.5 bg-white rounded-full shadow-sm transform transition-transform ${isDeepThinkingMode ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                </div>
                            </label>
                            <button
                                onClick={() => setFiles([])}
                                className="text-[9px] text-slate-600 hover:text-red-400 transition-colors"
                            >
                                Vider
                            </button>
                        </div>
                    </div>

                    {/* Chips de fichiers */}
                    <div className="flex flex-wrap gap-1 mb-2">
                        {files.map((file, i) => (
                            <div
                                key={`${file.name}-${i}`}
                                className="group flex items-center gap-1 bg-slate-900/80 border border-slate-700/50 rounded px-1.5 py-0.5 text-[9px]"
                                title={`${file.name} — ${formatSize(file.size)}`}
                            >
                                <span className="shrink-0">{emoji(file)}</span>
                                <span className="text-slate-300 truncate" style={{ maxWidth: '100px' }}>
                                    {file.name.replace(/\.(msg|pdf|jpe?g|png)$/i, '')}
                                </span>
                                <button
                                    onClick={() => removeFile(i)}
                                    className="text-slate-600 hover:text-red-400 transition-colors shrink-0 opacity-0 group-hover:opacity-100 leading-none"
                                >
                                    ×
                                </button>
                            </div>
                        ))}

                        {/* Chip + ajouter */}
                        <div
                            onClick={() => inputRef.current?.click()}
                            className={`flex items-center gap-0.5 border border-dashed rounded px-1.5 py-0.5 text-[9px] cursor-pointer transition-all ${
                                isDragOver
                                    ? 'border-indigo-400 bg-indigo-500/20 text-indigo-300'
                                    : 'border-slate-600 text-slate-500 hover:border-indigo-400/60 hover:text-indigo-400'
                            }`}
                        >
                            <span>＋</span>
                        </div>
                    </div>

                    {/* Bouton Analyser */}
                    <button
                        onClick={handleAnalyze}
                        className="w-full py-1.5 rounded-md text-[10px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-sm shadow-indigo-500/20 hover:shadow-indigo-500/30 flex items-center justify-center gap-1"
                    >
                        <span>🔍</span>
                        <span>Analyser {files.length} fichier{files.length > 1 ? 's' : ''}</span>
                    </button>
                </div>
            )}

            {/* Input caché */}
            <input
                ref={inputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.msg"
                onChange={(e) => { addFiles(Array.from(e.target.files)); e.target.value = null; }}
                className="hidden"
            />
        </div>
    );
};

export default SmartBridgeDropzone;
