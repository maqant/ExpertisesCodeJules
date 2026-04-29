import React, { useContext, useState, useEffect, useCallback } from 'react';
import { ExpertiseContext } from '../context/ExpertiseContext';

// mode: 'page+annexes' | 'annexes-only'
const AnnexModal = ({ mode, onClose }) => {
    const context = useContext(ExpertiseContext);
    if (!context) return null;

    const { getAnnexList, downloadSelectedPDF, downloadDossierPDF, isMerging, setPrintSelection } = context;

    const annexList = getAnnexList();

    const buildDefaultSelected = useCallback(() => {
        const set = new Set();
        annexList.forEach(entry => {
            if (entry.isPhotos) set.add(entry.id);
            else set.add(`${entry.id}::${entry.file.dbKey}`);
        });
        return set;
    }, [annexList.length]);

    const [selected, setSelected] = useState(() => buildDefaultSelected());

    // Mode 'page+annexes' : synchronise printSelection pour mise à jour live des index
    useEffect(() => {
        if (mode === 'page+annexes') {
            setPrintSelection(new Set(selected));
        }
    }, [selected, mode]);

    // Nettoyage UNIQUEMENT après la fermeture (pas pendant la génération)
    const handleClose = () => {
        if (mode === 'page+annexes') setPrintSelection(null);
        onClose();
    };

    const toggle = (key) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleAll = (val) => setSelected(val ? buildDefaultSelected() : new Set());

    const defaultSize = buildDefaultSelected().size;
    const allChecked = selected.size === defaultSize;
    const noneChecked = selected.size === 0;

    const handleGenerate = async () => {
        if (selected.size === 0) return alert('Sélectionnez au moins une annexe.');
        if (mode === 'page+annexes') {
            // UN seul PDF : capture la page de garde + les annexes sélectionnées
            // printSelection est déjà synced → indexes corrects sur la page capturée
            await downloadDossierPDF(selected);
            if (mode === 'page+annexes') setPrintSelection(null);
        } else {
            await downloadSelectedPDF(selected);
        }
    };

    const titles = {
        'page+annexes': {
            title: '📦 Page de garde + annexes au choix',
            sub: 'Les index se mettent à jour en temps réel. Un seul PDF sera généré.',
            hint: '⚡ Index de la page de garde mis à jour dynamiquement selon votre sélection.',
            btn: isMerging ? '⏳ Génération...' : '📥 Générer le PDF complet',
        },
        'annexes-only': {
            title: '📋 Annexes seules',
            sub: 'Sélectionnez les annexes à télécharger (sans page de garde).',
            hint: null,
            btn: isMerging ? '⏳ Fusion...' : '📦 Télécharger les annexes',
        },
    };
    const t = titles[mode] || titles['annexes-only'];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                    <div>
                        <h2 className="text-white font-bold text-base">{t.title}</h2>
                        <p className="text-slate-400 text-xs mt-0.5">{t.sub}</p>
                    </div>
                    <button onClick={handleClose} className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
                </div>

                {/* Select all */}
                <div className="flex items-center gap-3 px-5 py-2.5 border-b border-slate-700/50 bg-slate-800/50">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                        <input type="checkbox" checked={allChecked} onChange={e => toggleAll(e.target.checked)} className="w-4 h-4 rounded bg-slate-700" />
                        Tout sélectionner / désélectionner
                    </label>
                    <span className="ml-auto text-xs text-slate-500">{selected.size} / {defaultSize}</span>
                </div>

                {/* Live index hint */}
                {t.hint && (
                    <div className="px-5 py-2 bg-indigo-900/20 border-b border-indigo-700/30">
                        <p className="text-indigo-300 text-[10px]">{t.hint}</p>
                    </div>
                )}

                {/* List */}
                <div className="overflow-y-auto flex-1 p-3 space-y-1">
                    {annexList.length === 0 && (
                        <p className="text-slate-500 italic text-sm text-center py-8">Aucune annexe attachée au dossier.</p>
                    )}
                    {annexList.map((entry, i) => {
                        const key = entry.isPhotos ? entry.id : `${entry.id}::${entry.file.dbKey}`;
                        const isChecked = selected.has(key);
                        return (
                            <label key={key + i} className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer border transition-all ${isChecked ? 'bg-indigo-900/30 border-indigo-500/40' : 'bg-slate-800/40 border-slate-700/40 opacity-50'}`}>
                                <input type="checkbox" checked={isChecked} onChange={() => toggle(key)} className="w-4 h-4 mt-0.5 rounded bg-slate-700 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-white text-xs font-medium truncate">{entry.label}</p>
                                    {entry.isPhotos
                                        ? <p className="text-slate-400 text-[10px]">🖼️/📄 {entry.count} fichier(s) — {entry.totalPages} page(s)</p>
                                        : <p className="text-slate-400 text-[10px]">📄 {entry.file.name} — {entry.file.pages} page(s)</p>
                                    }
                                </div>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${isChecked ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                                    {isChecked ? '✓' : '—'}
                                </span>
                            </label>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-slate-700 flex gap-3">
                    <button onClick={handleClose} className="flex-1 bg-slate-700 hover:bg-slate-600 py-2 rounded-lg text-sm font-bold text-white transition-colors">Annuler</button>
                    <button onClick={handleGenerate} disabled={isMerging || noneChecked} className={`flex-1 py-2 rounded-lg text-sm font-bold text-white transition-colors shadow-lg ${noneChecked || isMerging ? 'bg-indigo-900/40 text-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
                        {t.btn}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AnnexModal;
