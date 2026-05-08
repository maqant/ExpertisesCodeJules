import React from 'react';
import { ExpertiseProvider } from './context/ExpertiseContext';
import TresorerieView from "./components/Post/TresorerieView";
import Sidebar from './components/Sidebar';
import Workspace from './components/Workspace';
import TerrainView from './components/Pendant/TerrainView';
import { useState } from 'react';

import packageJson from '../package.json';

function App() {
  const [viewMode, setViewMode] = useState('bureau'); // 'bureau' ou 'terrain'

  return (
    <ExpertiseProvider>
      <div className="flex flex-col h-screen w-full bg-slate-200 relative">

        <div className="bg-slate-900 text-white p-2 flex justify-center gap-4 z-50 shadow-md">
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

        <div className="flex flex-1 overflow-hidden">
          {viewMode === 'bureau' && (
            <>
              <Sidebar />
              <Workspace />
            </>
          )}
          {viewMode === 'terrain' && <TerrainView />}
          {viewMode === 'tresorerie' && <TresorerieView />}
        </div>

        {/* Version Badge */}
        <div className="fixed bottom-2 right-3 text-[10px] text-slate-400/60 font-bold tracking-wider pointer-events-none z-50 print:hidden uppercase">
          v{packageJson.version}
        </div>
      </div>
    </ExpertiseProvider>
  );
}

export default App;
