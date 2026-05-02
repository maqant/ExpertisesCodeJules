import React, { useState } from 'react';
import PrintPVE from "./PrintPVE";
import { useFinanceStore } from '../../store/financeStore';

const TerrainView = () => {
  const store = useFinanceStore();
  const expenses = store.metier.expenses;
  const isPVEClosed = store.metier.isPVEClosed;
  const totalPVE = store.getTotalPVE();
  const totalReclame = store.getTotalReclame();

  const [motifModalExp, setMotifModalExp] = useState(null);
  const [motifText, setMotifText] = useState("");
  const [showSpontaneModal, setShowSpontaneModal] = useState(false);
  const [spontaneData, setSpontaneData] = useState({ prestataire: '', montant: '' });

  const handleValid100 = (id, montantReclame) => {
    store.updateExpense(id, { pourcentageVetuste: 0, motifRefus: '' });
  };

  const handleVetuste = (id, pct) => {
    store.updateExpense(id, { pourcentageVetuste: pct, motifRefus: '' });
  };

  const openRefusModal = (exp) => {
    setMotifModalExp(exp);
    setMotifText(exp.motifRefus || "");
  };

  const submitRefus = () => {
    if (motifModalExp) {
      store.updateExpense(motifModalExp.id, { pourcentageVetuste: 100, motifRefus: motifText });
    }
    setMotifModalExp(null);
  };

  const addSpontane = () => {
    if (spontaneData.prestataire && spontaneData.montant) {
      store.addExpense({
        prestataire: spontaneData.prestataire,
        montantReclame: spontaneData.montant,
        montantValide: spontaneData.montant,
        type: 'Forfait',
        desc: 'Frais spontané sur place'
      });
      setShowSpontaneModal(false);
      setSpontaneData({ prestataire: '', montant: '' });
    }
  };

  const [showPrintPVE, setShowPrintPVE] = useState(false);

  if (showPrintPVE) {
    return <PrintPVE onBack={() => setShowPrintPVE(false)} />;
  }

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-white p-4 overflow-y-auto w-full relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Expertise Terrain (Fixation PVE)</h1>
        <button
          onClick={() => store.togglePVEStatus()}
          className={`px-4 py-2 rounded font-bold ${isPVEClosed ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}
        >
          {isPVEClosed ? 'Rouvrir l\'expertise' : '🔒 Clôturer l\'expertise'}
        </button>
      </div>

      {/* Jauge PVE */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6 mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-lg">Total Réclamé : {totalReclame.toFixed(2)} €</span>
          <span className="text-2xl font-bold text-emerald-500">Total Validé (PVE) : {totalPVE.toFixed(2)} €</span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 h-4 rounded-full overflow-hidden">
          <div
            className="bg-emerald-500 h-full transition-all duration-500"
            style={{ width: `${totalReclame > 0 ? (totalPVE / totalReclame) * 100 : 0}%` }}
          ></div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Lignes de Frais</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowPrintPVE(true)}
            className="bg-slate-700 text-white px-4 py-2 rounded shadow hover:bg-slate-600 flex items-center gap-2"
          >
            🖨️ Générer PVE
          </button>
          <button
            onClick={() => setShowSpontaneModal(true)}
            disabled={isPVEClosed}
            className="bg-indigo-600 text-white px-4 py-2 rounded shadow disabled:opacity-50"
          >
            + Frais Spontané
          </button>
        </div>
      </div>

      {/* Liste des frais */}
      <div className="space-y-4">
        {expenses.map(exp => (
          <div key={exp.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex-1">
              <h3 className="font-bold text-lg">{exp.prestataire || 'Prestataire Inconnu'}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{exp.desc || 'Aucune description'}</p>
              <div className="mt-2 text-sm">
                Réclamé: <span className="font-semibold">{exp.montantReclame} €</span>
                {exp.pourcentageVetuste > 0 && <span className="text-orange-500 ml-2">(-{exp.pourcentageVetuste}%)</span>}
                {exp.motifRefus && <span className="text-red-500 ml-2">(Refusé: {exp.motifRefus})</span>}
              </div>
            </div>

            <div className="flex flex-col items-end">
              <span className="text-xl font-bold text-emerald-500 mb-2">{exp.montantValide || '0.00'} €</span>

              <div className="flex gap-2">
                <button disabled={isPVEClosed} onClick={() => handleValid100(exp.id, exp.montantReclame)} className="bg-emerald-100 text-emerald-700 px-3 py-2 rounded font-bold hover:bg-emerald-200 disabled:opacity-50">100%</button>
                <button disabled={isPVEClosed} onClick={() => handleVetuste(exp.id, 20)} className="bg-orange-100 text-orange-700 px-3 py-2 rounded font-bold hover:bg-orange-200 disabled:opacity-50">-20%</button>
                <button disabled={isPVEClosed} onClick={() => handleVetuste(exp.id, 30)} className="bg-orange-100 text-orange-700 px-3 py-2 rounded font-bold hover:bg-orange-200 disabled:opacity-50">-30%</button>
                <button disabled={isPVEClosed} onClick={() => openRefusModal(exp)} className="bg-red-100 text-red-700 px-3 py-2 rounded font-bold hover:bg-red-200 disabled:opacity-50">Refuser</button>
              </div>
            </div>
          </div>
        ))}
        {expenses.length === 0 && <p className="text-center text-slate-500 italic py-8">Aucun frais encodé pour le moment.</p>}
      </div>

      {/* Modal Refus */}
      {motifModalExp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl w-96">
            <h3 className="text-lg font-bold mb-4">Motif de refus ({motifModalExp.prestataire})</h3>
            <textarea
              className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 mb-4 h-24"
              value={motifText}
              onChange={e => setMotifText(e.target.value)}
              placeholder="Ex: Non imputable au sinistre..."
            ></textarea>
            <div className="flex justify-end gap-2">
              <button onClick={() => setMotifModalExp(null)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded">Annuler</button>
              <button onClick={submitRefus} className="px-4 py-2 bg-red-600 text-white rounded">Confirmer Refus</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Spontané */}
      {showSpontaneModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl w-96">
            <h3 className="text-lg font-bold mb-4">Ajouter un frais spontané</h3>
            <input
              type="text" placeholder="Prestataire / Type de frais"
              className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 mb-3"
              value={spontaneData.prestataire} onChange={e => setSpontaneData({...spontaneData, prestataire: e.target.value})}
            />
            <input
              type="number" placeholder="Montant accordé (€)"
              className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 mb-4"
              value={spontaneData.montant} onChange={e => setSpontaneData({...spontaneData, montant: e.target.value})}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSpontaneModal(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded">Annuler</button>
              <button onClick={addSpontane} className="px-4 py-2 bg-indigo-600 text-white rounded">Ajouter</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TerrainView;
