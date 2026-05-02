import React from 'react';
import { useFinanceStore } from '../../store/financeStore';

const PrintPVE = ({ onBack }) => {
  const store = useFinanceStore();
  const expenses = store.metier.expenses;
  const formData = store.metier.formData;
  const occupants = store.pii.occupants;
  const totalPVE = store.getTotalPVE();

  const getCompteDeName = (compteDe) => {
    if (!compteDe) return 'Non attribué';
    const occ = occupants.find(o => o.id === compteDe);
    if (occ) {
        const nomAffiche = occ.nom || '';
        if (occ.etage && occ.etage.trim() !== '') {
            return `${nomAffiche} (${occ.etage.trim()})`;
        }
        return nomAffiche;
    }
    return compteDe;
  };

  const recapParBeneficiaire = expenses.reduce((acc, exp) => {
    if (!exp.isProcessed) return acc;
    const name = getCompteDeName(exp.compteDe);
    if (!acc[name]) acc[name] = 0;
    const val = parseFloat(String(exp.montantValide || exp.montantReclame || exp.montant || "0").replace(',', '.'));
    acc[name] += (isNaN(val) ? 0 : val);
    return acc;
  }, {});

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
          <h1 className="text-3xl font-bold text-center uppercase tracking-wider mb-2">RÉSUMÉ DE RÉPARTITION FINANCIÈRE</h1>
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

        {/* Tableau des Frais */}
        <div className="mb-8">
          <h3 className="text-lg font-bold mb-4 uppercase text-slate-700 border-b pb-2">Détail de la réclamation et fixation</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-100 text-left">
                <th className="border p-2 w-1/4">Poste / Prestataire</th>
                <th className="border p-2">Bénéficiaire</th>
                <th className="border p-2 text-right">Réclamé</th>
                <th className="border p-2 text-right">Accordé</th>
                <th className="border p-2">Motif (si différent)</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => (
                <tr key={exp.id} className="border-b break-inside-avoid">
                  <td className="border p-2">
                    <div className="font-bold">{exp.prestataire || 'Frais'}</div>
                    <div className="text-xs text-slate-500">{exp.desc}</div>
                  </td>
                  <td className="border p-2 text-slate-700">{getCompteDeName(exp.compteDe)}</td>
                  <td className="border p-2 text-right">{exp.montantReclame || exp.montant || '0.00'} €</td>
                  <td className="border p-2 text-right font-bold">
                      {exp.montantValide || exp.montantReclame || exp.montant || '0.00'} €
                      <div className="text-[10px] font-normal text-slate-500">{exp.typeMontant || 'HTVA'}</div>
                  </td>
                  <td className="border p-2 text-xs italic text-red-600">
                    {exp.motifRefus || ''}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-200 font-bold text-base">
                <td className="border p-3 text-right" colSpan="3">TOTAL DE L'INDEMNITÉ FIXÉE :</td>
                <td className="border p-3 text-right text-emerald-700">{totalPVE.toFixed(2)} €</td>
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
                      {Object.entries(recapParBeneficiaire).map(([name, total]) => (
                          <li key={name} className="flex justify-between max-w-sm">
                            <span className="font-bold">{name}</span>
                            <span>{total.toFixed(2)} € (HTVA)</span>
                          </li>
                      ))}
                  </ul>
              </div>
          </div>
        )}

        {/* Bloc IBANs */}
        <div className="mb-8 break-inside-avoid">
            <h3 className="text-base font-bold mb-2 uppercase text-slate-700">Coordonnées Bancaires (IBAN)</h3>
            <div className="border border-slate-300 p-4 rounded bg-slate-50 text-sm">
                {occupants.filter(o => o.iban && o.iban.trim() !== '').length > 0 ? (
                    <ul className="list-disc pl-5">
                        {occupants.filter(o => o.iban && o.iban.trim() !== '').map(o => (
                            <li key={o.id} className="mb-1"><span className="font-bold">{o.nom} {o.prenom}</span> : {o.iban}</li>
                        ))}
                    </ul>
                ) : (
                    <p className="italic text-slate-500">Aucun IBAN renseigné pour ce dossier.</p>
                )}
            </div>
        </div>

        {/* Signatures */}
        <div className="mt-16 grid grid-cols-2 gap-16">
          <div className="border border-slate-300 p-4 h-40 rounded relative">
            <span className="absolute top-2 left-4 text-xs font-bold text-slate-500 uppercase">Pour l'Assuré(e) / Le Mandant</span>
            <div className="absolute bottom-2 left-4 text-xs text-slate-400">Lu et approuvé</div>
          </div>
          <div className="border border-slate-300 p-4 h-40 rounded relative">
            <span className="absolute top-2 left-4 text-xs font-bold text-slate-500 uppercase">L'Expert de la Compagnie</span>
            <div className="absolute bottom-2 left-4 text-xs text-slate-400">Sous toutes réserves d'usage</div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PrintPVE;
