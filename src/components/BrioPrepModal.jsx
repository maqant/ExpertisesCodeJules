import React, { useState, useContext, useEffect } from 'react';
import { usePromptStore } from '../store/promptStore';
import { runBrioPrepAnalysis } from '../services/generators/generatorEngine';
import { ExpertiseContext } from '../context/ExpertiseContext';

const BrioPrepModal = ({ isOpen, onClose, onContinue }) => {
    const { franchises, aiConfig } = useContext(ExpertiseContext);
    const { getPrompt } = usePromptStore();

    const [mailText, setMailText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [calculatedFranchise, setCalculatedFranchise] = useState('');

    useEffect(() => {
        if (!isOpen) {
            setMailText('');
            setResults(null);
            setError(null);
            setCalculatedFranchise('');
        }
    }, [isOpen]);

    const getFranchiseAmount = (dateString) => {
        if (!dateString || !dateString.includes('/')) return 'Date invalide ou absente';
        const parts = dateString.split('/');
        if (parts.length < 2) return 'Date invalide';
        const monthIndex = parseInt(parts[1], 10) - 1;
        const year = parts.length === 3 ? (parts[2].length === 2 ? '20' + parts[2] : parts[2]) : '20' + parts[1]; // Handle xx/xx/xx or xx/xx

        const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
        if (monthIndex < 0 || monthIndex > 11) return 'Mois invalide';

        const searchString = `${monthNames[monthIndex]} ${year}`;
        const match = franchises.find(f => typeof f === 'string' && f.startsWith(searchString));

        return match ? match.split(' - ')[1] : 'Franchise non trouvée dans la base';
    };

    const handleAnalyze = async () => {
        if (!mailText.trim()) return;
        setIsLoading(true);
        setError(null);

        try {
            const apiKey = aiConfig?.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
            if (!apiKey) {
                throw new Error("Clé API manquante. Veuillez configurer l'IA dans les paramètres.");
            }

            const promptTemplate = getPrompt('prompt_brio_prep');
            const data = await runBrioPrepAnalysis(mailText, apiKey, promptTemplate);
            setResults(data);

            if (data.date) {
                setCalculatedFranchise(getFranchiseAmount(data.date));
            }

        } catch (err) {
            console.error("Brio Prep Error:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = (text) => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            // Optional: visual feedback can be added here
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-slate-900 rounded-xl border border-indigo-500/40 shadow-2xl p-6 w-full max-w-[700px] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <span className="text-xl">🪄</span> Préparation Brio
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">✕</button>
                </div>

                {!results ? (
                    <div className="flex flex-col flex-1 overflow-hidden">
                        <p className="text-xs text-slate-400 mb-2">
                            Collez ici le texte de l'e-mail ou de la déclaration. L'IA va formater les données pour Brio et calculer la franchise.
                        </p>
                        <textarea
                            value={mailText}
                            onChange={(e) => setMailText(e.target.value)}
                            placeholder="Coller le texte brut ici..."
                            className="flex-1 w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-sm text-white focus:border-indigo-500 outline-none resize-none mb-4 min-h-[300px]"
                        />
                        {error && <div className="text-red-400 text-xs mb-3 bg-red-900/20 p-2 rounded border border-red-500/30">{error}</div>}
                        <button
                            onClick={handleAnalyze}
                            disabled={!mailText.trim() || isLoading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg shadow-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                        >
                            {isLoading ? '⏳ Analyse en cours...' : '🧠 Analyser pour Brio'}
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col flex-1 overflow-y-auto pr-2 space-y-4">
                        <p className="text-xs text-indigo-300 font-bold border-b border-slate-700 pb-2 mb-2">
                            Résultats générés. Utilisez les boutons de copie pour Brio.
                        </p>

                        {[
                            { label: "Date", value: results.date },
                            { label: "Franchise (calculée via la date)", value: calculatedFranchise, isHighlight: true },
                            { label: "Titre", value: results.titre },
                            { label: "Description", value: results.description },
                            { label: "Pertes indirectes", value: results.pertes_indirectes },
                            { label: "Délégation", value: results.delegation },
                        ].map((field, idx) => (
                            <div key={idx} className="flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">{field.label}</label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={field.value || ''}
                                        className={`w-full ${field.isHighlight ? 'bg-indigo-900/50 border-indigo-500/50 text-indigo-200' : 'bg-slate-800 border-slate-600 text-white'} border rounded px-3 py-2 text-sm outline-none`}
                                    />
                                </div>
                                <button
                                    onClick={() => handleCopy(field.value)}
                                    className="mt-5 bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded border border-slate-600 transition-colors"
                                    title="Copier"
                                >
                                    📋
                                </button>
                            </div>
                        ))}

                        {/* Intervenants */}
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">Intervenants</label>
                                <textarea
                                    readOnly
                                    value={Array.isArray(results.intervenants) ? results.intervenants.join('\n') : (results.intervenants || '')}
                                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white outline-none resize-none h-24"
                                />
                            </div>
                            <button
                                onClick={() => handleCopy(Array.isArray(results.intervenants) ? results.intervenants.join('\n') : (results.intervenants || ''))}
                                className="mt-5 bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded border border-slate-600 transition-colors h-[42px]"
                                title="Copier la liste"
                            >
                                📋
                            </button>
                        </div>

                        <div className="mt-4 pt-4 border-t border-slate-700 flex justify-end gap-3">
                            <button
                                onClick={() => setResults(null)}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded transition-colors"
                            >
                                🔄 Recommencer
                            </button>
                            <button
                                onClick={() => onContinue(mailText)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded shadow-lg shadow-emerald-500/20 transition-colors"
                            >
                                ➡️ Continuer l'ingestion
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BrioPrepModal;
