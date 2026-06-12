// v5.9.4 - Smart Bridge (Manual Selector UI)
import React, { useState } from 'react';

const SmartBridgeModal = ({ 
    isOpen, 
    matchedDossier, 
    savedDossiers,
    onClose, 
    onOpenMatched, 
    onManualSelect, 
    onCreateNew 
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    if (!isOpen) return null;

    const filteredDossiers = (savedDossiers || []).filter(d => 
        (d.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            {/* Modal plus large si pas de match pour accommoder la liste */}
            <div className={`bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 transition-all ${matchedDossier ? 'w-[450px]' : 'w-[550px] max-h-[85vh]'}`}>
                
                {/* Header commun */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-800/50 shrink-0">
                    <div className="flex items-center gap-2 text-indigo-400 font-bold">
                        <span>🌉</span> Smart Bridge
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-slate-400 hover:text-red-400 transition-colors"
                        title="Fermer"
                    >
                        ✕
                    </button>
                </div>

                {/* Contenu conditionnel selon le Match */}
                <div className={`flex flex-col ${matchedDossier ? 'p-6 text-center' : 'overflow-hidden flex-1'}`}>
                    {matchedDossier ? (
                        <div className="space-y-4">
                            <div className="mx-auto w-12 h-12 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center text-2xl mb-2">
                                ✓
                            </div>
                            <h2 className="text-xl font-bold text-white">Dossier trouvé !</h2>
                            <p className="text-sm text-slate-300">
                                Le fichier semble correspondre au dossier : <br/>
                                <span className="font-bold text-indigo-300 text-base block mt-2 p-2 bg-slate-800 rounded border border-slate-700">
                                    {matchedDossier.name || matchedDossier.nom || 'Dossier Sans Nom'}
                                </span>
                            </p>
                            
                            <div className="mt-6 pt-2">
                                <button 
                                    onClick={onOpenMatched}
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded shadow-lg transition-colors flex justify-center items-center gap-2"
                                >
                                    🚀 Ouvrir et Analyser
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full overflow-hidden">
                            <div className="p-6 pb-4 text-center shrink-0 border-b border-slate-800">
                                <div className="mx-auto w-12 h-12 bg-orange-500/20 text-orange-400 rounded-full flex items-center justify-center text-2xl mb-2">
                                    🔍
                                </div>
                                <h2 className="text-xl font-bold text-white mb-2">Dossier introuvable</h2>
                                <p className="text-sm text-slate-300">
                                    Sélectionnez manuellement le dossier de destination ou créez-en un nouveau.
                                </p>
                            </div>
                            
                            {/* Sélecteur manuel intégré */}
                            <div className="flex flex-col flex-1 min-h-0 bg-slate-800/30">
                                <div className="p-4 pb-2 shrink-0">
                                    <input 
                                        type="text" 
                                        placeholder="🔍 Rechercher un dossier existant..." 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                
                                <div className="flex-1 overflow-y-auto px-4 pb-4">
                                    {filteredDossiers.length === 0 ? (
                                        <div className="text-center text-slate-500 text-sm py-8 italic">
                                            Aucun dossier trouvé.
                                        </div>
                                    ) : (
                                        <div className="space-y-1.5">
                                            {filteredDossiers.map(dossier => (
                                                <button
                                                    key={dossier.id}
                                                    onClick={() => onManualSelect(dossier)}
                                                    className="w-full text-left bg-slate-800 hover:bg-indigo-600/30 border border-slate-700 hover:border-indigo-500/50 rounded p-3 transition-colors group flex justify-between items-center"
                                                >
                                                    <span className="font-medium text-slate-200 group-hover:text-indigo-200 truncate pr-4">
                                                        {dossier.name || 'Dossier Sans Nom'}
                                                    </span>
                                                    <span className="text-xs text-slate-500 group-hover:text-indigo-300 shrink-0">
                                                        {dossier.date}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 border-t border-slate-800 bg-slate-800/50 shrink-0">
                                <button 
                                    onClick={onCreateNew}
                                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded shadow transition-colors flex justify-center items-center gap-2"
                                >
                                    ✨ Créer un nouveau dossier
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SmartBridgeModal;
