import React, { useContext, useState, useRef, useEffect } from 'react';
import { ExpertiseContext } from '../context/ExpertiseContext';

export default function DebugConsole() {
    const { isDebugMode, debugLogs, clearDebugLogs } = useContext(ExpertiseContext);
    const [isMinimized, setIsMinimized] = useState(false);
    const logsEndRef = useRef(null);

    useEffect(() => {
        if (!isMinimized && logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [debugLogs, isMinimized]);

    if (!isDebugMode) return null;

    const copyLogsForAI = () => {
        const logString = JSON.stringify(debugLogs, null, 2);
        navigator.clipboard.writeText(`Voici les logs de mon application pour le debug :\n\n${logString}`);
        alert('Logs copiés dans le presse-papier ! Vous pouvez les coller à l\'IA.');
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
        <div className="fixed bottom-0 left-0 right-0 h-64 bg-gray-900 text-gray-100 p-4 overflow-y-auto border-t border-gray-700 z-[10000] shadow-2xl opacity-95">
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-gray-900/90 pb-2 z-10">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    <span className="animate-pulse h-2 w-2 bg-red-500 rounded-full"></span>
                    Console Développeur
                </h3>
                <div className="flex gap-2">
                    <button onClick={clearDebugLogs} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors">Effacer</button>
                    <button onClick={copyLogsForAI} className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm transition-colors font-medium">📋 Copier pour l'IA</button>
                    <button onClick={() => setIsMinimized(true)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm transition-colors font-bold ml-2 flex items-center gap-2">
                        <span>_</span> Réduire
                    </button>
                </div>
            </div>
            <div className="space-y-2 font-mono text-xs">
                {debugLogs.length === 0 ? <p className="text-gray-500 italic">En attente d'événements...</p> : 
                    debugLogs.map(log => (
                        <div key={log.id} className="border-b border-gray-800 pb-2 relative group">
                            <div className="flex items-start gap-3 pr-10">
                                <span className="text-gray-500 min-w-[70px]">{log.time}</span>
                                <span className={`font-bold min-w-[120px] ${getStatusColor(log.status)}`}>[{log.step}]</span>
                                <span className="flex-1 break-words">{log.status === 'ERROR' ? (log.error?.message || log.error) : 'Traitement terminé'}</span>
                            </div>
                            <button
                                onClick={() => navigator.clipboard.writeText(JSON.stringify(log, null, 2))}
                                className="absolute top-0 right-0 p-1 bg-gray-800 hover:bg-gray-700 rounded opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                                title="Copier ce log"
                            >
                                📋
                            </button>
                            {log.data && (
                                <pre className="mt-1 ml-[200px] text-gray-400 bg-gray-950 p-2 rounded overflow-x-auto">
                                    {typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}
                                </pre>
                            )}
                        </div>
                    ))
                }
                <div ref={logsEndRef} />
            </div>
        </div>
    );
}
