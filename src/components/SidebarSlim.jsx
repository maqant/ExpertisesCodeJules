import React from 'react';
import { useSidebarUI } from '../context/SidebarUIContext';
import { Users, Home, FileText, Bot, LayoutList, ChevronRight } from 'lucide-react';

const SidebarSlim = ({ children }) => {
    const { isDrawerOpen, setIsDrawerOpen } = useSidebarUI();

    const icons = [
        { id: 'identification', icon: Users, label: 'Contacts' },
        { id: 'biens', icon: Home, label: 'Biens' },
        { id: 'frais', icon: FileText, label: 'Frais' },
        { id: 'ia', icon: Bot, label: 'IA' },
        { id: 'synthese', icon: LayoutList, label: 'Synthèse' }
    ];

    const handleClick = (id) => {
        setIsDrawerOpen(true);
        // On donne un petit délai pour que l'animation d'ouverture se fasse avant de scroller
        setTimeout(() => {
            const element = document.getElementById(id);
            if (element) {
                // Ouvre le détail si c'est un accordéon fermé
                const details = element.closest('details');
                if (details && !details.open) details.open = true;
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 300);
    };

    return (
        <div className="flex h-full relative z-40 bg-slate-200">
            {/* Slim Column (Icon Drawer) */}
            <div className="w-[60px] hover:w-[200px] group bg-slate-900 border-r border-slate-700 h-full flex flex-col items-start transition-all duration-300 overflow-hidden shrink-0 shadow-2xl z-50">
                <div className="p-4 w-full flex justify-center group-hover:justify-start border-b border-slate-800">
                    <span className="text-indigo-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity ml-2 truncate uppercase text-xs tracking-wider">Expertise</span>
                </div>
                
                <div className="flex-1 w-full space-y-1 mt-2 overflow-y-auto overflow-x-hidden scrollbar-hide">
                    {icons.map((item) => {
                        const Icon = item.icon;
                        return (
                            <button 
                                key={item.id}
                                onClick={() => handleClick(item.id)}
                                className="w-full p-4 flex items-center text-slate-400 hover:text-white hover:bg-slate-800 hover:border-l-2 hover:border-indigo-500 transition-colors"
                                title={item.label}
                            >
                                <Icon className="w-6 h-6 shrink-0" />
                                <span className="ml-4 font-semibold text-sm opacity-0 group-hover:opacity-100 transition-opacity truncate whitespace-nowrap">
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>

                <button 
                    onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                    className="w-full p-4 flex items-center text-slate-500 hover:text-white hover:bg-slate-800 transition-colors border-t border-slate-800 mt-auto"
                >
                    <ChevronRight className={`w-6 h-6 shrink-0 transition-transform duration-300 ${isDrawerOpen ? 'rotate-180' : ''}`} />
                    <span className="ml-4 font-semibold text-xs opacity-0 group-hover:opacity-100 transition-opacity truncate whitespace-nowrap">
                        {isDrawerOpen ? 'Fermer le panneau' : 'Ouvrir le panneau'}
                    </span>
                </button>
            </div>

            {/* Sliding Drawer for Legacy Sidebar Content */}
            <div 
                className={`h-full bg-slate-800 transition-all duration-300 ease-in-out overflow-hidden flex shrink-0 ${isDrawerOpen ? 'w-[450px]' : 'w-0'}`}
            >
                <div className="w-[450px] h-full shrink-0">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default SidebarSlim;
