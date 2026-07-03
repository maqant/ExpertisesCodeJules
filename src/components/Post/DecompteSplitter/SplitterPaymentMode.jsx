import React, { useState } from 'react';
import { useDecompteSplitter } from './DecompteSplitterProvider.jsx';
import { useFinanceStore } from '../../../store/financeStore.js';
import { CheckCircle2, Edit3, Save, RotateCcw, FileText } from 'lucide-react';

/**
 * Mode simplifié du Gestionnaire Financier pour les lettres de paiement.
 * Affiche les données extraites par l'IA, permet l'édition, puis enregistre
 * le versement dans le store global (metier.paiements).
 */
const SplitterPaymentMode = ({ dossierName }) => {
    const { state, dispatch } = useDecompteSplitter();
    const store = useFinanceStore();
    const payment = state.detectedPayment || {};

    const [isEditing, setIsEditing] = useState(false);
    const [isSaved, setIsSaved] = useState(false);

    // Champs éditables locaux (initialisés depuis l'IA)
    const [montant, setMontant] = useState(payment.montant ?? '');
    const [beneficiaire, setBeneficiaire] = useState(payment.beneficiaire ?? '');
    const [date, setDate] = useState(payment.date ?? new Date().toISOString().split('T')[0]);
    const [reference, setReference] = useState(payment.reference ?? '');
    const [communication, setCommunication] = useState(payment.communication ?? dossierName ?? '');

    const handleSave = () => {
        if (!montant || isNaN(parseFloat(montant)) || parseFloat(montant) <= 0) {
            alert("Veuillez saisir un montant valide.");
            return;
        }

        // Enregistrer dans le store global (même mécanisme que PaymentWizard)
        store.addPaiement({
            dateRecept: date || new Date().toISOString().split('T')[0],
            montantTotal: parseFloat(montant),
            ventilations: [], // Pas de ventilation — c'est un enregistrement brut
            source: 'lettre_paiement',
            beneficiaire: beneficiaire || '',
            reference: reference || '',
            communication: communication || ''
        });

        setIsSaved(true);
    };

    const handleReset = () => {
        dispatch({ type: 'RESET_INGESTION' });
    };

    if (isSaved) {
        return (
            <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-md">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Versement enregistré !</h2>
                    <p className="text-slate-500 mb-2">
                        <span className="font-bold text-emerald-600 text-xl">
                            {parseFloat(montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                        </span>
                    </p>
                    {beneficiaire && (
                        <p className="text-sm text-slate-500 mb-1">Bénéficiaire : <strong>{beneficiaire}</strong></p>
                    )}
                    {date && (
                        <p className="text-sm text-slate-500 mb-4">Date : <strong>{new Date(date).toLocaleDateString('fr-FR')}</strong></p>
                    )}
                    <p className="text-xs text-slate-400 mb-6">
                        Ce versement apparaît maintenant dans la section "Versements de la Compagnie".
                    </p>

                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={handleReset}
                            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 font-medium flex items-center gap-2 transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Nouveau document
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col p-6 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                    <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Lettre de paiement détectée</h2>
                    <p className="text-xs text-slate-500">L'IA a identifié un versement. Vérifiez et corrigez si nécessaire.</p>
                </div>
            </div>

            {/* Carte du paiement */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 max-w-2xl mx-auto w-full">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold uppercase text-slate-500 tracking-wider">Détails du versement</h3>
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
                    >
                        <Edit3 className="w-3.5 h-3.5" />
                        {isEditing ? 'Aperçu' : 'Modifier'}
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Montant */}
                    <div>
                        <label className="block text-xs text-slate-500 mb-1 font-medium">Montant du versement</label>
                        {isEditing ? (
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full p-3 border border-slate-300 rounded-lg text-lg font-bold text-right pr-8 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    value={montant}
                                    onChange={e => setMontant(e.target.value)}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">€</span>
                            </div>
                        ) : (
                            <p className="text-3xl font-black text-emerald-600">
                                {montant ? parseFloat(montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 }) : '—'} €
                            </p>
                        )}
                    </div>

                    {/* Bénéficiaire */}
                    <div>
                        <label className="block text-xs text-slate-500 mb-1 font-medium">Bénéficiaire</label>
                        {isEditing ? (
                            <input
                                type="text"
                                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                value={beneficiaire}
                                onChange={e => setBeneficiaire(e.target.value)}
                                placeholder="Nom du bénéficiaire"
                            />
                        ) : (
                            <p className="text-base font-semibold text-slate-800">
                                {beneficiaire || <span className="text-slate-400 italic">Non renseigné</span>}
                            </p>
                        )}
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-xs text-slate-500 mb-1 font-medium">Date du versement</label>
                        {isEditing ? (
                            <input
                                type="date"
                                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                            />
                        ) : (
                            <p className="text-base text-slate-800">
                                {date ? new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : <span className="text-slate-400 italic">Non renseignée</span>}
                            </p>
                        )}
                    </div>

                    {/* Référence */}
                    <div>
                        <label className="block text-xs text-slate-500 mb-1 font-medium">Référence sinistre</label>
                        {isEditing ? (
                            <input
                                type="text"
                                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                value={reference}
                                onChange={e => setReference(e.target.value)}
                                placeholder="Ex: SIN/2026/12345"
                            />
                        ) : (
                            <p className="text-base text-slate-800">
                                {reference || <span className="text-slate-400 italic">Non renseignée</span>}
                            </p>
                        )}
                    </div>

                    {/* Communication */}
                    <div>
                        <label className="block text-xs text-slate-500 mb-1 font-medium">Communication</label>
                        {isEditing ? (
                            <textarea
                                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                                rows={2}
                                value={communication}
                                onChange={e => setCommunication(e.target.value)}
                                placeholder="Communication structurée"
                            />
                        ) : (
                            <p className="text-sm text-slate-700">
                                {communication || <span className="text-slate-400 italic">Aucune communication</span>}
                            </p>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6 pt-4 border-t border-slate-200">
                    <button
                        onClick={handleReset}
                        className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Recommencer
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 font-bold flex items-center justify-center gap-2 transition-colors shadow-lg"
                    >
                        <Save className="w-4 h-4" />
                        Enregistrer ce versement
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SplitterPaymentMode;
