import React from 'react';
import { ExpertiseProvider } from './context/ExpertiseContext';
import Sidebar from './components/Sidebar';
import Workspace from './components/Workspace';

function App() {
  return (
    <ExpertiseProvider>
      <div className="flex h-screen w-full bg-slate-200">
        <Sidebar />
        <Workspace />
      </div>
    </ExpertiseProvider>
  );
}

export default App;
