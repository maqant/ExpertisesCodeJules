import React from 'react';

const SidebarFloating = ({ children }) => {
    return (
        <div className="w-[450px] m-4 shrink-0 flex flex-col relative z-40 transition-all duration-300 group">
            {/* 
                Wrapper "Dynamic Island" / Floating Dock:
                - Détaché des bords (m-4)
                - Forts arrondis (rounded-3xl)
                - Ombre portée forte (shadow-2xl)
                - Effet Glassmorphism (bg translucide + backdrop-blur)
                - Le overflow-hidden est appliqué ici pour couper les coins du contenu enfant
            */}
            <div className="flex-1 flex flex-col w-full h-full rounded-3xl overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] border border-slate-600/50 bg-slate-800/80 backdrop-blur-md">
                {/* 
                    On utilise une div interne pour forcer le contenu (qui a sa propre couleur de fond)
                    à devenir transparent s'il le faut, mais SidebarLegacy définit bg-slate-800 sur sa racine.
                    On va surcharger subtilement le background des enfants directs via CSS 
                    pour laisser transparaître le glassmorphism.
                */}
                <style>{`
                    .sidebar-floating-mode-override > div {
                        background-color: transparent !important;
                    }
                    /* On affine la scrollbar pour ce mode élégant */
                    .sidebar-floating-mode-override ::-webkit-scrollbar {
                        width: 6px;
                    }
                    .sidebar-floating-mode-override ::-webkit-scrollbar-track {
                        background: transparent;
                        margin: 12px 0; /* padding pour les coins arrondis */
                    }
                    .sidebar-floating-mode-override ::-webkit-scrollbar-thumb {
                        background: rgba(255,255,255,0.15);
                        border-radius: 6px;
                    }
                    .sidebar-floating-mode-override:hover ::-webkit-scrollbar-thumb {
                        background: rgba(255,255,255,0.25);
                    }
                `}</style>

                <div className="sidebar-floating-mode-override w-full h-full flex flex-col relative">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default SidebarFloating;
