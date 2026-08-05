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
import FloatingActionMenu from './components/navigation/FloatingActionMenu';
import { useState } from 'react';

import packageJson from '../package.json';

function App() {
  const [viewMode, setViewMode] = useState('bureau'); // 'bureau' ou 'terrain'

  return (
    <ExpertiseProvider>
      <IngestionPipelineProvider>
        <SidebarUIProvider>
          <div className="flex flex-col h-screen w-full bg-slate-200 relative print:h-auto print:overflow-visible print:bg-white">

            {/* Menu d'actions déroulant flottant en haut à droite */}
            <FloatingActionMenu viewMode={viewMode} setViewMode={setViewMode} />

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

