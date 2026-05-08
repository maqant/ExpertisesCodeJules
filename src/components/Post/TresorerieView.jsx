import React, { useState, useContext } from 'react';
import { useFinanceStore } from '../../store/financeStore';
import { ExpertiseContext } from '../../context/ExpertiseContext';
import PaymentWizardModal from './PaymentWizardModal';
import { getCompteDeName } from '../../utils/formatters';

const TresorerieView = () => {
  const store = useFinanceStore();
  const context = useContext(ExpertiseContext);
  const [showWizard, setShowWizard] = useState(false);
  const occupants = store.pii.occupants;
  const isPVEClosed = store.metier.isPVEClosed;
  const franchiseOccId = store.metier.franchiseOccId;

  const expenses = store.metier.expenses.filter(exp => {
    if (!exp.isProcessed) return false;
    const occ = occupants.find(o => o.id === exp.compteDe);
    return !(occ && occ.contreExpert);
  });

  // v5.1.0 : Financial summary
  const financialSummary = store.getFinancialSummaryByOcc(context?.formData || {});

  // Regrouper par occupant
  const expensesByOcc = expenses.reduce((acc, exp) => {
    const pName = getCompteDeName(exp.compteDe, occupants);
    if (!acc[pName]) acc[pName] = { expenses: [], occId: exp.compteDe };
    acc[pName].expenses.push(exp);
    return acc;
  }, {});

  const paiements = store.metier.paiements || [];
  const sumTotalRecu = paiements.reduce((acc, p) => acc + (parseFloat(p.montantTotal) || 0), 0);
  const sumTotalVentile = paiements
    .flatMap(p => p.ventilations || [])
    .reduce((acc, v) => acc + (parseFloat(v.montantAlloue) || 0), 0);
  const reliquatGlobal = Math.max(0, sumTotalRecu - sumTotalVentile);

  // v5.1.0 : Franchise assignment modal in post
  const [showFranchiseModal, setShowFranchiseModal] = useState(false);
  const [franchiseTargetPost, setFranchiseTargetPost] = useState('');

  const parseFranchiseMontant = () => {
    return store.getFranchiseMontant();
  };

  const assignFranchisePost = () => {
    if (franchiseTargetPost) {
      store.generateFranchiseExpense(franchiseTargetPost, parseFranchiseMontant());
    }
    setShowFranchiseModal(false);
    setFranchiseTargetPost('');
  };

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

      {/* v5.1.0 : Alerte franchise non attribuée */}
      {isPVEClosed && franchiseOccId === null && parseFranchiseMontant() > 0 && (
        <div className="bg-amber-100 border-l-4 border-amber-500 p-4 mb-6 rounded shadow flex justify-between items-center text-amber-900">
          <div>
            <h3 className="font-bold text-lg">⚠️ Franchise non attribuée</h3>
            <p className="text-sm">La franchise de {parseFranchiseMontant().toFixed(2)} € n'est pas encore imputée à un bénéficiaire.</p>
          </div>
          <button onClick={() => setShowFranchiseModal(true)} className="bg-amber-600 text-white px-4 py-2 rounded shadow hover:bg-amber-500 font-bold">
            Attribuer maintenant
          </button>
        </div>
      )}

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

      {/* v5.1.0 : Résumé financier global */}
      {Object.keys(financialSummary).length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-4 mb-6 border border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-bold uppercase text-slate-500 mb-3">Ventilation financière par bénéficiaire</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700">
                  <th className="pb-2 pr-4">Bénéficiaire</th>
                  <th className="pb-2 pr-4 text-right">Principale</th>
                  <th className="pb-2 pr-4 text-right">Complémentaire</th>
                  <th className="pb-2 pr-4 text-right">Franchise</th>
                  <th className="pb-2 pr-4 text-right">PI</th>
                  <th className="pb-2 text-right font-bold">Total Net</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(financialSummary).map(([occId, data]) => (
                  <tr key={occId} className="border-b border-slate-100 dark:border-slate-700/50">
                    <td className="py-2 pr-4 font-bold">{data.etage ? `${data.etage} - ` : ''}{data.nom || 'Non attribué'}</td>
                    <td className="py-2 pr-4 text-right text-emerald-600">{data.totalPrincipale > 0 ? data.totalPrincipale.toFixed(2) + ' €' : '-'}</td>
                    <td className="py-2 pr-4 text-right text-blue-600">{data.totalComplementaire > 0 ? data.totalComplementaire.toFixed(2) + ' €' : '-'}</td>
                    <td className="py-2 pr-4 text-right text-red-600 font-bold">{data.franchiseMontant < 0 ? data.franchiseMontant.toFixed(2) + ' €' : '-'}</td>
                    <td className="py-2 pr-4 text-right text-purple-600">{data.pertesIndirectes > 0 ? '+' + data.pertesIndirectes.toFixed(2) + ' €' : '-'}</td>
                    <td className="py-2 text-right font-bold text-lg">{data.totalNet.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {Object.keys(expensesByOcc).length === 0 ? (
        <div className="text-center text-slate-500 italic py-12">Aucun frais validé n'est prêt pour la répartition. Validez des frais dans la vue "Terrain" d'abord.</div>
      ) : (
        <div className="space-y-8">
          {Object.entries(expensesByOcc).map(([occName, { expenses: occExpenses, occId }]) => {
            const summary = financialSummary[occId];
            const hasFranchise = summary && summary.franchiseMontant < 0;

            return (
              <div key={occName} className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <div className="bg-slate-50 dark:bg-slate-700 p-4 border-b border-slate-200 dark:border-slate-600 flex justify-between items-center">
                  <h2 className="text-xl font-bold flex items-center gap-2">👤 {occName}</h2>
                  {summary && (
                    <div className="flex items-center gap-3 text-xs">
                      {hasFranchise && <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-2 py-1 rounded-full font-bold">Franchise : {summary.franchiseMontant.toFixed(2)} €</span>}
                      {summary.pertesIndirectes > 0 && <span className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 px-2 py-1 rounded-full font-bold">PI : +{summary.pertesIndirectes.toFixed(2)} €</span>}
                      <span className="bg-slate-200 dark:bg-slate-600 px-2 py-1 rounded-full font-bold">Net : {summary.totalNet.toFixed(2)} €</span>
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-6">
                  {(() => {
                    let franchiseRestanteVisuelle = hasFranchise ? Math.abs(summary.franchiseMontant) : 0;
                    
                    const sortedExpenses = [...occExpenses].filter(e => !e.isFranchise).sort((a, b) => {
                      if (a.categorieGarantie === 'Principale' && b.categorieGarantie !== 'Principale') return -1;
                      if (a.categorieGarantie !== 'Principale' && b.categorieGarantie === 'Principale') return 1;
                      return 0;
                    });

                    const renderedExpenses = sortedExpenses.map(exp => {
                      const status = store.getStatutPaiementFrais(exp.id);
                      const val = parseFloat(String(exp.montantValide || exp.montantReclame || exp.montant || "0").replace(',', '.'));
                      const safeVal = isNaN(val) ? 0 : val;
                      const tvaRate = exp.tauxTVA || 0;
                      const tvaAmount = exp.typeMontant === 'HTVA' ? safeVal * (tvaRate / 100) : 0;
                      const montantTotalAttendu = safeVal + tvaAmount;

                      // Imputation franchise visuelle sur ce frais
                      const partFranchise = Math.min(franchiseRestanteVisuelle, safeVal);
                      franchiseRestanteVisuelle -= partFranchise;

                      // Calculs pour la jauge 80/20
                      const principalPaye = exp.typeMontant === 'HTVA' ? status.totalHTVA : status.totalGlobal;
                      const tvaPayee = exp.typeMontant === 'HTVA' ? status.totalTVA : 0;
                      
                      const pctFranchiseA = safeVal > 0 ? Math.min(100, (partFranchise / safeVal) * 100) : 0;
                      const pctPrincipalA = safeVal > 0 ? Math.min(100 - pctFranchiseA, (principalPaye / safeVal) * 100) : 0;
                      const pctTVAB = tvaAmount > 0 ? Math.min(100, (tvaPayee / tvaAmount) * 100) : 0;

                      return (
                        <div key={exp.id} className="group">
                          <div className="flex justify-between items-end mb-1">
                            <div>
                              <p className="font-bold text-lg">
                                {exp.prestataire || 'Frais'}
                                <span className="text-xs font-normal text-slate-500 ml-2">({exp.typeMontant || 'HTVA'})</span>
                                {exp.categorieGarantie && (
                                  <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${exp.categorieGarantie === 'Principale' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                                    {exp.categorieGarantie === 'Principale' ? '🏠 Principale' : '📋 Complémentaire'}
                                  </span>
                                )}
                              </p>
                              <p className="text-sm text-slate-500">{exp.desc}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-sm text-slate-500">Versé : </span>
                              <span className="font-bold text-indigo-600 dark:text-indigo-400">{status.totalGlobal.toFixed(2)} €</span>
                              <span className="text-sm text-slate-400 mx-1">/</span>
                              <span className="font-bold">{montantTotalAttendu.toFixed(2)} €</span>
                              {tvaAmount > 0 && (
                                <span className="text-xs text-slate-500 ml-1">
                                  (Principal: {safeVal.toFixed(2)}€ + TVA: {tvaAmount.toFixed(2)}€)
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Jauge principale refondue 80/20 */}
                          <div className="w-full flex gap-1">
                            {/* Conteneur A (Principal) */}
                            <div className="w-[80%] bg-slate-200 dark:bg-slate-600 h-3 rounded-full overflow-hidden flex shadow-inner">
                              {/* Segment 1: Franchise imputée (Zone morte) */}
                              {pctFranchiseA > 0 && (
                                <div
                                  className="bg-red-800 h-full transition-all duration-700 ease-out"
                                  style={{ width: `${pctFranchiseA}%` }}
                                  title={`Franchise imputée : ${partFranchise.toFixed(2)} €`}
                                ></div>
                              )}
                              {/* Segment 2: Principal payé */}
                              {pctPrincipalA > 0 && (
                                <div
                                  className={`bg-indigo-600 h-full transition-all duration-700 ease-out ${pctFranchiseA > 0 ? 'border-l border-indigo-700' : ''}`}
                                  style={{ width: `${pctPrincipalA}%` }}
                                  title={`Principal payé : ${principalPaye.toFixed(2)} €`}
                                ></div>
                              )}
                            </div>
                            
                            {/* Conteneur B (TVA) */}
                            {exp.typeMontant === 'HTVA' ? (
                              <div className={`w-[20%] h-3 rounded-full overflow-hidden flex shadow-inner ${tvaAmount > 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-slate-100 dark:bg-slate-700/30'}`}>
                                {pctTVAB > 0 && (
                                  <div
                                    className="bg-amber-500 h-full transition-all duration-700 ease-out"
                                    style={{ width: `${pctTVAB}%` }}
                                    title={`TVA payée : ${tvaPayee.toFixed(2)} €`}
                                  ></div>
                                )}
                              </div>
                            ) : (
                              <div className="w-[20%]"></div>
                            )}
                          </div>

                          {/* TVA controls + tags */}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            {status.totalGlobal > 0 && (
                              <>
                                {status.totalHTVA > 0 && <span className="text-[10px] bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-700">HTVA: {status.totalHTVA.toFixed(2)} €</span>}
                                {status.totalTVA > 0 && <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-700">TVA: {status.totalTVA.toFixed(2)} €</span>}
                                {status.totalForfait > 0 && <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-700">Forfait: {status.totalForfait.toFixed(2)} €</span>}
                              </>
                            )}
                            {/* v5.1.0 : TVA controls */}
                            {exp.typeMontant === 'HTVA' && (
                              <>
                                <select
                                  value={exp.tauxTVA || 0}
                                  onChange={e => store.updateExpense(exp.id, { tauxTVA: parseInt(e.target.value) })}
                                  className="text-[10px] bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5"
                                >
                                  <option value={0}>TVA 0%</option>
                                  <option value={6}>TVA 6%</option>
                                  <option value={21}>TVA 21%</option>
                                </select>
                                <label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={exp.factureRecue || false}
                                    onChange={e => store.updateExpense(exp.id, { factureRecue: e.target.checked })}
                                    className="w-3 h-3 rounded"
                                  />
                                  Facture reçue
                                </label>
                                {tvaAmount > 0 && (
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400 italic">
                                    TVA attendue : {tvaAmount.toFixed(2)} € {exp.factureRecue ? '✅' : ''}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    });

                    return (
                      <>
                        {renderedExpenses}
                        {franchiseRestanteVisuelle > 0 && (
                          <div className="mt-6 p-4 bg-red-600 border-2 border-red-800 text-white rounded-xl shadow-lg flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-3xl">⚠️</span>
                              <div>
                                <h4 className="font-black text-lg uppercase tracking-wide">Dette Franchise Restante</h4>
                                <p className="text-red-100 text-sm">Les frais validés ne couvrent pas l'intégralité de la franchise.</p>
                              </div>
                            </div>
                            <span className="text-2xl font-black">{franchiseRestanteVisuelle.toFixed(2)} €</span>
                          </div>
                        )}
                        {/* v5.1.0 : Alerte franchise globale pour cet occupant */}
                        {hasFranchise && franchiseRestanteVisuelle === 0 && (
                          <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-3 flex items-center gap-3">
                            <span className="text-2xl">🔻</span>
                            <div>
                              <p className="font-bold text-red-700 dark:text-red-300 text-sm">Malus Franchise</p>
                              <p className="text-xs text-red-600 dark:text-red-400">{summary.franchiseMontant.toFixed(2)} € déduits conformément au contrat</p>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showWizard && <PaymentWizardModal onClose={() => setShowWizard(false)} />}

      {/* v5.1.0 : Modal d'attribution franchise en Post */}
      {showFranchiseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl w-[420px] shadow-2xl">
            <h3 className="text-lg font-bold mb-2">Attribution de la franchise</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">À qui attribuer la franchise de <strong className="text-red-500">{parseFranchiseMontant().toFixed(2)} €</strong> ?</p>
            <select
              className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 mb-4"
              value={franchiseTargetPost}
              onChange={e => setFranchiseTargetPost(e.target.value)}
            >
              <option value="">Choisir un bénéficiaire...</option>
              {occupants.map(o => {
                const fullName = `${o.nom || ''} ${o.prenom || ''}`.trim();
                if (!fullName) return null;
                const displayName = o.etage && o.etage.trim() !== '' ? `${o.etage} - ${fullName}` : fullName;
                return <option key={o.id} value={o.id}>{displayName}</option>;
              })}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShowFranchiseModal(false)} className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded">Annuler</button>
              <button onClick={assignFranchisePost} disabled={!franchiseTargetPost} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded font-bold disabled:opacity-50">Attribuer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TresorerieView;
