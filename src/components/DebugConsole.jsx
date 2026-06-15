import React, { useContext, useState, useRef, useEffect } from 'react';
import { ExpertiseContext } from '../context/ExpertiseContext';

export default function DebugConsole() {
    const { isDebugMode, debugLogs, clearDebugLogs, logHistory, clearLogHistory } = useContext(ExpertiseContext);
    const [isMinimized, setIsMinimized] = useState(false);
    const [activeTab, setActiveTab] = useState('current'); // 'current' | 'history'
    const logsEndRef = useRef(null);

    useEffect(() => {
        if (!isMinimized && activeTab === 'current' && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [debugLogs, isMinimized, activeTab]);

    if (!isDebugMode) return null;

    const copyLogsForAI = () => {
        const logString = JSON.stringify(activeTab === 'current' ? debugLogs : logHistory, null, 2);
        navigator.clipboard.writeText(`Voici les logs de mon application pour le debug :\n\n${logString}`);
        alert('Logs copiés dans le presse-papier ! Vous pouvez les coller à l\'IA.');
    };

    const exportHistoryJSON = () => {
        if (!logHistory || logHistory.length === 0) {
            alert("L'historique est vide.");
            return;
        }
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logHistory, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "expertises_logs_history.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    const getStatusColor = (status) => {
        if (status === 'ERROR') return 'text-red-500';
        if (status === 'SUCCESS') return 'text-green-500';
        if (status === 'WARNING') return 'text-yellow-500';
        return 'text-blue-400';
    };

    if (isMinimized) {
        return (
            <button 
                onClick={() => setIsMinimized(false)}
                className="fixed bottom-4 left-4 bg-gray-900 text-gray-100 px-4 py-2 rounded-full shadow-2xl border border-gray-700 z-[10000] hover:bg-gray-800 flex items-center gap-2 transition-transform hover:scale-105 font-bold text-sm"
            >
                <span className="animate-pulse h-2 w-2 bg-red-500 rounded-full"></span>
                🐞 Console ({debugLogs.length})
            </button>
        );
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 h-64 bg-gray-900 text-gray-100 flex flex-col border-t border-gray-700 z-[10000] shadow-2xl opacity-95">
            <div className="flex justify-between items-center p-2 bg-gray-900/90 border-b border-gray-800 shrink-0">
                <div className="flex items-center gap-4">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-white">
                        <span className="animate-pulse h-2 w-2 bg-red-500 rounded-full"></span>
                        Console Développeur
                    </h3>
                    <div className="flex gap-1 bg-gray-800 rounded p-0.5">
                        <button 
                            onClick={() => setActiveTab('current')} 
                            className={`px-3 py-1 rounded text-sm font-bold transition-colors ${activeTab === 'current' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            En cours ({debugLogs.length})
                        </button>
                        <button 
                            onClick={() => setActiveTab('history')} 
                            className={`px-3 py-1 rounded text-sm font-bold transition-colors ${activeTab === 'history' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                            Historique ({logHistory?.length || 0})
                        </button>
                    </div>
                </div>
                <div className="flex gap-2">
                    {activeTab === 'current' ? (
                        <button onClick={clearDebugLogs} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors">Effacer En cours</button>
                    ) : (
                        <>
                            <button onClick={exportHistoryJSON} className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-sm transition-colors font-bold">📥 Exporter JSON</button>
                            <button onClick={clearLogHistory} className="px-3 py-1 bg-red-900/80 hover:bg-red-800 text-red-200 rounded text-sm transition-colors">Vider l'historique</button>
                        </>
                    )}
                    <button onClick={copyLogsForAI} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm transition-colors font-medium">📋 Copier pour l'IA</button>
                    <button onClick={() => setIsMinimized(true)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm transition-colors font-bold ml-2 flex items-center gap-2">
                        <span>_</span> Réduire
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
                {activeTab === 'current' && (
                    <>
                        {debugLogs.length === 0 ? <p className="text-gray-500 italic">En attente d'événements...</p> : 
                            debugLogs.map(log => (
                                <div key={log.id} className="border-b border-gray-800 pb-2 relative group">
                                    <div className="flex items-start gap-3 pr-10">
                                        <span className="text-gray-500 min-w-[70px]">{log.time}</span>
                                        <span className={`font-bold min-w-[120px] ${getStatusColor(log.status)}`}>[{log.step}]</span>
                                        <span className="flex-1 break-words">{log.status === 'ERROR' ? (log.error?.message || log.error) : 'Traitement terminé'}</span>
                                    </div>
                                    {log.data && (
                                        <pre className="mt-1 ml-[200px] text-gray-400 bg-gray-950 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                                            {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
                                        </pre>
                                    )}
                                </div>
                            ))
                        }
                        <div ref={logsEndRef} />
                    </>
                )}

                {activeTab === 'history' && (
                    <>
                        {!logHistory || logHistory.length === 0 ? <p className="text-gray-500 italic">Aucune session enregistrée.</p> :
                            logHistory.map((session, i) => (
                                <div key={session.id} className="border border-gray-700 bg-gray-800/30 rounded p-3 mb-3">
                                    <h4 className="text-indigo-300 font-bold mb-2 flex justify-between">
                                        <span>Session #{logHistory.length - i} — {session.date}</span>
                                        <span className="text-gray-400 font-normal">{session.logs.length} événements</span>
                                    </h4>
                                    <div className="max-h-40 overflow-y-auto space-y-1 bg-gray-950/50 p-2 rounded border border-gray-800">
                                        {session.logs.map(log => (
                                            <div key={log.id} className="flex items-start gap-2 text-[10px]">
                                                <span className="text-gray-600">{log.time}</span>
                                                <span className={`${getStatusColor(log.status)} w-24 shrink-0`}>[{log.step}]</span>
                                                <span className="text-gray-400 break-words">{typeof log.data === 'string' ? log.data.substring(0, 150) + (log.data.length > 150 ? '...' : '') : '...'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        }
                    </>
                )}
            </div>
        </div>
    );
}
