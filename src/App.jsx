import React from 'react';
import { ExpertiseProvider } from './context/ExpertiseContext';
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
      <SidebarUIProvider>
        <div className="flex flex-col h-screen w-full bg-slate-200 relative print:h-auto print:overflow-visible print:bg-white">

          <div className="bg-slate-900 text-white p-2 flex justify-between items-center z-50 shadow-md print:hidden no-print">
            {/* Colonne de gauche (vide pour équilibrer) */}
            <div className="w-1/3"></div>

            {/* Navigation centrale */}
            <div className="flex justify-center gap-4 w-1/3">
              <button
                className={`px-4 py-1 rounded font-bold transition-colors ${viewMode === 'bureau' ? 'bg-indigo-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                onClick={() => setViewMode('bureau')}
              >
                🏢 Bureau (Pré)
              </button>
              <button
                className={`px-4 py-1 rounded font-bold transition-colors ${viewMode === 'terrain' ? 'bg-emerald-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                onClick={() => setViewMode('terrain')}
              >
                📱 Terrain (Pendant)
              </button>
              <button
                className={`px-4 py-1 rounded font-bold transition-colors ${viewMode === 'tresorerie' ? 'bg-amber-600' : 'bg-slate-700 hover:bg-slate-600'}`}
                onClick={() => setViewMode('tresorerie')}
              >
                💰 Répartition (Post)
              </button>
            </div>

            {/* Colonne de droite (Sélecteur UI) */}
            <div className="flex justify-end w-1/3 pr-4">
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

          {/* Version Badge */}
          <div className="fixed bottom-2 right-40 text-[10px] text-slate-400/60 font-bold tracking-wider pointer-events-none z-50 print:hidden uppercase">
            v{packageJson.version}
          </div>

          {/* Console de débogage v6.2.0 */}
          <DebugConsole />
        </div>
      </SidebarUIProvider>
    </ExpertiseProvider>
  );
}

export default App;

