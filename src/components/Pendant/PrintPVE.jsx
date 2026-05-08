import React, { useContext } from 'react';
import { useFinanceStore } from '../../store/financeStore';
import { ExpertiseContext } from '../../context/ExpertiseContext';
import { getCompteDeName } from '../../utils/formatters';

const PrintPVE = ({ onBack }) => {
  const store = useFinanceStore();
  const context = useContext(ExpertiseContext);
  const expenses = store.metier.expenses;
  const formData = store.metier.formData;
  const occupants = store.pii.occupants;
  const totalPVE = store.getTotalPVE();
  const financialSummary = store.getFinancialSummaryByOcc(context?.formData || {});
  const recapParBeneficiaire = expenses.reduce((acc, exp) => {
    if (!exp.isProcessed) return acc;
    const name = getCompteDeName(exp.compteDe, occupants);
    const occ = occupants.find(o => o.id === exp.compteDe);
    if (!acc[name]) acc[name] = { HTVA: 0, TVAC: 0, Forfait: 0, iban: occ?.iban || '', lignes: [] };
    const val = parseFloat(String(exp.montantValide || exp.montantReclame || exp.montant || "0").replace(',', '.'));
    const safeVal = isNaN(val) ? 0 : val;
    const typeM = exp.typeMontant || 'HTVA';
    if (acc[name][typeM] !== undefined) {
       acc[name][typeM] += safeVal;
    }
    if (safeVal > 0) {
      acc[name].lignes.push({ prestataire: exp.prestataire, desc: exp.desc, montant: safeVal, type: typeM });
    }
    return acc;
  }, {});

  const totalGlobalPVE = expenses.reduce((acc, exp) => {
    if (!exp.isProcessed) return acc;
    const val = parseFloat(String(exp.montantValide || exp.montantReclame || exp.montant || "0").replace(',', '.'));
    const safeVal = isNaN(val) ? 0 : val;
    const typeM = exp.typeMontant || 'HTVA';
    if (acc[typeM] !== undefined) {
       acc[typeM] += safeVal;
    }
    return acc;
  }, { HTVA: 0, TVAC: 0, Forfait: 0 });

  return (
    <div className="flex flex-col h-full bg-slate-200 overflow-y-auto print:overflow-visible w-full p-8 print:p-0 items-center">
      <div className="w-full max-w-4xl flex justify-between mb-4 print:hidden">
        <button onClick={onBack} className="bg-slate-700 text-white px-4 py-2 rounded">Retour</button>
        <button onClick={() => window.print()} className="bg-indigo-600 text-white px-4 py-2 rounded font-bold shadow">
          🖨️ Imprimer / Sauver en PDF
        </button>
      </div>

      <div className="bg-white w-full max-w-4xl p-12 shadow-xl print:shadow-none min-h-[297mm] h-auto text-slate-800 print:w-full print:max-w-none" id="print-pve-container">

        {/* En-tête */}
        <div className="border-b-2 border-slate-800 pb-4 mb-8">
          <h1 className="text-3xl font-bold text-center uppercase tracking-wider mb-2">COMPTE-RENDU D'EXPERTISE (CRE)</h1>
          <h2 className="text-xl font-bold text-center text-slate-600">DU {new Date().toLocaleDateString('fr-FR')} - DOSSIER {formData.refPechard || formData.nomResidence || '...'}</h2>
        </div>

        {/* Informations Dossier */}
        <div className="grid grid-cols-2 gap-8 mb-8 border border-slate-300 p-4 rounded bg-slate-50">
          <div>
            <p><span className="font-bold">Dossier :</span> {formData.refPechard || formData.nomResidence || '...'}</p>
            <p><span className="font-bold">Adresse du sinistre :</span> {formData.adresse || '...'}</p>
            <p><span className="font-bold">Date du sinistre :</span> {formData.dateSinistre ? new Date(formData.dateSinistre).toLocaleDateString('fr-FR') : '...'}</p>
          </div>
          <div>
            <p><span className="font-bold">Date d'expertise :</span> {new Date().toLocaleDateString('fr-FR')}</p>
            <p><span className="font-bold">Franchise applicable :</span> {formData.franchise || 'Non précisée'}</p>
            <p><span className="font-bold">Pertes indirectes :</span> {formData.pertesIndirectes || 'Non précisées'}</p>
          </div>
        </div>

        {/* Compte Rendu (si existant) */}
        {formData.compteRendu && (
          <div className="mb-8 break-inside-avoid">
            <h3 className="text-lg font-bold mb-4 uppercase text-slate-700 border-b pb-2">Notes & Compte-rendu</h3>
            <div className="bg-slate-50 border border-slate-300 p-4 rounded text-sm whitespace-pre-wrap">
              {formData.compteRendu}
            </div>
          </div>
        )}

        {/* Tableau des Frais */}
        <div className="mb-8">
          <h3 className="text-lg font-bold mb-4 uppercase text-slate-700 border-b pb-2">Détail de la réclamation et fixation</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="border p-2 w-1/4">Poste / Prestataire</th>
                <th className="border p-2">Bénéficiaire</th>
                <th className="border p-2">Catégorie</th>
                <th className="border p-2 text-right">Réclamé</th>
                <th className="border p-2 text-right">Accordé</th>
                <th className="border p-2">Motif (si différent)</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => {
                const valReclame = parseFloat(String(exp.montantReclame || exp.montant || '0').replace(',', '.'));
                const valAccorde = parseFloat(String(exp.montantValide || exp.montantReclame || exp.montant || '0').replace(',', '.'));
                let bgClass = "bg-white";
                if (valAccorde === 0) bgClass = "bg-red-50";
                else if (valAccorde < valReclame) bgClass = "bg-orange-50";
                else bgClass = "bg-emerald-50";

                return (
                <tr key={exp.id} className={`border-b break-inside-avoid ${bgClass}`}>
                  <td className="border p-2">
                    <div className="font-bold">
                      {exp.prestataire || 'Frais'}
                      {exp.isSpontane && (
                        <span className="ml-2 inline-flex items-center gap-1 bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm print:border print:border-fuchsia-600 print:text-fuchsia-600 print:bg-none print:shadow-none">
                          ✨ Spontané
                        </span>
                      )}
                      {exp.isFranchise && (
                        <span className="ml-2 inline-flex items-center gap-1 bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Franchise
                        </span>
                      )}
                    </div>
                    {exp.ref && <div className="text-xs text-slate-600 font-medium">Réf: {exp.ref}</div>}
                    <div className="text-xs text-slate-500">{exp.desc}</div>
                  </td>
                  <td className="border p-2 text-slate-700">{getCompteDeName(exp.compteDe, occupants)}</td>
                  <td className="border p-2 text-xs">{exp.isFranchise ? 'Franchise' : (exp.categorieGarantie === 'Complémentaire' ? 'Compl.' : 'Princ.')}</td>
                  <td className="border p-2 text-right">{exp.montantReclame || exp.montant || '0.00'} €</td>
                  <td className="border p-2 text-right font-bold">
                      {exp.montantValide || exp.montantReclame || exp.montant || '0.00'} €
                      <div className="text-[10px] font-normal text-slate-500">{exp.typeMontant || 'HTVA'}</div>
                  </td>
                  <td className="border p-2 text-xs italic text-red-600">
                    {exp.motifRefus || ''}
                  </td>
                </tr>
              )})}
            </tbody>
            <tfoot>
              <tr className="bg-slate-200 font-bold text-base">
                <td className="border p-3 text-right align-top" colSpan="4">TOTAL DE L'INDEMNITÉ FIXÉE :</td>
                <td className="border p-3 text-right text-emerald-700">
                    <div className="flex flex-col gap-1 items-end">
                        {totalGlobalPVE.HTVA > 0 && <span>{totalGlobalPVE.HTVA.toFixed(2)} € <span className="text-[10px] text-slate-500 font-normal">HTVA</span></span>}
                        {totalGlobalPVE.Forfait > 0 && <span>{totalGlobalPVE.Forfait.toFixed(2)} € <span className="text-[10px] text-slate-500 font-normal">Forfait</span></span>}
                        {totalGlobalPVE.HTVA === 0 && totalGlobalPVE.Forfait === 0 && <span>0.00 €</span>}
                    </div>
                </td>
                <td className="border p-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Récapitulatif par Bénéficiaire */}
        {Object.keys(recapParBeneficiaire).length > 0 && (
          <div className="mb-8 break-inside-avoid">
              <h3 className="text-base font-bold mb-2 uppercase text-slate-700">Récapitulatif par bénéficiaire</h3>
              <div className="border border-slate-300 p-4 rounded bg-slate-50 text-sm">
                  <ul className="list-none space-y-1">
                      {Object.entries(recapParBeneficiaire).map(([name, totals]) => (
                          <li key={name} className="flex flex-col border-b border-slate-200 py-3 last:border-0 max-w-xl">
                            <div className="flex justify-between items-center mb-2">
                              <span>
                                  <span className="font-bold">{name}</span>
                                  {totals.iban && <span className="ml-2 text-[10px] italic text-slate-500">(IBAN: {totals.iban})</span>}
                              </span>
                              <span className="text-right flex gap-3 font-bold text-slate-800">
                                  {totals.HTVA > 0 && <span>{totals.HTVA.toFixed(2)} € HTVA</span>}
                                  {totals.TVAC > 0 && <span>{totals.TVAC.toFixed(2)} € TVAC</span>}
                                  {totals.Forfait > 0 && <span>{totals.Forfait.toFixed(2)} € Forfait</span>}
                              </span>
                            </div>
                            {totals.lignes && totals.lignes.length > 0 && (
                              <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
                                {totals.lignes.map((l, i) => (
                                  <li key={i}>
                                    <span className="font-semibold">{l.prestataire || 'Frais'}</span> {l.desc ? `- ${l.desc}` : ''} ({l.montant.toFixed(2)} € {l.type})
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                      ))}
                  </ul>
              </div>
          </div>
        )}

        {/* v5.1.0 : Ventilation financière */}
        {Object.keys(financialSummary).length > 0 && (
          <div className="mb-8 break-inside-avoid">
            <h3 className="text-base font-bold mb-2 uppercase text-slate-700 border-b pb-2">Ventilation financière</h3>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left text-xs uppercase">
                  <th className="border p-2">Bénéficiaire</th>
                  <th className="border p-2 text-right">Principale</th>
                  <th className="border p-2 text-right">Complémentaire</th>
                  <th className="border p-2 text-right">Franchise</th>
                  <th className="border p-2 text-right">Pertes Ind.</th>
                  <th className="border p-2 text-right font-bold">Total Net</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(financialSummary).map(([occId, data]) => (
                  <tr key={occId} className="border-b">
                    <td className="border p-2 font-bold">{data.etage ? `${data.etage} - ` : ''}{data.nom || 'Non attribué'}</td>
                    <td className="border p-2 text-right">{data.totalPrincipale > 0 ? data.totalPrincipale.toFixed(2) + ' €' : '-'}</td>
                    <td className="border p-2 text-right">{data.totalComplementaire > 0 ? data.totalComplementaire.toFixed(2) + ' €' : '-'}</td>
                    <td className="border p-2 text-right text-red-600 font-bold">{data.franchiseMontant < 0 ? data.franchiseMontant.toFixed(2) + ' €' : '-'}</td>
                    <td className="border p-2 text-right text-purple-600">{data.pertesIndirectes > 0 ? '+' + data.pertesIndirectes.toFixed(2) + ' €' : '-'}</td>
                    <td className="border p-2 text-right font-bold text-lg">{data.totalNet.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}



      </div>
    </div>
  );
};

export default PrintPVE;
