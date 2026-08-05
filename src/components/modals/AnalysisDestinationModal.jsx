import React, { useEffect } from 'react';

const AnalysisDestinationModal = ({ isOpen, onClose, onChoice }) => {
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-[10000] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 print:hidden"
            onClick={onClose}
        >
            <div 
                className="bg-slate-900 text-slate-100 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl overflow-hidden p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">🔮</span>
                        <h2 className="text-base font-extrabold text-white">Destination de l'analyse</h2>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors font-bold text-xs"
                        aria-label="Fermer"
                    >
                        ✕
                    </button>
                </div>

                <p className="text-xs text-slate-400">
                    Où souhaitez-vous injecter les données extraites par l'IA ?
                </p>

                {/* 3 Choices */}
                <div className="space-y-3 pt-1">
                    {/* Option 1: Ajouter à ce dossier */}
                    <button
                        onClick={() => onChoice('ADD_CURRENT')}
                        className="w-full text-left bg-slate-800/90 hover:bg-indigo-900/40 border border-slate-700 hover:border-indigo-500 p-3.5 rounded-xl transition-all group flex items-start gap-3 shadow-sm"
                    >
                        <span className="text-2xl p-2 rounded-lg bg-slate-900 border border-slate-700 group-hover:border-indigo-500/50">📥</span>
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-xs text-white group-hover:text-indigo-300 transition-colors">
                                Ajouter à ce dossier
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                                Injecte et fusionne directement l'analyse dans le dossier actuellement ouvert.
                            </div>
                        </div>
                    </button>

                    {/* Option 2: Classer dans un autre dossier */}
                    <button
                        onClick={() => onChoice('CLASSIFY')}
                        className="w-full text-left bg-slate-800/90 hover:bg-indigo-900/40 border border-slate-700 hover:border-indigo-500 p-3.5 rounded-xl transition-all group flex items-start gap-3 shadow-sm"
                    >
                        <span className="text-2xl p-2 rounded-lg bg-slate-900 border border-slate-700 group-hover:border-indigo-500/50">📂</span>
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-xs text-white group-hover:text-indigo-300 transition-colors">
                                Classer dans un autre dossier
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                                Recherche automatique par référence ou vous propose la liste de vos dossiers.
                            </div>
                        </div>
                    </button>

                    {/* Option 3: Nouveau dossier */}
                    <button
                        onClick={() => onChoice('NEW')}
                        className="w-full text-left bg-slate-800/90 hover:bg-indigo-900/40 border border-slate-700 hover:border-indigo-500 p-3.5 rounded-xl transition-all group flex items-start gap-3 shadow-sm"
                    >
                        <span className="text-2xl p-2 rounded-lg bg-slate-900 border border-slate-700 group-hover:border-indigo-500/50">🆕</span>
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-xs text-white group-hover:text-indigo-300 transition-colors">
                                Nouveau dossier
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                                Réinitialise le formulaire et crée un tout nouveau dossier depuis l'analyse.
                            </div>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AnalysisDestinationModal;
