import React, { useState, useContext } from 'react';
import { useSidebarUI } from '../../context/SidebarUIContext';
import { ExpertiseContext } from '../../context/ExpertiseContext';

const DossiersModal = () => {
    const { isLoadDossierModalOpen, setIsLoadDossierModalOpen } = useSidebarUI();
    const { savedDossiers, loadDossier, deleteDossier, currentDossierId, saveDossier, saveDossierAs } = useContext(ExpertiseContext);
    const [searchQuery, setSearchQuery] = useState('');

    if (!isLoadDossierModalOpen) return null;

    const filteredDossiers = (savedDossiers || []).filter(d => 
        (d.name || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSelectDossier = (dossier) => {
        loadDossier(dossier);
        setIsLoadDossierModalOpen(false);
    };

    const handleDeleteDossier = (e, dossierId) => {
        e.stopPropagation();
        if (window.confirm("Voulez-vous vraiment supprimer ce dossier sauvegardé ?")) {
            deleteDossier(dossierId);
        }
    };

    return (
        <div 
            className="fixed inset-0 z-[10000] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 print:hidden"
            onClick={() => setIsLoadDossierModalOpen(false)}
        >
            <div 
                className="bg-slate-900 text-slate-100 rounded-2xl w-full max-w-xl max-h-[85vh] flex flex-col border border-slate-700 shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">📂</span>
                        <h2 className="text-base font-extrabold text-white tracking-wide">Gestion &amp; Chargement des Dossiers</h2>
                    </div>
                    <button 
                        onClick={() => setIsLoadDossierModalOpen(false)}
                        className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors font-bold text-sm"
                        aria-label="Fermer"
                    >
                        ✕
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-4 bg-slate-900/50 border-b border-slate-800 flex flex-col gap-3">
                    <div className="flex gap-2">
                        <button 
                            onClick={() => { saveDossier(); }}
                            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-2 px-3 rounded-lg shadow transition-colors flex items-center justify-center gap-2"
                        >
                            <span>💾</span> Sauvegarder l'état actuel
                        </button>
                        {currentDossierId && (
                            <button 
                                onClick={() => { saveDossierAs(); }}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-3 rounded-lg shadow transition-colors flex items-center justify-center gap-2"
                            >
                                <span>📁</span> Dupliquer / Copier
                            </button>
                        )}
                    </div>
                    
                    {/* Search Bar */}
                    <div className="relative">
                        <input
                            type="search"
                            placeholder="🔍 Rechercher un dossier par nom..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Dossier List */}
                <div className="p-4 overflow-y-auto flex-1 max-h-96">
                    {filteredDossiers.length === 0 ? (
                        <div className="py-12 text-center text-slate-500 text-xs italic">
                            {savedDossiers.length === 0 ? "Aucun dossier sauvegardé pour le moment." : "Aucun dossier ne correspond à votre recherche."}
                        </div>
                    ) : (
                        <ul className="space-y-2">
                            {filteredDossiers.map((d) => {
                                const isCurrent = d.id === currentDossierId;
                                return (
                                    <li 
                                        key={d.id}
                                        onClick={() => handleSelectDossier(d)}
                                        className={`group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                                            isCurrent 
                                                ? 'bg-indigo-950/60 border-indigo-500/80 shadow-md' 
                                                : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 hover:border-slate-600'
                                        }`}
                                    >
                                        <div className="flex flex-col min-w-0 mr-3">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-xs text-white truncate">{d.name}</span>
                                                {isCurrent && (
                                                    <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/40 font-bold">
                                                        Actif
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-slate-400 mt-0.5 font-mono">{d.date}</span>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <button 
                                                onClick={() => handleSelectDossier(d)}
                                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors shadow"
                                            >
                                                Charger
                                            </button>
                                            <button 
                                                onClick={(e) => handleDeleteDossier(e, d.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                                                title="Supprimer ce dossier"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DossiersModal;
