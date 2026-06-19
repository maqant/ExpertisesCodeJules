import React from 'react';
import { AlertTriangle, RefreshCw, Eye, LockOpen } from 'lucide-react';

/**
 * Modale affichée lorsqu'un onglet tente d'ouvrir un dossier déjà verrouillé.
 * @param {object} props
 * @param {boolean} props.isOpen
 * @param {boolean} props.isStale
 * @param {()=>void} props.onRetry
 * @param {()=>void} props.onReadOnly
 * @param {()=>void} props.onForceEdit
 */
export default function DossierLockModal({ isOpen, isStale, onRetry, onReadOnly, onForceEdit }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-slate-800 border border-amber-500/50 shadow-2xl shadow-amber-500/20 rounded-xl w-full max-w-lg overflow-hidden">
                <div className="bg-amber-500/10 p-4 border-b border-amber-500/20 flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-amber-500" />
                    <h2 className="text-lg font-bold text-amber-400">Dossier en cours d'édition</h2>
                </div>
                
                <div className="p-6 text-slate-300 space-y-4">
                    <p>
                        Ce dossier est déjà ouvert dans un <strong>autre onglet</strong> ou une <strong>autre fenêtre</strong>.
                    </p>
                    <p className="text-sm text-slate-400 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                        Pour éviter toute perte de données ou écrasement concurrent, l'édition simultanée n'est pas autorisée. Veuillez fermer l'autre onglet avant de continuer.
                    </p>
                </div>

                <div className="p-4 bg-slate-900/50 border-t border-slate-700 flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={onRetry}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        J'ai fermé l'onglet, réessayer
                    </button>
                    
                    <button
                        onClick={onReadOnly}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                    >
                        <Eye className="w-4 h-4" />
                        Ouvrir en lecture seule
                    </button>
                </div>

                {isStale && (
                    <div className="p-4 bg-red-500/10 border-t border-red-500/20">
                        <p className="text-xs text-red-400 mb-2">
                            Le verrou semble inactif. L'autre onglet a peut-être planté ou a été fermé brutalement. Vous pouvez forcer l'édition.
                        </p>
                        <button
                            onClick={onForceEdit}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-500 text-white font-medium rounded-lg transition-colors"
                        >
                            <LockOpen className="w-4 h-4" />
                            Forcer l'édition (Risque de conflit)
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
