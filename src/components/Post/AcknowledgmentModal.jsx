// AcknowledgmentModal.jsx — AR v2
import React, { useContext, useState, useEffect, useRef } from 'react';
import { ExpertiseContext } from '../../context/ExpertiseContext';
import { useFinanceStore } from '../../store/financeStore';
import { generateAcknowledgmentEmail, analyzeNarrativeCause, runArFinisher, draftMagicEmail, modifyDraftEmail } from '../../services/generators/generatorEngine';
import { evaluateClaims } from '../../domain/claims/claimEngine';
import { useRecipientSelection } from '../../hooks/useRecipientSelection';
import RecipientSelector from '../common/RecipientSelector';
import {
    X, Mail, Check, CopyPlus, Loader2, AlertTriangle, FileText, User, Sparkles, Wand2, Minus, Plus, Snowflake, Flame, MessageSquare, Send, Settings
} from 'lucide-react';
import EmailPreview from '../shared/EmailPreview';
import { makeDraft } from '../../services/utils/htmlNormalizer';
import { buildSimpleAr } from '../../services/generators/buildSimpleAr';
import { AR_FRAGMENT_TRANSMISSION, AR_FRAGMENT_ATTENTE } from '../../config/arTemplates';

const AcknowledgmentModal = ({ isOpen, onClose }) => {
    const { formData, occupants, expenses, aiConfig, isAiModeActive, intervenantsList } = useContext(ExpertiseContext);

    // Initialisation du hook de sélection des destinataires
    const recipientState = useRecipientSelection({
        occupants,
        intervenants: intervenantsList,
        defaultAllSelected: true
    });

    // Mode
    const [mode, setMode] = useState('structured'); // 'simple' | 'structured' | 'free'

    // Draft Unifié
    const [draftEmail, setDraftEmail] = useState(null);

    // AR Simple
    const [includeTransmission, setIncludeTransmission] = useState(true);
    const [includeAttente, setIncludeAttente] = useState(false);
    const [attenteDelai, setAttenteDelai] = useState('');

    // Free Mode State
    const [freeInstruction, setFreeInstruction] = useState('');
    
    // Instruction Spécifique
    const [showSpecificInstruction, setShowSpecificInstruction] = useState(false);
    const [specificInstruction, setSpecificInstruction] = useState('');

    const [activeModifier, setActiveModifier] = useState(null);
    const [isFreeLoading, setIsFreeLoading] = useState(false);

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
    const [finisherWarning, setFinisherWarning] = useState('');
    const [error, setError] = useState(null);
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
            setDraftEmail(null);
            setFinisherWarning('');
            setError(null);
            setEmailsCopied(false);
            setCauseNanoPhrase('');
            setCauseNanoEdited('');
            
            // Reset free mode
            setMode('structured');
            setFreeInstruction('');
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
        setDraftEmail(null);
        setFinisherWarning('');

        try {
            const dossierData = { formData, occupants, expenses };
            const responsablesIds = useFinanceStore.getState().metier?.responsablesIds;
            const hasResponsable = Array.isArray(responsablesIds) && responsablesIds.length > 0;

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
                askPvPolice: dossierClaimsState['PV_POLICE'] || false,
                partiesGaps,
                salutation: recipientState.salutation,
                hasResponsable
            };

            // Génération mail structuré
            const structuredText = await generateAcknowledgmentEmail(dossierData, formSelections, aiConfig.apiKey);
            setDraftEmail(makeDraft(structuredText, 'structured', 'generator'));
            setIsGenerating(false);

            // IA Balais
            setIsFinishing(true);
            const finisherResult = await runArFinisher(structuredText, dossierData, aiConfig.apiKey);
            setDraftEmail(makeDraft(finisherResult.text, 'structured', 'generator'));
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

    const handleGenerateSimple = () => {
        const html = buildSimpleAr({
            dossier: formData,
            withTransmission: includeTransmission,
            withAttente: includeAttente,
            attenteDelai: attenteDelai,
            salutation: recipientState.salutation
        });
        setDraftEmail(makeDraft(html, 'simple', 'generator'));
        setFinisherWarning('');
        setError(null);
    };

    const handleGenerateFreeDraft = async () => {
        if (!freeInstruction.trim()) {
            setError('Veuillez entrer une instruction.');
            return;
        }
        if (!isAiModeActive || !aiConfig.apiKey) {
            setError("L'IA n'est pas activée ou la clé API est manquante dans les paramètres.");
            return;
        }

        setIsFreeLoading(true);
        setError(null);
        try {
            const html = await draftMagicEmail(freeInstruction, recipientState.salutation, aiConfig.apiKey);
            setDraftEmail(makeDraft(html, 'free', 'generator'));
        } catch (err) {
            console.error('Erreur draftMagicEmail:', err);
            setError('Erreur lors de la génération libre.');
        } finally {
            setIsFreeLoading(false);
        }
    };

    const handleModifyFreeDraft = async (modifierKey, customInstruction = null) => {
        if (!draftEmail?.html) return;
        if (!isAiModeActive || !aiConfig.apiKey) return;

        setIsFreeLoading(true);
        setActiveModifier(modifierKey);
        setError(null);
        try {
            const instruction = customInstruction || modifierKey;
            const newHtml = await modifyDraftEmail(draftEmail.html, instruction, aiConfig.apiKey);
            setDraftEmail(makeDraft(newHtml, draftEmail.origin, 'ai-adjusted'));
            if (modifierKey === 'specific') {
                setSpecificInstruction('');
                setShowSpecificInstruction(false);
            }
        } catch (err) {
            console.error('Erreur modifyDraftEmail:', err);
            setError('Erreur lors de la modification libre.');
        } finally {
            setIsFreeLoading(false);
            setActiveModifier(null);
        }
    };

    const handleCopyEmails = () => {
        const emails = recipientState.emailsString;
        if (!emails) { alert('Aucune adresse e-mail trouvée/sélectionnée.'); return; }
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

    const isLoadingData = isGenerating || isFinishing;

    // ── Rendu ─────────────────────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 z-[200] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-slate-800">
                            <Mail className="w-5 h-5 text-indigo-500" />
                            <h2 className="text-lg font-semibold">Génération d'E-mail</h2>
                        </div>
                        
                        {/* Segmented Control */}
                        <div className="flex bg-slate-100 p-1 rounded-lg ml-4">
                            <button
                                onClick={() => setMode('simple')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${mode === 'simple' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Mail className="w-4 h-4" />
                                AR Simple
                            </button>
                            <button
                                onClick={() => setMode('structured')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${mode === 'structured' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <FileText className="w-4 h-4" />
                                AR Structuré
                            </button>
                            <button
                                onClick={() => setMode('free')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${mode === 'free' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Sparkles className="w-4 h-4" />
                                Mode Libre
                            </button>
                        </div>
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

                    <div className="flex flex-col gap-3 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                        <div className="flex justify-between items-center">
                            <p className="text-sm text-indigo-800">Cochez les éléments que vous souhaitez explicitement réclamer dans l'email.</p>
                            <button
                                onClick={handleCopyEmails}
                                disabled={!recipientState.emailsString}
                                className="flex items-center gap-1.5 text-xs font-medium bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-md hover:bg-indigo-50 transition-colors shadow-sm disabled:opacity-50"
                            >
                                {emailsCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <CopyPlus className="w-4 h-4" />}
                                {emailsCopied ? 'Copié !' : 'Copier les e-mails'}
                            </button>
                        </div>
                        <RecipientSelector recipientState={recipientState} />
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        {/* Colonne gauche : configuration */}
                        <div className="space-y-6 flex flex-col h-full">
                            {mode === 'simple' && (
                                <div className="space-y-4 flex-1 flex flex-col">
                                    <div className="flex-1 space-y-4">
                                        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 border-b pb-2">
                                            <Mail className="w-4 h-4 text-slate-500" />
                                            Accusé de réception simple
                                        </h3>
                                        <div className="space-y-3">
                                            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={includeTransmission}
                                                    onChange={(e) => setIncludeTransmission(e.target.checked)}
                                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                                />
                                                <span className="text-sm font-medium text-slate-700">{AR_FRAGMENT_TRANSMISSION.label}</span>
                                            </label>

                                            <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={includeAttente}
                                                    onChange={(e) => setIncludeAttente(e.target.checked)}
                                                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                                />
                                                <span className="text-sm font-medium text-slate-700">{AR_FRAGMENT_ATTENTE.label}</span>
                                            </label>

                                            {includeAttente && (
                                                <div className="ml-7">
                                                    <input
                                                        type="text"
                                                        value={attenteDelai}
                                                        onChange={(e) => setAttenteDelai(e.target.value)}
                                                        placeholder="Ex: pour vendredi prochain (facultatif)"
                                                        className="w-full text-sm border border-slate-200 rounded-md p-2"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleGenerateSimple}
                                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                                    >
                                        Générer l'AR
                                    </button>
                                </div>
                            )}

                            {mode === 'structured' && (
                                <>
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
                                    <div className="space-y-3 flex-1">
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
                                                    className="w-full px-3 py-2 text-sm text-slate-800 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* ── Bouton Générer ──────────────────────────────── */}
                                    <button
                                        onClick={handleGenerate}
                                        disabled={isLoadingData || !isAiModeActive}
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
                                </>
                            )}
                            
                            {mode === 'free' && (
                                <div className="space-y-4 flex-1 flex flex-col">
                                    <div className="flex-1 space-y-2 flex flex-col">
                                        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 border-b pb-2">
                                            <Sparkles className="w-4 h-4 text-slate-500" />
                                            Instruction Libre
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            Saisissez votre consigne brute, l'IA la transformera en un e-mail professionnel parfaitement structuré.
                                        </p>
                                        <textarea
                                            value={freeInstruction}
                                            onChange={(e) => setFreeInstruction(e.target.value)}
                                            placeholder="Ex: Dis merci pour les documents, mais rappelle qu'il manque le devis du vitrier..."
                                            className="w-full flex-1 min-h-[200px] bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none shadow-inner"
                                        />
                                    </div>

                                    <div className="flex justify-end">
                                        <button
                                            onClick={handleGenerateFreeDraft}
                                            disabled={isFreeLoading || !freeInstruction.trim()}
                                            className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 disabled:opacity-50 flex justify-center items-center gap-2 text-sm font-semibold transition-colors"
                                        >
                                            {isFreeLoading && !activeModifier ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                            Générer l'e-mail magique
                                        </button>
                                    </div>

                                    {error && (
                                        <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded text-sm">{error}</div>
                                    )}

                                </div>
                            )}
                        </div>

                        {/* Colonne droite : aperçu via composant partagé */}
                        <div className="w-full flex flex-col relative h-[600px] gap-4">
                            <div className="flex-1 flex flex-col relative">
                                {finisherWarning && (
                                    <div className="absolute top-0 left-0 right-0 z-10 px-4 py-2 bg-amber-50 border-b border-amber-100 text-[11px] text-amber-700 flex items-center gap-1.5 rounded-t-xl">
                                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                                        {finisherWarning}
                                    </div>
                                )}
                                <EmailPreview 
                                    htmlText={draftEmail?.html || ''}
                                    isLoading={isLoadingData || isFreeLoading}
                                    isFinalized={!!draftEmail && !isLoadingData && !isFreeLoading && !finisherWarning}
                                    onContentChange={(newHtml) => {
                                        setDraftEmail(prev => prev ? { ...prev, html: newHtml, origin: 'manual', lastModifiedBy: 'user' } : null);
                                    }}
                                />
                            </div>

                            {/* Barre d'outils Magiques Globale (affichée si un brouillon existe) */}
                            {draftEmail && (
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <Wand2 className="w-3.5 h-3.5" />
                                        Ajustements magiques
                                    </p>
                                    
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { key: 'rewrite', label: 'Réécrire', icon: Wand2, color: 'text-indigo-600', bg: 'hover:bg-indigo-50 border-indigo-200' },
                                            { key: 'shorter', label: 'Plus court', icon: Minus, color: 'text-slate-600', bg: 'hover:bg-slate-50 border-slate-200' },
                                            { key: 'longer', label: 'Plus long', icon: Plus, color: 'text-slate-600', bg: 'hover:bg-slate-50 border-slate-200' },
                                            { key: 'colder', label: 'Plus formel', icon: Snowflake, color: 'text-cyan-600', bg: 'hover:bg-cyan-50 border-cyan-200' },
                                            { key: 'warmer', label: 'Plus chaleureux', icon: Flame, color: 'text-orange-600', bg: 'hover:bg-orange-50 border-orange-200' },
                                        ].map(mod => (
                                            <button
                                                key={mod.key}
                                                onClick={() => handleModifyFreeDraft(mod.key)}
                                                disabled={isFreeLoading || isLoadingData}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 bg-white border rounded-full text-xs font-medium shadow-sm transition-colors disabled:opacity-50 ${mod.color} ${mod.bg}`}
                                            >
                                                {activeModifier === mod.key && isFreeLoading ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <mod.icon className="w-3.5 h-3.5" />
                                                )}
                                                {mod.label}
                                            </button>
                                        ))}

                                        {/* Bouton pour Instruction Spécifique */}
                                        <button
                                            onClick={() => setShowSpecificInstruction(!showSpecificInstruction)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 bg-white border rounded-full text-xs font-medium shadow-sm transition-colors hover:bg-slate-50 border-slate-200 ${showSpecificInstruction ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'text-slate-700'}`}
                                        >
                                            <span className="text-sm">✏️</span>
                                            Donner une instruction
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Modale d'Instruction Spécifique Escamotable */}
                            {draftEmail && showSpecificInstruction && (
                                <div className="mt-2 p-4 bg-white border-2 border-indigo-400 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-4 ring-indigo-50 flex flex-col gap-3 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="flex items-center gap-3 w-full">
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={specificInstruction}
                                                onChange={(e) => setSpecificInstruction(e.target.value)}
                                                placeholder="Que voulez-vous modifier dans ce texte ?"
                                                className="w-full text-sm bg-indigo-50/50 border border-indigo-200 rounded-lg py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && specificInstruction.trim()) {
                                                        handleModifyFreeDraft('specific', specificInstruction);
                                                    }
                                                }}
                                                autoFocus
                                            />
                                        </div>
                                        <button
                                            onClick={() => handleModifyFreeDraft('specific', specificInstruction)}
                                            disabled={!specificInstruction.trim() || isFreeLoading || isLoadingData}
                                            className="px-5 py-2.5 bg-indigo-600 text-white font-semibold text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
                                        >
                                            {activeModifier === 'specific' && isFreeLoading ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Send className="w-4 h-4" />
                                            )}
                                            Appliquer
                                        </button>
                                    </div>
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
