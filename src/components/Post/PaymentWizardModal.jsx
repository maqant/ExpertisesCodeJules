import React, { useState } from 'react';
import { useFinanceStore } from '../../store/financeStore';

const PaymentWizardModal = ({ onClose }) => {
  const store = useFinanceStore();
  const occupants = store.pii.occupants;
  const expenses = store.metier.expenses.filter(e => e.isProcessed);

  // States du Wizard
  const paiements = store.metier.paiements || [];
  const sumTotalRecu = paiements.reduce((acc, p) => acc + (parseFloat(p.montantTotal) || 0), 0);
  const sumTotalVentile = paiements.reduce((acc, p) => acc + (p.ventilations || []).reduce((s, v) => s + (parseFloat(v.montantAlloue) || 0), 0), 0);
  const reliquatGlobal = Math.max(0, sumTotalRecu - sumTotalVentile);

  // States du Wizard (Saute l'étape 1 si reliquat existant)
  const [step, setStep] = useState(reliquatGlobal > 0.01 ? 2 : 1);
  const [dateRecept, setDateRecept] = useState(new Date().toISOString().split('T')[0]);
  const [montantTotalReçu, setMontantTotalReçu] = useState(reliquatGlobal > 0.01 ? reliquatGlobal : "");
  const [soldeRestant, setSoldeRestant] = useState(reliquatGlobal > 0.01 ? reliquatGlobal : 0);
  const [ventilations, setVentilations] = useState([]); // [{ expenseId, montantAlloue, typeAllocation }]
  const [isReprise, setIsReprise] = useState(reliquatGlobal > 0.01);

  // States de l'étape d'attribution (Step 2)
  const [selectedOccId, setSelectedOccId] = useState("");
  const [selectedExpId, setSelectedExpId] = useState("");
  const [allocationAmount, setAllocationAmount] = useState("");
  const [allocationType, setAllocationType] = useState("HTVA");

  // Démarre l'attribution
  const handleStartAttribution = () => {
    const parsed = parseFloat(String(montantTotalReçu).replace(',', '.'));
    if (isNaN(parsed) || parsed <= 0) return alert("Veuillez saisir un montant reçu valide.");
    setSoldeRestant(parsed);
    setStep(2);
  };

  const currentExpense = expenses.find(e => e.id === selectedExpId);
  const getMontantRestantAPayer = (exp) => {
      if (!exp) return 0;
      const status = store.getStatutPaiementFrais(exp.id);
      // Inclure également les ventilations qui sont en cours d'encodage dans ce wizard
      const enCours = ventilations.filter(v => v.expenseId === exp.id).reduce((s, v) => s + v.montantAlloue, 0);
      const valide = parseFloat(String(exp.montantValide || exp.montantReclame || exp.montant || "0").replace(',', '.'));
      return Math.max(0, (isNaN(valide) ? 0 : valide) - status.totalGlobal - enCours);
  };
  const currentRestantAPayer = getMontantRestantAPayer(currentExpense);

  const handleAjouterVentilation = () => {
      const amt = parseFloat(String(allocationAmount).replace(',', '.'));
      if (isNaN(amt) || amt <= 0) return alert("Montant d'attribution invalide.");

      if (amt > soldeRestant + 0.01) return alert("Le montant alloué dépasse le solde disponible."); // Marge de flottant
      if (amt > currentRestantAPayer + 0.01) return alert("Le montant alloué dépasse le solde restant à payer pour cette facture.");

      const nouvelleAlloc = {
          expenseId: selectedExpId,
          montantAlloue: amt,
          typeAllocation: allocationType
      };

      setVentilations([...ventilations, nouvelleAlloc]);

      const newSolde = soldeRestant - amt;
      setSoldeRestant(newSolde);

      // Reset le petit formulaire
      setSelectedExpId("");
      setAllocationAmount("");

      // On ne passe plus automatiquement à l'étape 3 pour permettre la saisie partielle.
      // Mais si c'est vraiment 0, c'est mieux visuellement
      if (Math.abs(newSolde) < 0.01) {
          setStep(3);
      }
  };

  const handleFinaliser = () => {
      if (isReprise) {
          if (ventilations.length > 0) {
              // On ajoute uniquement les ventilations. En créant un "paiement" avec 0 reçu,
              // la formule du pool global (sumTotalRecu - sumTotalVentile) se mettra à jour correctement,
              // diminuant le reliquat restant sans fausser le total de l'argent reçu dans l'ERP.
              store.addPaiement({
                  dateRecept: new Date().toISOString().split('T')[0],
                  montantTotal: 0,
                  ventilations
              });
          }
      } else {
          // Nouveau paiement
          store.addPaiement({
              dateRecept,
              montantTotal: parseFloat(String(montantTotalReçu).replace(',', '.')),
              ventilations
          });
      }
      onClose();
  };

  const getOccName = (occ) => {
    if (!occ) return 'Non attribué';
    const nomAffiche = occ.nom || '';
    if (occ.etage && occ.etage.trim() !== '') {
        return `${nomAffiche} (${occ.etage.trim()})`;
    }
    return nomAffiche;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[80vh] max-h-[700px]">

        <div className="bg-slate-100 dark:bg-slate-900 p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">💰 Saisir un paiement entrant</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl font-bold px-2">✕</button>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">

            {/* STEP 1: POT COMMUN */}
            {step === 1 && (
                <div className="flex flex-col items-center justify-center h-full space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="text-center">
                        <p className="text-slate-500 font-medium mb-1 uppercase tracking-wide">Étape 1</p>
                        <h3 className="text-3xl font-bold text-slate-800 dark:text-white">Le Pot Commun</h3>
                    </div>

                    <div className="w-full max-w-sm space-y-4">
                        <div>
                            <label className="block font-bold text-sm text-slate-600 dark:text-slate-300 mb-1">Date de réception</label>
                            <input type="date" value={dateRecept} onChange={e => setDateRecept(e.target.value)} className="w-full text-lg p-3 rounded-lg border-2 border-slate-300 dark:border-slate-600 bg-transparent text-slate-800 dark:text-white focus:border-indigo-500 outline-none" />
                        </div>
                        <div>
                            <label className="block font-bold text-sm text-slate-600 dark:text-slate-300 mb-1">Montant Total Reçu (€)</label>
                            <input
                                type="number"
                                autoFocus
                                value={montantTotalReçu}
                                onChange={e => setMontantTotalReçu(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleStartAttribution()}
                                placeholder="ex: 5000.00"
                                className="w-full text-3xl font-bold text-center p-4 rounded-lg border-2 border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 focus:border-indigo-500 outline-none"
                            />
                        </div>
                    </div>

                    <button onClick={handleStartAttribution} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xl font-bold py-3 px-8 rounded-xl shadow-lg transition-transform active:scale-95">Continuer →</button>
                </div>
            )}

            {/* STEP 2: VENTILATION BOUCLE */}
            {step === 2 && (
                <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4">

                    <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4 flex justify-between items-center mb-6">
                        <div>
                            <span className="font-bold text-indigo-800 dark:text-indigo-300 block">Solde à distribuer :</span>
                            <span className="text-xs text-indigo-600/70 dark:text-indigo-400/70">Vous pouvez fermer la fenêtre avec un solde restant.</span>
                        </div>
                        <div className="text-right">
                            <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400 block">{Math.max(0, soldeRestant).toFixed(2)} €</span>
                            <button onClick={handleFinaliser} className="mt-1 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded shadow">Enregistrer & Fermer</button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-6">

                        {/* Zone Attribution */}
                        <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 p-5 rounded-xl">
                            <h4 className="font-bold mb-4">Nouvelle Attribution</h4>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">1. Choisir une Partie (Occupant)</label>
                                    <select value={selectedOccId} onChange={(e) => { setSelectedOccId(e.target.value); setSelectedExpId(""); }} className="w-full p-2.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:border-indigo-500">
                                        <option value="">Sélectionnez...</option>
                                        <option value="unassigned">Frais non attribués</option>
                                        {/* Ajouter dynamiquement les compteDe qui ne sont pas des IDs occupants valides, ex: "COMMUNS" */}
                                        {[...new Set(expenses.map(e => e.compteDe).filter(c => c && !occupants.find(o => o.id === c)))].map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                        {occupants.filter(o => !o.contreExpert).map(o => <option key={o.id} value={o.id}>{getOccName(o)}</option>)}
                                    </select>
                                </div>

                                {selectedOccId && (
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">2. Choisir la Facture / Frais</label>
                                        <select value={selectedExpId} onChange={(e) => { setSelectedExpId(e.target.value); setAllocationAmount(""); setAllocationType("HTVA"); }} className="w-full p-2.5 rounded border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white outline-none focus:border-indigo-500">
                                            <option value="">Sélectionnez...</option>
                                            {expenses.filter(e => {
                                                const matchesOcc = selectedOccId === 'unassigned' ? (!e.compteDe || String(e.compteDe).trim() === '') : (String(e.compteDe) === String(selectedOccId));
                                                const resteAPayer = getMontantRestantAPayer(e);
                                                return matchesOcc && resteAPayer > 0;
                                            }).map(e => (
                                                <option key={e.id} value={e.id}>{e.prestataire || 'Frais'} ({getMontantRestantAPayer(e).toFixed(2)}€ restants)</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {currentExpense && (
                                    <div className="flex gap-4 items-end bg-amber-50 dark:bg-amber-900/20 p-4 rounded border border-amber-200 dark:border-amber-900/50 mt-4">
                                        <div className="flex-1">
                                            <label className="block text-xs font-bold text-amber-800 dark:text-amber-500 mb-1 uppercase">3. Montant alloué</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={allocationAmount}
                                                    onChange={e => setAllocationAmount(e.target.value)}
                                                    onKeyDown={e => e.key === 'Enter' && handleAjouterVentilation()}
                                                    className="w-full p-2.5 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-lg font-bold text-slate-800 dark:text-white outline-none focus:border-amber-500 pr-16"
                                                    placeholder={`Max: ${Math.min(currentRestantAPayer, soldeRestant).toFixed(2)}`}
                                                />
                                                <div className="absolute right-2 top-2">
                                                    <button onClick={() => setAllocationAmount(Math.min(currentRestantAPayer, soldeRestant).toFixed(2))} className="text-[10px] bg-amber-200 text-amber-800 px-2 py-1 rounded font-bold hover:bg-amber-300">MAX</button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="w-1/3">
                                            <label className="block text-xs font-bold text-amber-800 dark:text-amber-500 mb-1 uppercase">Type</label>
                                            <select value={allocationType} onChange={e => setAllocationType(e.target.value)} className="w-full p-3 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 font-bold outline-none focus:border-amber-500">
                                                <option value="HTVA">HTVA</option>
                                                <option value="TVA">TVA</option>
                                                <option value="FORFAIT">FORFAIT</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {currentExpense && (
                                    <button onClick={handleAjouterVentilation} className="w-full bg-amber-500 hover:bg-amber-400 text-white font-bold py-3 rounded-lg mt-2 shadow-md">Ajouter l'allocation ↓</button>
                                )}
                            </div>
                        </div>

                        {/* Liste des ventilations actuelles */}
                        {ventilations.length > 0 && (
                            <div>
                                <h4 className="font-bold text-sm text-slate-500 mb-2 uppercase">Ventilations enregistrées</h4>
                                <div className="space-y-2">
                                    {ventilations.map((v, i) => {
                                        const exp = expenses.find(e => e.id === v.expenseId);
                                        return (
                                            <div key={i} className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-3 rounded border border-slate-200 dark:border-slate-700">
                                                <div className="text-sm">
                                                    <span className="font-bold block">{exp?.prestataire || 'Frais supprimé'}</span>
                                                    <span className="text-xs text-slate-500">{v.typeAllocation}</span>
                                                </div>
                                                <div className="font-bold text-emerald-600">{v.montantAlloue.toFixed(2)} €</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            )}

            {/* STEP 3: SUCCÈS */}
            {step === 3 && (
                <div className="flex flex-col items-center justify-center h-full space-y-6 animate-in zoom-in-95">
                    <div className="w-24 h-24 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center text-5xl">✅</div>
                    <h3 className="text-3xl font-bold text-slate-800 dark:text-white text-center">Paiement entièrement distribué !</h3>
                    <p className="text-slate-500 text-center max-w-md">Le solde est à 0€. Vous pouvez maintenant valider l'enregistrement de ce paiement dans la répartition du dossier.</p>

                    <button onClick={handleFinaliser} className="bg-emerald-500 hover:bg-emerald-400 text-white text-xl font-bold py-4 px-12 rounded-xl shadow-lg mt-8 transition-transform active:scale-95">Valider & Fermer</button>
                </div>
            )}
        </div>

      </div>
    </div>
  );
};

export default PaymentWizardModal;
