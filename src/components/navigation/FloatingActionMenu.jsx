import React, { useState, useRef, useEffect, useContext } from 'react';
import { useSidebarUI } from '../../context/SidebarUIContext';
import { ExpertiseContext } from '../../context/ExpertiseContext';
import packageJson from '../../../package.json';

const UI_MODES = [
  { value: 0, label: '0: Legacy (Classique)' },
  { value: 1, label: '1: Slim (Icônes)' },
  { value: 3, label: '3: Accordion (Focus)' },
  { value: 4, label: '4: Floating (Island)' },
  { value: 5, label: '5: Command (Palette)' },
  { value: 6, label: '6: Dynamic Focus' },
];

const PHASES = [
  { value: 'bureau', label: '🏢 Bureau (Pré)' },
  { value: 'terrain', label: '📱 Terrain (Pendant)' },
  { value: 'tresorerie', label: '💰 Répartition (Post)' },
];

export default function FloatingActionMenu({ viewMode, setViewMode }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const { uiMode, setUiMode, setIsAckModalOpen } = useSidebarUI();
  const { hideAnnexIndex, setHideAnnexIndex } = useContext(ExpertiseContext);

  // Close menu on outside click or Escape key
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleOpenSettings = () => {
    window.dispatchEvent(new CustomEvent('app:open-settings'));
    setOpen(false);
  };

  const handleCopySummary = () => {
    window.dispatchEvent(new CustomEvent('app:copy-raw-summary'));
    setOpen(false);
  };

  const handleOpenBugReport = () => {
    window.open("mailto:maquetantoine@gmail.com?subject=%5BExpertise%20App%5D%20Signalement%20de%20bug%20%2F%20Suggestion", "_blank");
    setOpen(false);
  };

  const handleOpenMailModal = () => {
    setIsAckModalOpen(true);
    setOpen(false);
  };

  return (
    <div ref={menuRef} className="fixed top-4 right-4 z-[9999] print:hidden no-print">
      {/* Trigger Button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        title="Menu d'options et d'actions"
        aria-expanded={open}
        className={`w-11 h-11 rounded-full flex items-center justify-center shadow-xl border-2 transition-all duration-200 cursor-pointer ${
          open
            ? 'bg-indigo-600 text-white border-indigo-400 scale-105 shadow-indigo-500/30'
            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-indigo-400 hover:shadow-2xl'
        }`}
      >
        <span className="text-xl leading-none">⚡</span>
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute right-0 mt-3 w-80 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header Branding */}
          <div className="px-4 py-3 bg-slate-900 text-white flex justify-between items-center">
            <span className="text-xs font-extrabold tracking-wider text-indigo-400">BUREAU PÉCHARD</span>
            <span className="text-[10px] text-slate-400 font-mono">v{packageJson.version}</span>
          </div>

          {/* Phase Selector */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/50">
            <label htmlFor="float-phase-select" className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
              Phase Métier
            </label>
            <select
              id="float-phase-select"
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none cursor-pointer"
            >
              {PHASES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* UI Mode Selector */}
          <div className="p-3 border-b border-slate-100 bg-slate-50/50">
            <label htmlFor="float-ui-select" className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-1">
              Mode d'affichage UI
            </label>
            <select
              id="float-ui-select"
              value={uiMode}
              onChange={(e) => setUiMode(Number(e.target.value))}
              className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none cursor-pointer"
            >
              {UI_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Actions List */}
          <div className="py-2 border-b border-slate-100 space-y-0.5">
            <button
              onClick={handleOpenMailModal}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
            >
              <span className="text-base">✉️</span>
              <span>Ecrire un mail</span>
            </button>

            <button
              onClick={handleOpenSettings}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
            >
              <span className="text-base">⚙️</span>
              <span>Paramètres</span>
            </button>

            <button
              onClick={handleCopySummary}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
            >
              <span className="text-base">📋</span>
              <span>Copier le résumé brut</span>
            </button>

            <button
              onClick={handleOpenBugReport}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors text-left"
            >
              <span className="text-base">🪲</span>
              <span>Bug / Suggestion</span>
            </button>
          </div>

          {/* Toggle Index Visible (Keeps menu open) */}
          <div className="p-3 bg-slate-50/80 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
              <span>👁️</span> Index visible
            </span>
            <button
              onClick={() => setHideAnnexIndex(!hideAnnexIndex)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                !hideAnnexIndex ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  !hideAnnexIndex ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
