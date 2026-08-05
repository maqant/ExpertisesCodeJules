import React from 'react';
import { ExpertiseProvider } from './context/ExpertiseContext';
import { IngestionPipelineProvider } from './pipeline/IngestionPipelineContext';
import { SmartBridgeOrchestrator } from './pipeline/SmartBridgeOrchestrator';
import TresorerieView from "./components/Post/TresorerieView";
import Sidebar from './components/Sidebar';
import { SidebarUIProvider } from './context/SidebarUIContext';
import Workspace from './components/Workspace';
import TerrainView from './components/Pendant/TerrainView';
import GlobalValidationModal from './components/GlobalValidationModal';
import DebugConsole from './components/DebugConsole';
import SidebarSwitcher from './components/settings/SidebarSwitcher';
import { useState } from 'react';

import packageJson from '../package.json';

function App() {
  const [viewMode, setViewMode] = useState('bureau'); // 'bureau' ou 'terrain'

  return (
    <ExpertiseProvider>
      <IngestionPipelineProvider>
        <SidebarUIProvider>
          <div className="flex flex-col h-screen w-full bg-slate-200 relative print:h-auto print:overflow-visible print:bg-white">

            <div className="bg-slate-900 text-white px-4 py-1.5 flex justify-between items-center z-50 shadow-md print:hidden no-print">
              {/* Branding discret à gauche */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-400 tracking-wider">BUREAU PÉCHARD</span>
                <span className="text-[10px] text-slate-500 font-mono">v{packageJson.version}</span>
              </div>

              {/* Navigation compacte à droite */}
              <div className="flex items-center gap-3">
                {/* Sélecteur de Phase Métier */}
                <div className="flex items-center gap-1.5 bg-slate-800/90 px-2 py-1 rounded-lg border border-slate-700 shadow-sm">
                  <label htmlFor="view-phase-select" className="text-[10px] text-slate-400 font-bold tracking-wider uppercase whitespace-nowrap">
                    Phase :
                  </label>
                  <select
                    id="view-phase-select"
                    value={viewMode}
                    onChange={(e) => setViewMode(e.target.value)}
                    className="bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded border border-slate-600 focus:border-indigo-500 outline-none cursor-pointer hover:bg-slate-850 transition-colors"
                  >
                    <option value="bureau">🏢 Bureau (Pré)</option>
                    <option value="terrain">📱 Terrain (Pendant)</option>
                    <option value="tresorerie">💰 Répartition (Post)</option>
                  </select>
                </div>

                {/* Sélecteur de Mode d'Affichage UI */}
                <SidebarSwitcher />
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden print:overflow-visible print:block">
              {viewMode === 'bureau' && (
                <>
                  <Sidebar />
                  <Workspace />
                </>
              )}
              {viewMode === 'terrain' && <TerrainView />}
              {viewMode === 'tresorerie' && <TresorerieView />}
            </div>

            {/* Global AI Validation Modal */}
            <GlobalValidationModal />

            {/* Orchestrateur du Smart Bridge (Modale 1 revue/copie) */}
            <SmartBridgeOrchestrator />

            {/* Version Badge */}
            <div className="fixed bottom-2 right-40 text-[10px] text-slate-400/60 font-bold tracking-wider pointer-events-none z-50 print:hidden uppercase">
              v{packageJson.version}
            </div>

            {/* Console de débogage v6.2.0 */}
            <DebugConsole />
          </div>
        </SidebarUIProvider>
      </IngestionPipelineProvider>
    </ExpertiseProvider>
  );
}

export default App;

