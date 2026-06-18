import React, { useContext, useState, useEffect, useMemo } from 'react';
import { ExpertiseContext } from '../../context/ExpertiseContext';
import { generateAcknowledgmentEmail } from '../../services/generators/generatorEngine';
import { evaluateClaims } from '../../domain/claims/claimEngine';
import { extractEmailsForOutlook } from '../../services/utils/contactUtils';
import { X, Mail, Check, Copy, Loader2, AlertTriangle, FileText, User, CopyPlus } from 'lucide-react';

const AcknowledgmentModal = ({ isOpen, onClose }) => {
    const { formData, occupants, expenses, aiConfig, isAiModeActive } = useContext(ExpertiseContext);

    // Gaps statu
    const [dossierClaimsState, setDossierClaimsState] = useState({}); // { id: boolean }
    const [partiesClaimsState, setPartiesClaimsState] = useState({}); // { partyId: { claimId: boolean } }
    
    // UI Metadata pour le rendu (initialisé au mount)
    const [dossierClaimsMeta, setDossierClaimsMeta] = useState([]);
    const [partiesClaimsMeta, setPartiesClaimsMeta] = useState([]);

    const [franchiseInput, setFranchiseInput] = useState('');
    const [showFranchiseInput, setShowFranchiseInput] = useState(false);

    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedText, setGeneratedText] = useState('');
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);
    const [emailsCopied, setEmailsCopied] = useState(false);

    // Initialisation
    useEffect(() => {
        if (isOpen) {
            const { dossier, parties } = evaluateClaims(formData, occupants, expenses);
            
            setDossierClaimsMeta(dossier);
            setPartiesClaimsMeta(parties);

            // Init State
            const initDossierState = {};
            dossier.forEach(c => initDossierState[c.id] = c.isChecked);
            setDossierClaimsState(initDossierState);

            const initPartiesState = {};
            parties.forEach(p => {
                initPartiesState[p.id] = {};
                p.claims.forEach(c => initPartiesState[p.id][c.id] = c.isChecked);
            });
            setPartiesClaimsState(initPartiesState);

            const existingFranchise = formData?.franchise?.trim();
            if (existingFranchise) {
                setFranchiseInput(existingFranchise);
                setShowFranchiseInput(false);
            } else {
                setFranchiseInput('');
                setShowFranchiseInput(true);
            }
            
            setGeneratedText('');
            setError(null);
            setCopied(false);
            setEmailsCopied(false);
        }
    }, [isOpen, formData, occupants, expenses]);

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
            const dossierData = { formData, occupants, expenses };
            
            // Reconstruct a simplified formSelections object based on checked state
            // that promptStore and generatorEngine can understand easily
            const formSelections = {
                franchiseInput: showFranchiseInput ? franchiseInput : formData.franchise,
                // On garde la rétro-compatibilité avec les vieux identifiants pour l'instant si promptStore les utilise
                askDevis: dossierClaimsState['DEVIS'] || false,
                askPlainte: dossierClaimsState['PLAINTE'] || false,
                askCauseDetail: dossierClaimsState['CAUSE_DETAIL'] || false,
                // Nouveau format pour partiesGaps (generatorEngine s'adaptera)
                partiesGaps: partiesClaimsMeta.map(partyMeta => {
                    const checkedClaimsIds = Object.keys(partiesClaimsState[partyMeta.id] || {})
                        .filter(claimId => partiesClaimsState[partyMeta.id][claimId]);
                    
                    const checkedLabels = partyMeta.claims
                        .filter(c => checkedClaimsIds.includes(c.id))
                        .map(c => c.label);

                    return {
                        id: partyMeta.id,
                        nom: partyMeta.nom,
                        prenom: partyMeta.prenom,
                        statut: partyMeta.statut,
                        manques: checkedLabels
                    };
                }).filter(p => p.manques.length > 0)
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

    const handleCopyEmails = () => {
        const emails = extractEmailsForOutlook(occupants);
        if (!emails) {
            alert("Aucune adresse e-mail trouvée dans les occupants du dossier.");
            return;
        }
        navigator.clipboard.writeText(emails)
            .then(() => {
                setEmailsCopied(true);
                setTimeout(() => setEmailsCopied(false), 2000);
            })
            .catch(err => console.error("Erreur copie emails", err));
    };

    const toggleDossierClaim = (id) => {
        setDossierClaimsState(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const togglePartyClaim = (partyId, claimId) => {
        setPartiesClaimsState(prev => ({
            ...prev,
            [partyId]: {
                ...prev[partyId],
                [claimId]: !prev[partyId][claimId]
            }
        }));
    };

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-2 text-slate-800">
                        <Mail className="w-5 h-5 text-indigo-500" />
                        <h2 className="text-lg font-semibold">Accusé de Réception Modulaire</h2>
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

                    <div className="flex justify-between items-center bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                        <p className="text-sm text-indigo-800">
                            Cochez les éléments que vous souhaitez explicitement réclamer dans l'email.
                        </p>
                        <button 
                            onClick={handleCopyEmails}
                            className="flex items-center gap-1.5 text-xs font-medium bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-md hover:bg-indigo-50 transition-colors shadow-sm"
                        >
                            {emailsCopied ? <Check className="w-4 h-4 text-emerald-600"/> : <CopyPlus className="w-4 h-4"/>}
                            {emailsCopied ? 'Copié !' : 'Copier les e-mails'}
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        {/* Column 1: Config */}
                        <div className="space-y-6">
                            
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 border-b pb-2">
                                    <FileText className="w-4 h-4 text-slate-500"/>
                                    Documents du Dossier
                                </h3>
                                
                                {dossierClaimsMeta.map(claim => (
                                    <label key={claim.id} className="flex items-start gap-3 p-2 rounded hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={!!dossierClaimsState[claim.id]} 
                                            onChange={() => toggleDossierClaim(claim.id)} 
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 mt-0.5" 
                                        />
                                        <span className="text-sm text-slate-700 font-medium">{claim.label}</span>
                                    </label>
                                ))}
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 border-b pb-2">
                                    <User className="w-4 h-4 text-slate-500"/>
                                    Demandes par Partie
                                </h3>
                                
                                {partiesClaimsMeta.length === 0 ? (
                                    <p className="text-xs text-emerald-600 bg-emerald-50 p-2 rounded border border-emerald-100 italic">Aucune partie n'a de documents réclamables selon son statut.</p>
                                ) : (
                                    partiesClaimsMeta.map(party => (
                                        <div key={party.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                            <div className="font-medium text-slate-800 text-sm mb-2">{party.nom} {party.prenom} <span className="text-xs text-slate-500 font-normal">({party.statut})</span></div>
                                            <div className="space-y-1">
                                                {party.claims.map(claim => (
                                                    <label key={claim.id} className="flex items-start gap-2 px-2 py-1 hover:bg-slate-100 rounded cursor-pointer">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={!!partiesClaimsState[party.id]?.[claim.id]} 
                                                            onChange={() => togglePartyClaim(party.id, claim.id)} 
                                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3 h-3 mt-0.5" 
                                                        />
                                                        <span className="text-xs text-slate-600">{claim.label}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-slate-800 border-b pb-2">Informations Générales</h3>
                                <div>
                                    <label className="text-xs font-medium text-slate-600 block mb-1">Franchise à mentionner</label>
                                    
                                    {!showFranchiseInput ? (
                                        <div className="flex items-center gap-3">
                                            <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-md border border-emerald-200">
                                                {formData.franchise}
                                            </div>
                                            <button 
                                                onClick={() => setShowFranchiseInput(true)}
                                                className="text-xs text-indigo-600 hover:underline"
                                            >
                                                Modifier pour ce mail
                                            </button>
                                        </div>
                                    ) : (
                                        <input
                                            type="text"
                                            value={franchiseInput}
                                            onChange={e => setFranchiseInput(e.target.value)}
                                            placeholder="Ex: 350€ (laisser vide si inconnue)"
                                            className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                                        />
                                    )}
                                </div>
                            </div>
                            
                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating || !isAiModeActive}
                                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-200 mt-4"
                            >
                                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                                {isGenerating ? 'Génération en cours...' : 'Générer l\'email'}
                            </button>
                            
                            {error && (
                                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm">
                                    {error}
                                </div>
                            )}
                        </div>

                        {/* Column 2: Result */}
                        <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-xl overflow-hidden relative">
                            <div className="bg-slate-100 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
                                <h3 className="text-sm font-semibold text-slate-700">Aperçu Outlook</h3>
                                {generatedText && (
                                    <button
                                        onClick={handleCopy}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                            copied ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                        {copied ? 'Copié !' : 'Copier'}
                                    </button>
                                )}
                            </div>
                            
                            {generatedText ? (
                                <textarea
                                    readOnly
                                    value={generatedText}
                                    className="w-full flex-1 p-5 bg-transparent text-sm text-slate-800 focus:outline-none resize-none font-sans leading-relaxed whitespace-pre-wrap"
                                />
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center space-y-4">
                                    <Mail className="w-12 h-12 text-slate-200" />
                                    <p className="text-sm">Sélectionnez les options à gauche et cliquez sur Générer pour voir le brouillon d'email apparaître ici.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AcknowledgmentModal;
