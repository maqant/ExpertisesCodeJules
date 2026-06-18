import React, { useState, useContext } from 'react';
import { ExpertiseContext } from '../../context/ExpertiseContext';
import { draftMagicEmail, modifyDraftEmail } from '../../services/generators/generatorEngine';
import EmailPreview from '../shared/EmailPreview';
import { X, Mail, Loader2, Sparkles, Wand2, ArrowRight, Minus, Plus, Snowflake, Flame } from 'lucide-react';

const FreeEmailModal = ({ isOpen, onClose }) => {
    const { aiConfig, isAiModeActive } = useContext(ExpertiseContext);
    const [instruction, setInstruction] = useState('');
    const [generatedHtml, setGeneratedHtml] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeModifier, setActiveModifier] = useState(null);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const handleGenerateDraft = async () => {
        if (!instruction.trim()) {
            setError('Veuillez entrer une instruction.');
            return;
        }
        if (!isAiModeActive || !aiConfig.apiKey) {
            setError("L'IA n'est pas activée ou la clé API est manquante.");
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const html = await draftMagicEmail(instruction, aiConfig.apiKey);
            setGeneratedHtml(html);
        } catch (err) {
            console.error(err);
            setError('Erreur lors de la génération.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleModify = async (modifierKey) => {
        if (!generatedHtml) return;
        if (!isAiModeActive || !aiConfig.apiKey) return;

        setIsLoading(true);
        setActiveModifier(modifierKey);
        setError(null);
        try {
            const newHtml = await modifyDraftEmail(generatedHtml, modifierKey, aiConfig.apiKey);
            setGeneratedHtml(newHtml);
        } catch (err) {
            console.error(err);
            setError('Erreur lors de la modification.');
        } finally {
            setIsLoading(false);
            setActiveModifier(null);
        }
    };

    const modifiers = [
        { key: 'rewrite', label: 'Réécrire', icon: Wand2, color: 'text-indigo-600', bg: 'hover:bg-indigo-50 border-indigo-200' },
        { key: 'shorter', label: 'Plus court', icon: Minus, color: 'text-slate-600', bg: 'hover:bg-slate-50 border-slate-200' },
        { key: 'longer', label: 'Plus long', icon: Plus, color: 'text-slate-600', bg: 'hover:bg-slate-50 border-slate-200' },
        { key: 'colder', label: 'Plus froid', icon: Snowflake, color: 'text-cyan-600', bg: 'hover:bg-cyan-50 border-cyan-200' },
        { key: 'warmer', label: 'Plus chaud', icon: Flame, color: 'text-orange-600', bg: 'hover:bg-orange-50 border-orange-200' },
    ];

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-slate-800">
                        <Sparkles className="w-5 h-5 text-indigo-500" />
                        <h2 className="text-lg font-semibold">Génération d'E-mail Libre</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 flex flex-col lg:flex-row gap-6">
                    
                    {/* Colonne de gauche : Instruction */}
                    <div className="w-full lg:w-1/3 flex flex-col gap-4">
                        <div className="flex-1 flex flex-col">
                            <label className="text-sm font-semibold text-slate-700 mb-2">Instructions pour l'IA</label>
                            <textarea
                                value={instruction}
                                onChange={(e) => setInstruction(e.target.value)}
                                placeholder="Ex: Remercier le client pour son appel, lui dire qu'on attend son devis de réparation sous 15 jours. S'il a des questions, il peut me rappeler."
                                className="w-full flex-1 min-h-[150px] p-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all"
                            />
                        </div>

                        <button
                            onClick={handleGenerateDraft}
                            disabled={isLoading || !instruction.trim()}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                            {isLoading && !activeModifier ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Rédaction en cours...</>
                            ) : (
                                <><Mail className="w-4 h-4" /> Rédiger l'e-mail</>
                            )}
                        </button>

                        {error && (
                            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm">{error}</div>
                        )}

                        {generatedHtml && (
                            <div className="mt-4 border-t border-slate-100 pt-4">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 block">Ajustements magiques</label>
                                <div className="flex flex-wrap gap-2">
                                    {modifiers.map((mod) => {
                                        const Icon = mod.icon;
                                        const isModLoading = isLoading && activeModifier === mod.key;
                                        return (
                                            <button
                                                key={mod.key}
                                                onClick={() => handleModify(mod.key)}
                                                disabled={isLoading}
                                                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white border rounded-md transition-all ${mod.bg} ${mod.color} disabled:opacity-50`}
                                            >
                                                {isModLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
                                                {mod.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Colonne de droite : Aperçu */}
                    <div className="w-full lg:w-2/3 flex flex-col">
                        <EmailPreview 
                            htmlText={generatedHtml} 
                            isFinalized={!!generatedHtml && !isLoading}
                            onContentChange={(newHtml) => setGeneratedHtml(newHtml)} 
                        />
                    </div>

                </div>
            </div>
        </div>
    );
};

export default FreeEmailModal;
