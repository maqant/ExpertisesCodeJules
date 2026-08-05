import React, { useState, useEffect, useRef, useCallback } from 'react';

const TRANSITION_MS = 400; // Synchronisé avec la transition CSS max-height

const SidebarFocusMode = ({ children }) => {
    const [isIsolated, setIsIsolated] = useState(false);
    const wrapperRef = useRef(null);
    const scrollRef = useRef(null);
    const lastActiveRef = useRef(null);
    const settleTimerRef = useRef(null);

    // --- Scroll : cale le haut de la section active en haut du conteneur (juste sous l'Assistant) ---
    const scrollActiveToTop = useCallback(() => {
        const scroller = scrollRef.current;
        if (!scroller) return;

        const computeAndScroll = () => {
            const active = wrapperRef.current?.querySelector('details.active-focus');
            if (!active) return;
            const targetTop = active.getBoundingClientRect().top
                - scroller.getBoundingClientRect().top
                + scroller.scrollTop
                - 8; // respiration visuelle de 8px sous la zone Assistant
            scroller.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
        };

        // Passe 1 : scroll immédiat (l'œil suit le mouvement)
        requestAnimationFrame(computeAndScroll);

        // Passe 2 : recalage pixel-perfect après la fin des animations de collapse
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = setTimeout(computeAndScroll, TRANSITION_MS + 80);
    }, []);

    // --- Activation d'une section ---
    const activateSection = useCallback((section) => {
        const wrapper = wrapperRef.current;
        if (!wrapper || !section) return;
        if (section.classList.contains('active-focus')) return;

        wrapper.querySelectorAll('details.active-focus')
            .forEach(el => el.classList.remove('active-focus'));

        section.classList.add('active-focus');
        section.open = true; // garantit que le contenu est déplié
        lastActiveRef.current = section;
        setIsIsolated(true);
        scrollActiveToTop();
    }, [scrollActiveToTop]);

    // --- Écoute focus + clic ---
    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        const handleInteraction = (e) => {
            const section = e.target.closest('details');
            if (section && wrapper.contains(section)) {
                activateSection(section);
            }
        };

        wrapper.addEventListener('focusin', handleInteraction);
        wrapper.addEventListener('click', handleInteraction);
        return () => {
            wrapper.removeEventListener('focusin', handleInteraction);
            wrapper.removeEventListener('click', handleInteraction);
            clearTimeout(settleTimerRef.current);
        };
    }, [activateSection]);

    // --- Sortie du focus : retour Vue Globale + repositionnement sur la section quittée ---
    const handleExitFocus = useCallback(() => {
        const wrapper = wrapperRef.current;
        if (wrapper) {
            wrapper.querySelectorAll('details.active-focus')
                .forEach(el => el.classList.remove('active-focus'));
        }
        setIsIsolated(false);

        // Après ré-expansion des sections, on recentre sur la section quittée
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = setTimeout(() => {
            lastActiveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, TRANSITION_MS + 80);
    }, []);

    // --- Raccourci clavier : Espace / Échap (avec garde-fou sur la saisie) ---
    useEffect(() => {
        if (!isIsolated) return;

        const isTypingContext = (el) => {
            if (!el) return false;
            const tag = el.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                handleExitFocus();
                return;
            }
            if (e.code === 'Space') {
                if (isTypingContext(e.target)) return; // Ne jamais intercepter l'Espace pendant la saisie
                e.preventDefault();
                handleExitFocus();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isIsolated, handleExitFocus]);

    return (
        <div 
            ref={wrapperRef}
            className={`sidebar-focus-mode w-[450px] h-full bg-slate-900 border-r border-slate-700 flex flex-col transition-all duration-500 relative shrink-0 z-40 ${isIsolated ? 'is-isolated' : ''}`}
        >
            <style>{`
                .sidebar-focus-mode details {
                    transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, margin 0.4s ease, padding 0.4s ease;
                    max-height: 2500px;
                    opacity: 1;
                    overflow: hidden;
                    transform-origin: top center;
                }
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
                .sidebar-focus-mode.is-isolated details.active-focus {
                    box-shadow: 0 4px 20px -2px rgba(1, 108, 184, 0.4);
                    border-color: rgba(1, 108, 184, 0.8);
                    background-color: rgba(26, 26, 25, 0.95);
                }
                @media (prefers-reduced-motion: reduce) {
                    .sidebar-focus-mode details { transition: none; }
                }
            `}</style>

            {/* Bouton de sortie du focus avec raccourci Esp / Esc */}
            <div className={`shrink-0 overflow-hidden transition-all duration-300 flex justify-center bg-pechard-charcoal ${isIsolated ? 'h-11 border-b border-pechard-blue/30' : 'h-0'}`}>
                <button 
                    onClick={handleExitFocus}
                    className="flex items-center gap-2 text-pechard-blue-light hover:text-white hover:bg-pechard-blue/20 px-4 py-1.5 rounded-lg font-bold text-xs my-1.5 transition-colors"
                    title="Raccourci : Touche Espace (hors saisie) ou Échap"
                >
                    <span>⬅</span>
                    <span>Revenir (Vue globale)</span>
                    <kbd className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700">Esp</kbd>
                </button>
            </div>

            {/* Conteneur pour SidebarLegacy */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar relative w-full h-full">
                {children}
            </div>
        </div>
    );
};

export default SidebarFocusMode;
