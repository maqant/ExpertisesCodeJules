import React, { useState } from 'react';
import { useFinanceStore } from '../../store/financeStore';
import PaymentWizardModal from './PaymentWizardModal';

const TresorerieView = () => {
  const store = useFinanceStore();
  const [showWizard, setShowWizard] = useState(false);
  const occupants = store.pii.occupants;
  const expenses = store.metier.expenses.filter(exp => {
    // On ne montre que les frais validés ET on exclut les contre-expertises
    if (!exp.isProcessed) return false;
    const occ = occupants.find(o => o.id === exp.compteDe);
    return !(occ && occ.contreExpert);
  });

  const fmtOccName = (o) => o.nom ? (o.etage && o.etage.trim() !== '' ? `${o.etage} - ${o.nom}` : o.nom) : '';

  const findOccByCompteDe = (compteDe) => {
    if (!compteDe) return null;
    return occupants.find(o => o.id === compteDe || fmtOccName(o) === compteDe);
  };

  const getCompteDeName = (compteDe) => {
    const matchedOcc = findOccByCompteDe(compteDe);
    if (matchedOcc) return fmtOccName(matchedOcc);
    if (compteDe && compteDe.trim() !== '') return compteDe;
    return 'Non attribué';
  };

  // Regrouper par occupant (avec résolution nom/ID)
  const expensesByOcc = expenses.reduce((acc, exp) => {
    const pName = getCompteDeName(exp.compteDe);
    if (!acc[pName]) acc[pName] = [];
    acc[pName].push(exp);
    return acc;
  }, {});

  const paiements = store.metier.paiements || [];
  const sumTotalRecu = paiements.reduce((acc, p) => acc + (parseFloat(p.montantTotal) || 0), 0);
  const sumTotalVentile = paiements.reduce((acc, p) => acc + (p.ventilations || []).reduce((s, v) => s + (parseFloat(v.montantAlloue) || 0), 0), 0);
  const reliquatGlobal = Math.max(0, sumTotalRecu - sumTotalVentile);

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-white p-4 overflow-y-auto w-full relative">
      <div className="flex justify-between items-center mb-6 border-b-2 border-slate-300 dark:border-slate-700 pb-4">
        <h1 className="text-2xl font-bold">Suivi des Règlements (Répartition)</h1>
        <button
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-xl shadow-lg font-bold flex items-center gap-2 transition-transform transform active:scale-95"
          onClick={() => setShowWizard(true)}
        >
          <span>💸</span> Enregistrer un Paiement
        </button>
      </div>

      {reliquatGlobal > 0.01 && (
        <div className="bg-amber-100 border-l-4 border-amber-500 p-4 mb-6 rounded shadow flex justify-between items-center text-amber-900">
            <div>
                <h3 className="font-bold text-lg">Paiements avec reliquat en attente</h3>
                <p className="text-sm">Vous avez des encaissements dont une partie du montant n'a pas encore été ventilée.</p>
            </div>
            <div className="flex items-center gap-4">
                <span className="font-bold text-2xl">{reliquatGlobal.toFixed(2)} €</span>
                <button
                    onClick={() => setShowWizard(true)}
                    className="bg-amber-600 text-white px-4 py-2 rounded shadow hover:bg-amber-500 font-bold"
                >
                    Reprendre la répartition
                </button>
            </div>
        </div>
      )}

      {Object.keys(expensesByOcc).length === 0 ? (
        <div className="text-center text-slate-500 italic py-12">Aucun frais validé n'est prêt pour la répartition. Validez des frais dans la vue "Terrain" d'abord.</div>
      ) : (
        <div className="space-y-8">
          {Object.entries(expensesByOcc).map(([occName, occExpenses]) => {
            return (
              <div key={occName} className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <div className="bg-slate-50 dark:bg-slate-700 p-4 border-b border-slate-200 dark:border-slate-600">
                  <h2 className="text-xl font-bold flex items-center gap-2">👤 {occName}</h2>
                </div>
                <div className="p-4 space-y-6">
                  {occExpenses.map(exp => {
                    const status = store.getStatutPaiementFrais(exp.id);
                    const val = parseFloat(String(exp.montantValide || exp.montantReclame || exp.montant || "0").replace(',', '.'));
                    const safeVal = isNaN(val) ? 0 : val;
                    const percent = safeVal > 0 ? Math.min(100, (status.totalGlobal / safeVal) * 100) : 0;

                    return (
                      <div key={exp.id} className="group">
                        <div className="flex justify-between items-end mb-1">
                          <div>
                            <p className="font-bold text-lg">{exp.prestataire || 'Frais'} <span className="text-xs font-normal text-slate-500">({exp.typeMontant || 'HTVA'})</span></p>
                            <p className="text-sm text-slate-500">{exp.desc}</p>
                          </div>
                          <div className="text-right">
                            <span className="text-sm text-slate-500">Versé : </span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">{status.totalGlobal.toFixed(2)} €</span>
                            <span className="text-sm text-slate-400 mx-1">/</span>
                            <span className="font-bold">{safeVal.toFixed(2)} €</span>
                          </div>
                        </div>
                        {/* Jauge principale */}
                        <div className="w-full bg-slate-200 dark:bg-slate-600 h-3 rounded-full overflow-hidden relative shadow-inner">
                          <div
                            className={`h-full transition-all duration-700 ease-out ${percent >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>

                        {/* Tags de ventilation TVA / HTVA (si applicable) */}
                        {status.totalGlobal > 0 && (
                          <div className="flex gap-2 mt-2">
                            {status.totalHTVA > 0 && <span className="text-[10px] bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-700">HTVA: {status.totalHTVA.toFixed(2)} €</span>}
                            {status.totalTVA > 0 && <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-700">TVA: {status.totalTVA.toFixed(2)} €</span>}
                            {status.totalForfait > 0 && <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-700">Forfait: {status.totalForfait.toFixed(2)} €</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showWizard && <PaymentWizardModal onClose={() => setShowWizard(false)} />}
    </div>
  );
};

export default TresorerieView;
