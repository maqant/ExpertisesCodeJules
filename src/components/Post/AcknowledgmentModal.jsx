// AcknowledgmentModal.jsx — AR v2
import React, { useContext, useState, useEffect, useRef } from 'react';
import { ExpertiseContext } from '../../context/ExpertiseContext';
import { generateAcknowledgmentEmail, analyzeNarrativeCause, runArFinisher } from '../../services/generators/generatorEngine';
import { evaluateClaims } from '../../domain/claims/claimEngine';
import { extractEmailsForOutlook } from '../../services/utils/contactUtils';
import {
    X, Mail, Check, Copy, Loader2, AlertTriangle, FileText, User, CopyPlus, ChevronDown, ChevronRight, Sparkles, Wand2
} from 'lucide-react';

const AcknowledgmentModal = ({ isOpen, onClose }) => {
    const { formData, occupants, expenses, aiConfig, isAiModeActive } = useContext(ExpertiseContext);

    // Claims state
    const [dossierClaimsState, setDossierClaimsState] = useState({});
    const [partiesClaimsState, setPartiesClaimsState] = useState({});
    const [dossierClaimsMeta, setDossierClaimsMeta] = useState([]);
    const [partiesClaimsMeta, setPartiesClaimsMeta] = useState([]);

    // AR v2 : sous-sélections granulaires
    const [askPhotos, setAskPhotos] = useState(false);
    const [selectedPhotosParties, setSelectedPhotosParties] = useState({});  // { partyId: bool }
    const [selectedDevisParties, setSelectedDevisParties] = useState({});    // { partyId: bool }

    // NANO cause
    const [causeNanoPhrase, setCauseNanoPhrase] = useState('');
    const [causeNanoEdited, setCauseNanoEdited] = useState('');
    const [isNanoLoading, setIsNanoLoading] = useState(false);
    const nanoRef = useRef(null);

    // Franchise
    const [franchiseInput, setFranchiseInput] = useState('');
    const [showFranchiseInput, setShowFranchiseInput] = useState(false);

    // Génération
    const [isGenerating, setIsGenerating] = useState(false);
    const [isFinishing, setIsFinishing] = useState(false);
    const [generatedText, setGeneratedText] = useState('');
    const [finisherWarning, setFinisherWarning] = useState('');
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);
    const [emailsCopied, setEmailsCopied] = useState(false);

    // Initialisation à l'ouverture
    useEffect(() => {
        if (isOpen) {
            const { dossier, parties } = evaluateClaims(formData, occupants, expenses);
            setDossierClaimsMeta(dossier);
            setPartiesClaimsMeta(parties);

            const initDossierState = {};
            dossier.forEach(c => initDossierState[c.id] = c.isChecked);
            setDossierClaimsState(initDossierState);

            const initPartiesState = {};
            parties.forEach(p => {
                initPartiesState[p.id] = {};
                p.claims.forEach(c => initPartiesState[p.id][c.id] = c.isChecked);
            });
            setPartiesClaimsState(initPartiesState);

            // Init sous-sélections
            setAskPhotos(false);
            setSelectedPhotosParties({});
            setSelectedDevisParties({});

            // Franchise
            const existingFranchise = formData?.franchise?.trim();
            if (existingFranchise) {
                setFranchiseInput(existingFranchise);
                setShowFranchiseInput(false);
            } else {
                setFranchiseInput('');
                setShowFranchiseInput(true);
            }

            // Reset génération
            setGeneratedText('');
            setFinisherWarning('');
            setError(null);
            setCopied(false);
            setEmailsCopied(false);
            setCauseNanoPhrase('');
            setCauseNanoEdited('');
        }
    }, [isOpen, formData, occupants, expenses]);

    // NANO : se déclenche quand CAUSE_DETAIL est coché
    useEffect(() => {
        if (!isOpen) return;
        if (!dossierClaimsState['CAUSE_DETAIL']) {
            setCauseNanoPhrase('');
            setCauseNanoEdited('');
            return;
        }
        const cause = formData?.cause?.trim();
        if (!cause || cause.length < 5) return;
        if (!isAiModeActive || !aiConfig.apiKey) return;

        // Debounce pour éviter les appels multiples
        if (nanoRef.current) clearTimeout(nanoRef.current);
        nanoRef.current = setTimeout(async () => {
            setIsNanoLoading(true);
            try {
                const phrase = await analyzeNarrativeCause(cause, aiConfig.apiKey);
                if (phrase) {
                    setCauseNanoPhrase(phrase);
                    setCauseNanoEdited(phrase);
                }
            } finally {
                setIsNanoLoading(false);
            }
        }, 400);

        return () => { if (nanoRef.current) clearTimeout(nanoRef.current); };
    }, [dossierClaimsState['CAUSE_DETAIL'], isOpen]);

    if (!isOpen) return null;

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleGenerate = async () => {
        if (!isAiModeActive || !aiConfig.apiKey) {
            setError("L'IA n'est pas activée ou la clé API est manquante dans les paramètres.");
            return;
        }

        setIsGenerating(true);
        setIsFinishing(false);
        setError(null);
        setGeneratedText('');
        setFinisherWarning('');
        setCopied(false);

        try {
            const dossierData = { formData, occupants, expenses };

            // Parties sélectionnées pour les photos
            const photosPartiesList = Object.entries(selectedPhotosParties)
                .filter(([, checked]) => checked)
                .map(([partyId]) => {
                    const p = occupants.find(o => o.id === partyId);
                    return p ? { id: p.id, nom: p.nom || '', prenom: p.prenom || '', statut: p.statut || '' } : null;
                })
                .filter(Boolean);

            // Parties sélectionnées pour les devis
            const devisPartiesList = Object.entries(selectedDevisParties)
                .filter(([, checked]) => checked)
                .map(([partyId]) => {
                    const p = occupants.find(o => o.id === partyId);
                    return p ? { id: p.id, nom: p.nom || '', prenom: p.prenom || '', statut: p.statut || '' } : null;
                })
                .filter(Boolean);

            // Demandes par parties (documents manquants)
            const partiesGaps = partiesClaimsMeta.map(partyMeta => {
                const checkedClaimsIds = Object.keys(partiesClaimsState[partyMeta.id] || {})
                    .filter(claimId => partiesClaimsState[partyMeta.id][claimId]);
                const checkedLabels = partyMeta.claims
                    .filter(c => checkedClaimsIds.includes(c.id))
                    .map(c => c.label);
                return { id: partyMeta.id, nom: partyMeta.nom, prenom: partyMeta.prenom, statut: partyMeta.statut, manques: checkedLabels };
            }).filter(p => p.manques.length > 0);

            const formSelections = {
                franchiseInput: showFranchiseInput ? franchiseInput : formData.franchise,
                causeNanoPhrase: dossierClaimsState['CAUSE_DETAIL'] ? (causeNanoEdited || causeNanoPhrase) : '',
                askPhotos: askPhotos && dossierClaimsState['CAUSE_DETAIL'],
                photosParties: photosPartiesList,
                devisParties: devisPartiesList,
                askPerteContenu: dossierClaimsState['PERTE_CONTENU'] || false,
                askPlainte: dossierClaimsState['PLAINTE'] || false,
                partiesGaps,
            };

            // Génération mail structuré
            const structuredText = await generateAcknowledgmentEmail(dossierData, formSelections, aiConfig.apiKey);
            setGeneratedText(structuredText);
            setIsGenerating(false);

            // IA Balais
            setIsFinishing(true);
            const finisherResult = await runArFinisher(structuredText, dossierData, aiConfig.apiKey);
            setGeneratedText(finisherResult.text);
            if (finisherResult.warning) {
                setFinisherWarning(finisherResult.warning);
            }
        } catch (err) {
            console.error('Erreur AR v2:', err);
            setError('Une erreur est survenue lors de la génération. Veuillez réessayer.');
        } finally {
            setIsGenerating(false);
            setIsFinishing(false);
        }
    };

    const handleCopy = () => {
        if (!generatedText) return;
        navigator.clipboard.writeText(generatedText)
            .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
            .catch(() => alert('Erreur lors de la copie.'));
    };

    const handleCopyEmails = () => {
        const emails = extractEmailsForOutlook(occupants);
        if (!emails) { alert('Aucune adresse e-mail trouvée dans les occupants du dossier.'); return; }
        navigator.clipboard.writeText(emails)
            .then(() => { setEmailsCopied(true); setTimeout(() => setEmailsCopied(false), 2000); });
    };

    const toggleDossierClaim = (id) => {
        setDossierClaimsState(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const togglePartyClaim = (partyId, claimId) => {
        setPartiesClaimsState(prev => ({
            ...prev,
            [partyId]: { ...prev[partyId], [claimId]: !prev[partyId][claimId] }
        }));
    };

    const togglePhotosParty = (partyId) => {
        setSelectedPhotosParties(prev => ({ ...prev, [partyId]: !prev[partyId] }));
    };

    const toggleDevisParty = (partyId) => {
        setSelectedDevisParties(prev => ({ ...prev, [partyId]: !prev[partyId] }));
    };

    // Helper : liste des parties éligibles pour un claim
    const getEligibleParties = (claimId) => {
        const claim = dossierClaimsMeta.find(c => c.id === claimId);
        return claim?.eligibleParties || [];
    };

    const isLoading = isGenerating || isFinishing;

    // ── Rendu ─────────────────────────────────────────────────────────────────

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
                            <p className="text-sm">Le mode IA est désactivé. Veuillez l'activer dans les paramètres.</p>
                        </div>
                    )}

                    <div className="flex justify-between items-center bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                        <p className="text-sm text-indigo-800">Cochez les éléments que vous souhaitez explicitement réclamer dans l'email.</p>
                        <button
                            onClick={handleCopyEmails}
                            className="flex items-center gap-1.5 text-xs font-medium bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-md hover:bg-indigo-50 transition-colors shadow-sm"
                        >
                            {emailsCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <CopyPlus className="w-4 h-4" />}
                            {emailsCopied ? 'Copié !' : 'Copier les e-mails'}
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        {/* Colonne gauche : configuration */}
                        <div className="space-y-6">

                            {/* ── Section : Documents du Dossier ──────────────── */}
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 border-b pb-2">
                                    <FileText className="w-4 h-4 text-slate-500" />
                                    Documents du Dossier
                                </h3>

                                {dossierClaimsMeta.map(claim => (
                                    <div key={claim.id} className="rounded-lg border border-transparent hover:border-slate-200 transition-colors">

                                        {/* Checkbox principale */}
                                        <label className="flex items-start gap-3 p-2 rounded hover:bg-slate-50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={!!dossierClaimsState[claim.id]}
                                                onChange={() => toggleDossierClaim(claim.id)}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 mt-0.5"
                                            />
                                            <span className="text-sm text-slate-700 font-medium">{claim.label}</span>
                                        </label>

                                        {/* Sous-section NANO cause */}
                                        {claim.id === 'CAUSE_DETAIL' && dossierClaimsState['CAUSE_DETAIL'] && (
                                            <div className="ml-7 mt-1 space-y-2">
                                                {/* Nano phrase */}
                                                {isNanoLoading ? (
                                                    <div className="flex items-center gap-2 text-xs text-indigo-600 bg-indigo-50 px-3 py-2 rounded-md border border-indigo-100">
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                        Analyse de la cause en cours…
                                                    </div>
                                                ) : causeNanoPhrase ? (
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-1 text-[10px] text-indigo-500 font-medium uppercase tracking-wide">
                                                            <Sparkles className="w-3 h-3" /> Phrase IA (éditable)
                                                        </div>
                                                        <textarea
                                                            value={causeNanoEdited}
                                                            onChange={(e) => setCauseNanoEdited(e.target.value)}
                                                            rows={2}
                                                            className="w-full text-xs bg-indigo-50/60 border border-indigo-200 rounded px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none"
                                                        />
                                                    </div>
                                                ) : (
                                                    !isAiModeActive ? null : (
                                                        <p className="text-[10px] text-slate-400 italic px-2">
                                                            {formData?.cause ? 'Analyse nano-IA…' : 'Aucune cause renseignée dans le dossier.'}
                                                        </p>
                                                    )
                                                )}

                                                {/* Photos par parties */}
                                                {claim.hasPhotos && (
                                                    <div>
                                                        <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:text-slate-800 font-medium px-2 py-1">
                                                            <input
                                                                type="checkbox"
                                                                checked={askPhotos}
                                                                onChange={() => setAskPhotos(p => !p)}
                                                                className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600"
                                                            />
                                                            Demander des photos
                                                        </label>

                                                        {askPhotos && (
                                                            <div className="ml-5 mt-1 space-y-1">
                                                                <p className="text-[10px] text-slate-400 mb-1">À qui demander des photos :</p>
                                                                {getEligibleParties('CAUSE_DETAIL').length === 0 ? (
                                                                    <p className="text-[10px] text-slate-400 italic">Aucun occupant dans le dossier.</p>
                                                                ) : (
                                                                    getEligibleParties('CAUSE_DETAIL').map(party => (
                                                                        <label key={party.id} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:bg-slate-50 rounded px-2 py-0.5">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={!!selectedPhotosParties[party.id]}
                                                                                onChange={() => togglePhotosParty(party.id)}
                                                                                className="w-3 h-3 rounded border-slate-300 text-indigo-600"
                                                                            />
                                                                            {party.nom} {party.prenom}
                                                                            <span className="text-slate-400 text-[10px]">({party.statut})</span>
                                                                        </label>
                                                                    ))
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Sous-section DEVIS par parties */}
                                        {claim.id === 'DEVIS' && dossierClaimsState['DEVIS'] && claim.targetable && (
                                            <div className="ml-7 mt-1">
                                                <p className="text-[10px] text-slate-400 mb-1 px-2">À qui demander un devis :</p>
                                                {getEligibleParties('DEVIS').length === 0 ? (
                                                    <p className="text-[10px] text-slate-400 italic px-2">Aucun occupant dans le dossier.</p>
                                                ) : (
                                                    <div className="space-y-1">
                                                        {getEligibleParties('DEVIS').map(party => (
                                                            <label key={party.id} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer hover:bg-slate-50 rounded px-2 py-0.5">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={!!selectedDevisParties[party.id]}
                                                                    onChange={() => toggleDevisParty(party.id)}
                                                                    className="w-3 h-3 rounded border-slate-300 text-indigo-600"
                                                                />
                                                                {party.nom} {party.prenom}
                                                                <span className="text-slate-400 text-[10px]">({party.statut})</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* ── Section : Demandes par Partie ────────────────── */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 border-b pb-2">
                                    <User className="w-4 h-4 text-slate-500" />
                                    Demandes par Partie
                                </h3>

                                {partiesClaimsMeta.length === 0 ? (
                                    <p className="text-xs text-emerald-600 bg-emerald-50 p-2 rounded border border-emerald-100 italic">
                                        Aucune partie n'a de documents réclamables selon son statut.
                                    </p>
                                ) : (
                                    partiesClaimsMeta.map(party => (
                                        <div key={party.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                            <div className="font-medium text-slate-800 text-sm mb-2">
                                                {party.nom} {party.prenom}
                                                <span className="text-xs text-slate-500 font-normal ml-1">({party.statut})</span>
                                            </div>
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

                            {/* ── Informations Générales ────────────────────────── */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-slate-800 border-b pb-2">Informations Générales</h3>
                                <div>
                                    <label className="text-xs font-medium text-slate-600 block mb-1">Franchise à mentionner</label>
                                    {!showFranchiseInput ? (
                                        <div className="flex items-center gap-3">
                                            <div className="px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-md border border-emerald-200">
                                                {formData.franchise}
                                            </div>
                                            <button onClick={() => setShowFranchiseInput(true)} className="text-xs text-indigo-600 hover:underline">
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

                            {/* ── Bouton Générer ──────────────────────────────── */}
                            <button
                                onClick={handleGenerate}
                                disabled={isLoading || !isAiModeActive}
                                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-200 mt-4"
                            >
                                {isGenerating ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Génération en cours…</>
                                ) : isFinishing ? (
                                    <><Wand2 className="w-5 h-5 animate-pulse" /> IA Balais en cours…</>
                                ) : (
                                    <><Mail className="w-5 h-5" /> Générer l'email</>
                                )}
                            </button>

                            {error && (
                                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm">{error}</div>
                            )}
                        </div>

                        {/* Colonne droite : aperçu */}
                        <div className="flex flex-col bg-slate-50 border border-slate-200 rounded-xl overflow-hidden relative">
                            <div className="bg-slate-100 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-semibold text-slate-700">Aperçu Outlook</h3>
                                    {generatedText && !isLoading && !finisherWarning && (
                                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                                            ✓ Finalisé
                                        </span>
                                    )}
                                    {finisherWarning && (
                                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium" title={finisherWarning}>
                                            ⚠ Structuré
                                        </span>
                                    )}
                                </div>
                                {generatedText && (
                                    <button
                                        onClick={handleCopy}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${copied ? 'bg-emerald-100 text-emerald-700' : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                                    >
                                        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                        {copied ? 'Copié !' : 'Copier'}
                                    </button>
                                )}
                            </div>

                            {finisherWarning && (
                                <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-[11px] text-amber-700 flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                    {finisherWarning}
                                </div>
                            )}

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
