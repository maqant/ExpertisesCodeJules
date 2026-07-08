import React, { useState, useEffect, useRef } from 'react';

const SidebarFocusMode = ({ children }) => {
    const [isIsolated, setIsIsolated] = useState(false);
    const wrapperRef = useRef(null);

    // Écoute de l'événement focusin pour capter le focus n'importe où dans l'arbre DOM enfant
    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        const handleFocusIn = (e) => {
            // Trouver le parent logique le plus proche qui définit une "section"
            // Dans SidebarLegacy, les sections principales utilisent des <details>
            const closestSection = e.target.closest('details');

            if (closestSection) {
                // Si on n'est pas déjà isolé sur cette section
                if (!closestSection.classList.contains('active-focus')) {
                    // Nettoyer les autres
                    const allFocused = wrapper.querySelectorAll('.active-focus');
                    allFocused.forEach(el => el.classList.remove('active-focus'));
                    
                    // Activer la nouvelle
                    closestSection.classList.add('active-focus');
                    
                    // Déclencher le mode isolé
                    setIsIsolated(true);
                }
            }
        };

        wrapper.addEventListener('focusin', handleFocusIn);
        
        return () => {
            wrapper.removeEventListener('focusin', handleFocusIn);
        };
    }, []);

    const handleExitFocus = () => {
        setIsIsolated(false);
        if (wrapperRef.current) {
            const allFocused = wrapperRef.current.querySelectorAll('.active-focus');
            allFocused.forEach(el => el.classList.remove('active-focus'));
        }
    };

    return (
        <div 
            ref={wrapperRef}
            className={`sidebar-focus-mode w-[450px] h-full bg-slate-900 border-r border-slate-700 flex flex-col transition-all duration-500 relative shrink-0 z-40 ${isIsolated ? 'is-isolated' : ''}`}
        >
            <style>{`
                /* Base transition pour toutes les sections */
                .sidebar-focus-mode details {
                    transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, margin 0.4s ease, padding 0.4s ease;
                    max-height: 2500px; /* Assez grand pour englober le contenu ouvert */
                    opacity: 1;
                    overflow: hidden;
                    transform-origin: top center;
                }

                /* Isolement : masquer le bruit */
                .sidebar-focus-mode.is-isolated details:not(.active-focus) {
                    max-height: 0 !important;
                    margin-top: 0 !important;
                    margin-bottom: 0 !important;
                    padding-top: 0 !important;
                    padding-bottom: 0 !important;
                    opacity: 0 !important;
                    border-width: 0 !important;
                    pointer-events: none;
                }

                /* Highlight de la section active pour plus d'élégance */
                .sidebar-focus-mode.is-isolated details.active-focus {
                    box-shadow: 0 4px 20px -2px rgba(99, 102, 241, 0.3);
                    border-color: rgba(99, 102, 241, 0.6);
                    background-color: rgba(30, 41, 59, 0.95);
                }
            `}</style>

            {/* Bouton de sortie du focus, injecté dynamiquement en haut */}
            <div className={`shrink-0 overflow-hidden transition-all duration-300 flex justify-center bg-slate-800 ${isIsolated ? 'h-12 border-b border-indigo-500/30' : 'h-0'}`}>
                <button 
                    onClick={handleExitFocus}
                    className="flex items-center gap-2 text-indigo-300 hover:text-white hover:bg-indigo-600/20 px-4 py-2 rounded-lg font-bold text-xs mt-1 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Quitter le focus (Vue Globale)
                </button>
            </div>

            {/* Conteneur pour SidebarLegacy */}
            <div className="flex-1 overflow-y-auto no-scrollbar relative w-full h-full">
                {children}
            </div>
        </div>
    );
};

export default SidebarFocusMode;
