import React from 'react';
import { useSidebarUI } from '../../context/SidebarUIContext';

const SidebarSwitcher = () => {
    const { uiMode, setUiMode } = useSidebarUI();

    return (
        <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-lg border border-slate-600 print:hidden shadow-inner">
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider px-2">UI Mode:</span>
            <button
                onClick={() => setUiMode(0)}
                className={`px-3 py-1 text-xs font-bold rounded transition-colors ${uiMode === 0 ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:bg-slate-700'}`}
                title="Legacy - L'interface classique"
            >
                0: Legacy
            </button>
            <button
                onClick={() => setUiMode(1)}
                className={`px-3 py-1 text-xs font-bold rounded transition-colors ${uiMode === 1 ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:bg-slate-700'}`}
                title="Slim & Expand - Icônes uniquement"
            >
                1: Slim
            </button>
            <button
                onClick={() => setUiMode(3)}
                className={`px-3 py-1 text-xs font-bold rounded transition-colors ${uiMode === 3 ? 'bg-indigo-600 text-white shadow' : 'text-slate-300 hover:bg-slate-700'}`}
                title="Accordion - Focus Mode"
            >
                3: Accordion
            </button>
        </div>
    );
};

export default SidebarSwitcher;
