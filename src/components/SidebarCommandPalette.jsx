import React, { useState, useEffect, useRef } from 'react';

const SidebarCommandPalette = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const modalRef = useRef(null);

    // Gestion du raccourci clavier Ctrl+K / Cmd+K et Echap
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ouvrir avec Ctrl+K ou Cmd+K
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault(); // Empêcher le comportement par défaut du navigateur (ex: barre de recherche)
                setIsOpen((prev) => !prev);
            }
            // Fermer avec Echap
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        // Nettoyage de l'écouteur au démontage du composant
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    // Fermeture si clic à l'extérieur de la modale
    const handleOverlayClick = (e) => {
        if (modalRef.current && !modalRef.current.contains(e.target)) {
            setIsOpen(false);
        }
    };

    return (
        <>
            {/* Bouton discret pour ouvrir manuellement si on ne connaît pas le raccourci */}
            {!isOpen && (
                <div className="flex flex-col h-full items-center pt-10 px-2 border-r border-slate-700 bg-slate-900 shrink-0 w-16">
                    <button
                        onClick={() => setIsOpen(true)}
                        className="bg-slate-800 text-slate-300 hover:text-white hover:bg-indigo-600 p-2 rounded shadow-lg transition-colors group relative"
                        title="Ouvrir la Command Palette"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span className="absolute left-14 bg-slate-800 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
                            Outils (Ctrl+K)
                        </span>
                    </button>
                </div>
            )}

            {/* Overlay pleine page et Modale */}
            {isOpen && (
                <div 
                    className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity"
                    onMouseDown={handleOverlayClick}
                >
                    {/* Conteneur type "Spotlight" */}
                    <div 
                        ref={modalRef}
                        className="w-[500px] max-h-[85vh] bg-slate-800 rounded-2xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8)] border border-slate-600/50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                    >
                        {/* En-tête de la modale pour le contexte */}
                        <div className="bg-slate-900 p-3 flex justify-between items-center border-b border-slate-700 shrink-0">
                            <div className="flex items-center text-slate-300 text-sm font-bold">
                                <span className="bg-slate-700 text-[10px] px-2 py-0.5 rounded mr-2 border border-slate-600">CMD</span>
                                Palette d'outils
                            </div>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="text-slate-400 hover:text-white text-xs font-mono bg-slate-800 px-2 py-1 rounded border border-slate-700"
                            >
                                Echap
                            </button>
                        </div>
                        
                        {/* Injection de la SidebarLegacy avec surcharge CSS pour s'adapter au conteneur */}
                        <style>{`
                            .command-palette-override > div {
                                border-right: none !important; /* Retire la bordure droite de SidebarLegacy */
                            }
                        `}</style>
                        <div className="command-palette-override flex-1 overflow-hidden relative">
                            {children}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default SidebarCommandPalette;
