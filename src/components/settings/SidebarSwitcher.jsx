import React from 'react';
import { useSidebarUI } from '../../context/SidebarUIContext';

const SidebarSwitcher = () => {
    const { uiMode, setUiMode } = useSidebarUI();

    return (
        <div className="flex items-center gap-1.5 bg-slate-800/90 px-2 py-1 rounded-lg border border-slate-700 print:hidden shadow-sm">
            <label htmlFor="ui-mode-select" className="text-[10px] text-slate-400 font-bold tracking-wider uppercase whitespace-nowrap">
                Vue :
            </label>
            <select
                id="ui-mode-select"
                value={uiMode}
                onChange={(e) => setUiMode(Number(e.target.value))}
                className="bg-slate-900 text-indigo-300 text-xs font-bold px-2 py-1 rounded border border-slate-600 focus:border-indigo-500 outline-none cursor-pointer hover:bg-slate-850 transition-colors"
                title="Changer le mode d'affichage de l'interface"
            >
                <option value={0}>0: Legacy (Classique)</option>
                <option value={1}>1: Slim (Icônes)</option>
                <option value={3}>3: Accordion (Focus)</option>
                <option value={4}>4: Floating (Island)</option>
                <option value={5}>5: Command (Palette)</option>
                <option value={6}>6: Dynamic Focus</option>
            </select>
        </div>
    );
};

export default SidebarSwitcher;
