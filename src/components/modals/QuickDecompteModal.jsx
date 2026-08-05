import React, { useState } from 'react';
import { useSidebarUI } from '../../context/SidebarUIContext';
import { generateDocument } from '../../services/generators/generatorEngine.js';
import GeneratedDocModal from '../GeneratedDocModal';

// Modèle vide d'un décompte
const emptyExpense = () => ({
    id: crypto.randomUUID(),
    desc: '',
    montant: '',
    tva: '',
    facturePar: '',
    compteDe: 'unassigned',
});

const QuickDecompteModal = () => {
    const { isQuickDecompteOpen, setIsQuickDecompteOpen } = useSidebarUI();

    const [expenses, setExpenses] = useState([emptyExpense()]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedText, setGeneratedText] = useState(null);
    const [isResultOpen, setIsResultOpen] = useState(false);

    if (!isQuickDecompteOpen) return null;

    const handleClose = () => {
        setIsQuickDecompteOpen(false);
        setExpenses([emptyExpense()]);
        setGeneratedText(null);
    };

    const addExpense = () => setExpenses(prev => [...prev, emptyExpense()]);
    const removeExpense = (id) => setExpenses(prev => prev.filter(e => e.id !== id));
    const updateExpense = (id, field, value) =>
        setExpenses(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));

    const handleGenerate = async () => {
        const validExpenses = expenses.filter(e => e.desc.trim() || e.montant.trim());
        if (validExpenses.length === 0) {
            alert('Ajoutez au moins un décompte.');
            return;
        }
        setIsGenerating(true);
        try {
            // On passe un dossierState minimal — generateDocument lit la clé API depuis localStorage en fallback
            const text = await generateDocument('declaration', {
                formData: {},
                rawContexts: {},
                references: [],
                occupants: [],
                expenses: validExpenses,
            });
            setGeneratedText(text);
            setIsResultOpen(true);
        } catch (err) {
            console.error('[QuickDecompte] Erreur:', err);
            alert('Erreur de génération : ' + err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <>
            {/* Modale principale Gestionnaire Financier Rapide */}
            <div
                className="fixed inset-0 z-[10000] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 print:hidden"
                onClick={handleClose}
            >
                <div
                    className="bg-slate-900 text-slate-100 rounded-2xl w-full max-w-lg border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80 shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">📊</span>
                            <div>
                                <h2 className="text-sm font-extrabold text-white">Gestionnaire Financier Rapide</h2>
                                <p className="text-[10px] text-slate-400">Décompte à la volée → Mail IA</p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors font-bold text-sm"
                            aria-label="Fermer"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Liste des décomptes */}
                    <div className="p-4 flex-1 overflow-y-auto space-y-2">
                        {expenses.map((exp, idx) => (
                            <div
                                key={exp.id}
                                className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 space-y-2"
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wide">
                                        Décompte #{idx + 1}
                                    </span>
                                    {expenses.length > 1 && (
                                        <button
                                            onClick={() => removeExpense(exp.id)}
                                            className="text-slate-500 hover:text-red-400 text-xs transition-colors"
                                            title="Supprimer"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        placeholder="Description (ex: Honoraires)"
                                        value={exp.desc}
                                        onChange={(e) => updateExpense(exp.id, 'desc', e.target.value)}
                                        className="col-span-2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition-all"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Montant (ex: 350.00)"
                                        value={exp.montant}
                                        onChange={(e) => updateExpense(exp.id, 'montant', e.target.value)}
                                        className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition-all"
                                    />
                                    <input
                                        type="text"
                                        placeholder="TVA (ex: 6% ou vide)"
                                        value={exp.tva}
                                        onChange={(e) => updateExpense(exp.id, 'tva', e.target.value)}
                                        className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition-all"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Facturé par (ex: Bureau Péchard)"
                                        value={exp.facturePar}
                                        onChange={(e) => updateExpense(exp.id, 'facturePar', e.target.value)}
                                        className="col-span-2 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={addExpense}
                            className="w-full py-2 border border-dashed border-slate-600 hover:border-indigo-500 text-slate-400 hover:text-indigo-400 rounded-xl text-xs font-bold transition-all"
                        >
                            + Ajouter un décompte
                        </button>
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/80 shrink-0">
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold py-2.5 px-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-xs"
                        >
                            {isGenerating ? (
                                <><span className="animate-spin">🌀</span> Génération en cours...</>
                            ) : (
                                <><span>🤖</span> Générer le mail de décompte (IA)</>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Réutilisation de la GeneratedDocModal existante pour afficher le résultat */}
            <GeneratedDocModal
                isOpen={isResultOpen}
                generatedText={generatedText}
                onClose={() => { setIsResultOpen(false); setGeneratedText(null); }}
            />
        </>
    );
};

export default QuickDecompteModal;
