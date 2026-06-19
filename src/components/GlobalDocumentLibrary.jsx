/**
 * [DÉSACTIVÉ UI - 2026-06-19] Composant retiré de la Sidebar à la demande métier.
 * Conservé pour réintégration future éventuelle.
 * Mécanique d'ingestion (SmartBridge / SAS IA / store) NON impactée.
 */
import React, { useEffect, useState } from 'react';
import { useDocumentStore } from '../store/useDocumentStore';
import { FileText, Image as ImageIcon, File, Trash2, Eye } from 'lucide-react';

const GlobalDocumentLibrary = () => {
    const { documents, removeDocument, hydrateBlob } = useDocumentStore();
    const [fileUrls, setFileUrls] = useState({});

    // Drag start handler for HTML5 DnD
    const handleDragStart = (e, docId) => {
        // Mettre l'ID dans le drag data avec un type spécifique
        e.dataTransfer.setData('application/expertises-doc-id', docId);
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handleOpen = async (doc) => {
        const blob = await hydrateBlob(doc.id);
        if (blob) {
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            setTimeout(() => URL.revokeObjectURL(url), 60000); // cleanup
        } else {
            alert("Erreur: Impossible de charger le document.");
        }
    };

    const getIcon = (mimeType, kind) => {
        if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-indigo-400" />;
        if (mimeType === 'application/pdf') return <FileText className="w-5 h-5 text-rose-400" />;
        return <File className="w-5 h-5 text-slate-400" />;
    };

    const formatSize = (bytes) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-4 no-print">
            <div className="bg-slate-800 border border-indigo-500/30 rounded-lg p-4">
                <h3 className="text-white font-bold mb-2 flex items-center gap-2">
                    <span className="text-xl">📚</span> Bibliothèque Globale
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                    Tous les fichiers ingérés dans ce dossier. Glissez-déposez un fichier depuis cette liste vers un bloc de l'espace de travail (Trombone).
                </p>

                {documents.length === 0 ? (
                    <div className="text-center p-6 border border-dashed border-slate-600 rounded bg-slate-900/50">
                        <p className="text-slate-500 text-sm">Aucun document dans le dossier actuel.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {documents.map(doc => (
                            <div 
                                key={doc.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, doc.id)}
                                className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-700 hover:border-indigo-500 cursor-grab active:cursor-grabbing transition-colors"
                                title="Glissez-moi vers un bloc !"
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="shrink-0 bg-slate-800 p-1.5 rounded">
                                        {getIcon(doc.mimeType, doc.kind)}
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-sm font-bold text-slate-200 truncate">{doc.name}</span>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                            <span>{formatSize(doc.size)}</span>
                                            <span className="px-1.5 py-0.5 rounded bg-slate-800 font-medium">
                                                {doc.kind}
                                            </span>
                                            {doc.linkedBlocks && doc.linkedBlocks.length > 0 && (
                                                <span className="text-indigo-400">
                                                    📎 {doc.linkedBlocks.length} lien(s)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                    <button 
                                        onClick={() => handleOpen(doc)}
                                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                                        title="Voir"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => window.confirm('Supprimer ce document ?') && removeDocument(doc.id)}
                                        className="p-1.5 text-red-400 hover:text-white hover:bg-red-500/80 rounded transition-colors"
                                        title="Supprimer"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GlobalDocumentLibrary;
