import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'
import { initConsoleLogger } from './ai/consoleLogger.js';
import { cleanupTabLockStorage } from './services/migrations/cleanupTabLockStorage.js';

initConsoleLogger();
cleanupTabLockStorage();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
