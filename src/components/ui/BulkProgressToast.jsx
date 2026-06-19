import React from 'react';

const BulkProgressToast = ({ progress, report, onDismiss }) => {
    if (!progress && !report) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999] bg-slate-800 border border-slate-600 rounded-lg shadow-2xl p-4 w-80 flex flex-col gap-3 animate-slide-up">
            {progress && !report ? (
                <>
                    <div className="flex justify-between items-center">
                        <h4 className="text-white font-bold text-sm">Conversion des mails...</h4>
                        <span className="text-indigo-400 text-xs font-mono">{progress.done} / {progress.total}</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                        <div 
                            className="bg-indigo-500 h-2 rounded-full transition-all duration-300" 
                            style={{ width: `${(progress.done / progress.total) * 100}%` }}
                        ></div>
                    </div>
                    <p className="text-slate-400 text-[10px] truncate">En cours : {progress.name}</p>
                </>
            ) : report ? (
                <>
                    <div className="flex justify-between items-start">
                        <h4 className="text-white font-bold text-sm">Conversion terminée</h4>
                        <button onClick={onDismiss} className="text-slate-500 hover:text-white transition-colors">✕</button>
                    </div>
                    <p className="text-xs text-slate-300">
                        ✅ {report.successCount} succès<br/>
                        {report.errorCount > 0 && <span className="text-red-400">❌ {report.errorCount} erreur(s)</span>}
                    </p>
                    {report.errorCount > 0 && (
                        <div className="max-h-24 overflow-y-auto bg-slate-900 rounded p-2 border border-slate-700">
                            <ul className="list-disc list-inside text-[9px] text-red-300">
                                {report.errors.map((err, i) => (
                                    <li key={i} className="truncate" title={err.fileName + ': ' + err.error}>
                                        <span className="font-bold">{err.fileName}</span>: {err.error}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            ) : null}
        </div>
    );
};

export default BulkProgressToast;
