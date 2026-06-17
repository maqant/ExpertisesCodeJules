import React, { useContext, useState, useEffect } from 'react';
import { ExpertiseContext } from '../../context/ExpertiseContext';
import { generateAcknowledgmentEmail } from '../../services/generators/generatorEngine';
import { X, Mail, Check, Copy, Loader2, AlertTriangle } from 'lucide-react';

const AcknowledgmentModal = ({ isOpen, onClose }) => {
    const { formData, occupants, aiConfig, isAiModeActive } = useContext(ExpertiseContext);

    const [franchiseInput, setFranchiseInput] = useState('');
    const [ibanInput, setIbanInput] = useState('');
    const [needsFranchise, setNeedsFranchise] = useState(false);
    const [needsIban, setNeedsIban] = useState(false);
    const [askDevis, setAskDevis] = useState(true);
    const [askPlainte, setAskPlainte] = useState(false);

    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedText, setGeneratedText] = useState('');
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);

    // Initialisation conditionnelle
    useEffect(() => {
        if (isOpen) {
            setNeedsFranchise(!formData.franchise);

            // Check IBAN in occupants
            const hasIban = occupants && occupants.some(o => o.iban && o.iban.trim() !== '');
            setNeedsIban(!hasIban);

            setFranchiseInput('');
            setIbanInput('');

            setAskDevis(true); // Always ask by default or adjust based on logic

            // Check if cause indicates vol/vandalisme
            const causeLower = (formData.cause || '').toLowerCase();
            if (causeLower.includes('vol') || causeLower.includes('vandalisme') || causeLower.includes('effraction')) {
                setAskPlainte(true);
            } else {
                setAskPlainte(false);
            }

            setGeneratedText('');
            setError(null);
            setCopied(false);
        }
    }, [isOpen, formData, occupants]);

    if (!isOpen) return null;

    const handleGenerate = async () => {
        if (!isAiModeActive || !aiConfig.apiKey) {
            setError("L'IA n'est pas activée ou la clé API est manquante dans les paramètres.");
            return;
        }

        setIsGenerating(true);
        setError(null);
        setGeneratedText('');
        setCopied(false);

        try {
            const dossierData = { formData, occupants };
            const formSelections = {
                franchiseInput: needsFranchise ? franchiseInput : formData.franchise,
                ibanInput: needsIban ? ibanInput : (occupants?.find(o => o.iban)?.iban || ''),
                askDevis,
                askPlainte
            };

            const text = await generateAcknowledgmentEmail(dossierData, formSelections, aiConfig.apiKey);
            setGeneratedText(text);
        } catch (err) {
            console.error("Erreur lors de la génération de l'AR:", err);
            setError("Une erreur est survenue lors de la génération. Veuillez réessayer.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = () => {
        if (!generatedText) return;
        navigator.clipboard.writeText(generatedText)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            })
            .catch(err => {
                console.error("Erreur copie clipboard", err);
                alert("Erreur lors de la copie.");
            });
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-slate-800">
                        <Mail className="w-5 h-5 text-indigo-500" />
                        <h2 className="text-lg font-semibold">Générer Accusé de Réception (IA)</h2>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">

                    {!isAiModeActive && (
                        <div className="p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p className="text-sm">Le mode IA est désactivé. Veuillez l'activer dans les paramètres pour utiliser cette fonctionnalité.</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-6">
                        {/* Column 1: Informations manquantes */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-slate-700">Informations à ajouter</h3>

                            {needsFranchise && (
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-600">Saisir la franchise</label>
                                    <input
                                        type="text"
                                        value={franchiseInput}
                                        onChange={e => setFranchiseInput(e.target.value)}
                                        placeholder="Ex: 350€"
                                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                                    />
                                </div>
                            )}

                            {needsIban && (
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-600">Demander l'IBAN</label>
                                    <input
                                        type="text"
                                        value={ibanInput}
                                        onChange={e => setIbanInput(e.target.value)}
                                        placeholder="Oui, demander un IBAN"
                                        className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                                    />
                                </div>
                            )}

                            {!needsFranchise && !needsIban && (
                                <p className="text-sm text-slate-500 italic p-2">Toutes les informations (Franchise, IBAN) sont déjà présentes dans le dossier.</p>
                            )}
                        </div>

                        {/* Column 2: Documents manquants */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium text-slate-700">Documents à réclamer</h3>

                            <label className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer">
                                <input type="checkbox" checked={askDevis} onChange={e => setAskDevis(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                <span className="text-sm text-slate-700">Devis de réparation</span>
                            </label>

                            <label className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer">
                                <input type="checkbox" checked={askPlainte} onChange={e => setAskPlainte(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                                <span className="text-sm text-slate-700">Dépôt de plainte (si vol)</span>
                            </label>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-6">
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !isAiModeActive}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                            {isGenerating ? 'Génération en cours...' : 'Générer le brouillon'}
                        </button>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm">
                            {error}
                        </div>
                    )}

                    {generatedText && (
                        <div className="space-y-3 flex-1 flex flex-col min-h-[300px]">
                            <h3 className="text-sm font-medium text-slate-700">Brouillon généré</h3>
                            <textarea
                                readOnly
                                value={generatedText}
                                className="w-full flex-1 p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none resize-none font-sans leading-relaxed"
                            />
                            <button
                                onClick={handleCopy}
                                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-colors ${
                                    copied ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-900 text-white hover:bg-slate-800'
                                }`}
                            >
                                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                {copied ? '✅ Copié !' : 'Copier pour Outlook'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AcknowledgmentModal;
