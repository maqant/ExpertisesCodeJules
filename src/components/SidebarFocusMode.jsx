import React, { useState, useEffect, useRef, useCallback } from 'react';

const TRANSITION_MS = 400;
const CLICK_DEBOUNCE_MS = 350; // anti double-déclenchement focusin -> click

const SidebarFocusMode = ({ children }) => {
    const [isIsolated, setIsIsolated] = useState(false);
    const wrapperRef = useRef(null);
    const scrollRef = useRef(null);
    const lastActiveRef = useRef(null);
    const settleTimerRef = useRef(null);
    const lastActivationTsRef = useRef(0);

    // --- Scroll : cale le haut de la section active en haut du conteneur (juste sous la flèche/Assistant) ---
    const scrollActiveToTop = useCallback(() => {
        const scroller = scrollRef.current;
        if (!scroller) return;

        const computeAndScroll = () => {
            const active = wrapperRef.current?.querySelector('details.active-focus');
            if (!active) return;
            const targetTop = active.getBoundingClientRect().top
                - scroller.getBoundingClientRect().top
                + scroller.scrollTop
                - 4;
            scroller.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
        };

        requestAnimationFrame(computeAndScroll);
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = setTimeout(computeAndScroll, TRANSITION_MS + 80);
    }, []);

    // --- Sortie du focus : retour Vue Globale (toutes les barres fermées) ---
    const handleExitFocus = useCallback(() => {
        const wrapper = wrapperRef.current;
        if (wrapper) {
            wrapper.querySelectorAll('details').forEach(el => {
                el.classList.remove('active-focus');
                el.open = false; // Règle métier : toutes les barres fermées en vue globale
            });
        }
        setIsIsolated(false);

        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = setTimeout(() => {
            lastActiveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, TRANSITION_MS + 80);
    }, []);

    // --- Activation d'une section ---
    const activateSection = useCallback((section) => {
        const wrapper = wrapperRef.current;
        if (!wrapper || !section) return;
        if (section.classList.contains('active-focus')) return;

        wrapper.querySelectorAll('details').forEach(el => {
            el.classList.remove('active-focus');
            el.open = false;
        });

        section.classList.add('active-focus');
        section.open = true; // Seule voie d'ouverture autorisée
        lastActivationTsRef.current = Date.now();
        lastActiveRef.current = section;
        setIsIsolated(true);
        scrollActiveToTop();
    }, [scrollActiveToTop]);

    useEffect(() => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        // Clic : uniquement sur <summary>, toggle natif neutralisé
        const handleSummaryClick = (e) => {
            const summary = e.target.closest('summary');
            if (!summary || !wrapper.contains(summary)) return;
            e.preventDefault(); // Le navigateur ne pilote plus jamais "open"

            const section = summary.closest('details');
            if (!section) return;

            if (section.classList.contains('active-focus')) {
                // Ignore le click fantôme qui suit immédiatement le focusin d'activation
                if (Date.now() - lastActivationTsRef.current < CLICK_DEBOUNCE_MS) return;
                handleExitFocus(); // Re-clic volontaire sur la barre active => retour vue globale
            } else {
                activateSection(section);
            }
        };

        // Navigation clavier (Tab) ou focus dans un champ => focus de la section
        const handleFocusIn = (e) => {
            const section = e.target.closest('details');
            if (section && wrapper.contains(section)) {
                activateSection(section);
            }
        };

        // Filet de sécurité : tout <details> ouvert hors focus est refermé
        const handleToggle = (e) => {
            const d = e.target;
            if (d.tagName === 'DETAILS' && d.open && !d.classList.contains('active-focus')) {
                d.open = false;
            }
        };

        wrapper.addEventListener('click', handleSummaryClick);
        wrapper.addEventListener('focusin', handleFocusIn);
        wrapper.addEventListener('toggle', handleToggle, true); // capture : toggle ne bulle pas

        // État initial : toutes les barres fermées
        wrapper.querySelectorAll('details').forEach(el => { el.open = false; });

        return () => {
            wrapper.removeEventListener('click', handleSummaryClick);
            wrapper.removeEventListener('focusin', handleFocusIn);
            wrapper.removeEventListener('toggle', handleToggle, true);
            clearTimeout(settleTimerRef.current);
        };
    }, [activateSection, handleExitFocus]);

    // --- Raccourci clavier : Espace / Échap (avec protection champ texte) ---
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
                if (isTypingContext(e.target)) return; // Ne jamais intercepter l'Espace en saisie
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
                /* Maximisation hauteur utile : débloque la hauteur max de la section en focus pour tout voir */
                .sidebar-focus-mode.is-isolated details.active-focus {
                    max-height: 9999px !important;
                    box-shadow: 0 4px 24px -2px rgba(1, 108, 184, 0.45);
                    border-color: rgba(1, 108, 184, 0.85);
                    background-color: rgba(26, 26, 25, 0.98);
                }
                @media (prefers-reduced-motion: reduce) {
                    .sidebar-focus-mode details { transition: none; }
                }
            `}</style>

            {/* Bouton retour flèche "←" ultra-compact placé juste au-dessus du scroller */}
            <div className={`shrink-0 overflow-hidden transition-all duration-300 flex items-center justify-between px-3 bg-pechard-charcoal ${isIsolated ? 'h-8 border-b border-pechard-blue/30' : 'h-0'}`}>
                <button 
                    onClick={handleExitFocus}
                    className="w-6 h-6 rounded-md bg-pechard-blue/20 text-pechard-blue-light hover:bg-pechard-blue hover:text-white flex items-center justify-center font-extrabold text-sm transition-all shadow-sm"
                    title="Revenir en Vue globale (Raccourci : Espace ou Échap)"
                    aria-label="Revenir en vue globale"
                >
                    ←
                </button>
                <span className="text-[10px] text-slate-400 font-medium">Mode Focus isolé</span>
            </div>

            {/* Conteneur pour SidebarLegacy */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto no-scrollbar relative w-full h-full">
                {children}
            </div>
        </div>
    );
};

export default SidebarFocusMode;
