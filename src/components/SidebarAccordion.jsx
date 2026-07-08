import React from 'react';

const SidebarAccordion = ({ children }) => {
    return (
        <div className="w-[450px] h-full bg-slate-900 border-r border-slate-700 flex flex-col transition-all duration-500 relative sidebar-accordion-wrapper shrink-0 shadow-2xl z-40">
            <style>{`
                /* Focus Mode CSS Logic using :has() */
                
                /* Base style for all details */
                .sidebar-accordion-wrapper details {
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    transform-origin: center center;
                    opacity: 1;
                    filter: blur(0px);
                }

                /* When the wrapper is hovered and a details is open AND hovered/focused, fade out the others */
                .sidebar-accordion-wrapper:has(details[open]:hover) details:not(:hover),
                .sidebar-accordion-wrapper:has(details[open]:focus-within) details:not(:focus-within) {
                    opacity: 0.3;
                    filter: grayscale(80%) blur(1px);
                    transform: scale(0.97);
                    pointer-events: none; /* Prevent interacting with faded elements */
                }

                /* Slightly emphasize the active one */
                .sidebar-accordion-wrapper details[open]:hover,
                .sidebar-accordion-wrapper details[open]:focus-within {
                    transform: scale(1.02);
                    z-index: 50;
                    position: relative;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
                    border-color: rgba(99, 102, 241, 0.4);
                }
                
                /* Keep scrollbar minimal so it doesn't add noise */
                .sidebar-accordion-wrapper ::-webkit-scrollbar {
                    width: 5px;
                }
                .sidebar-accordion-wrapper ::-webkit-scrollbar-track {
                    background: transparent;
                }
                .sidebar-accordion-wrapper ::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 4px;
                }
                .sidebar-accordion-wrapper:hover ::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.2);
                }
            `}</style>
            
            <div className="flex-1 w-full h-full relative z-0 overflow-y-auto no-scrollbar pb-20">
                {children}
            </div>
        </div>
    );
};

export default SidebarAccordion;
