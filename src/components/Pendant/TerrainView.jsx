
import React, { useState, useContext } from 'react';
import PrintPVE from "./PrintPVE";
import { useFinanceStore } from '../../store/financeStore';
import { ExpertiseContext } from '../../context/ExpertiseContext';

const TerrainView = () => {
  const store = useFinanceStore();
  const context = useContext(ExpertiseContext);
  const expenses = store.metier.expenses;
  const occupants = store.pii.occupants;
  const attachedFiles = context?.attachedFiles || {};

  const isPVEClosed = store.metier.isPVEClosed;
  const totalPVE = store.getTotalPVE();
  const totalReclame = store.getTotalReclame();

  const [editModalExp, setEditModalExp] = useState(null);
  const [editData, setEditData] = useState({ montantValide: "", motifRefus: "" });
  const [showSpontaneModal, setShowSpontaneModal] = useState(false);
  const [spontaneData, setSpontaneData] = useState({ prestataire: '', montant: '' });

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
    // Fallback pour les vieilles données (texte libre)
    return compteDe;
  };

  const handleValid100 = (exp) => {
    store.updateExpense(exp.id, {
      montantValide: exp.montantReclame || exp.montant || "0",
      pourcentageVetuste: 0,
      motifRefus: '',
      isProcessed: true
    });
  };

  const openEditModal = (exp) => {
    setEditModalExp(exp);
    setEditData({
      montantValide: exp.montantValide || exp.montantReclame || exp.montant || "",
      motifRefus: exp.motifRefus || ""
    });
  };

  const submitEdit = () => {
    if (editModalExp) {
      store.updateExpense(editModalExp.id, {
        montantValide: editData.montantValide,
        motifRefus: editData.motifRefus,
        isProcessed: true
      });
    }
    setEditModalExp(null);
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Colonne À Traiter */}
        <div>
            <h3 className="text-lg font-bold mb-4 uppercase text-slate-500 border-b-2 border-slate-300 pb-2">⏳ À Traiter ({expenses.filter(e => !e.isProcessed).length})</h3>
            <div className="space-y-4">
                {expenses.filter(e => !e.isProcessed).map(exp => {
                const files = attachedFiles[exp.id] || [];
                const hasFiles = files.length > 0;
                return (
                    <div key={exp.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow border-l-4 border-indigo-500 flex flex-col justify-between items-start gap-4">
                        <div className="flex items-start gap-4 w-full">
                            {hasFiles && (
                            <button
                                onClick={() => context.handleOpenFile(files[0].dbKey, files[0].isPdf)}
                                className="w-12 h-12 flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full text-2xl shrink-0 shadow-sm"
                                title="Ouvrir le justificatif"
                            >
                                👁️
                            </button>
                            )}
                            <div className="flex-1">
                                <h3 className="font-bold text-lg">{exp.prestataire || 'Prestataire Inconnu'} <span className="text-sm font-normal text-slate-500 block">Pour: {getCompteDeName(exp.compteDe)}</span></h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 italic mb-2">{exp.desc || 'Aucune description'}</p>
                                <div className="text-sm bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 p-2 rounded inline-block">
                                    Réclamé : <span className="font-bold text-lg">{exp.montantReclame || exp.montant || '0.00'} €</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex w-full gap-2 mt-2">
                            <button disabled={isPVEClosed} onClick={() => handleValid100(exp)} className="flex-1 bg-emerald-100 text-emerald-700 py-2 rounded font-bold hover:bg-emerald-200 disabled:opacity-50 flex justify-center items-center gap-2">✅ Valider (100%)</button>
                            <button disabled={isPVEClosed} onClick={() => openEditModal(exp)} className="flex-1 bg-orange-100 text-orange-700 py-2 rounded font-bold hover:bg-orange-200 disabled:opacity-50 flex justify-center items-center gap-2">✏️ Modifier</button>
                        </div>
                    </div>
                );
                })}
                {expenses.filter(e => !e.isProcessed).length === 0 && <p className="text-center text-slate-500 italic py-8">Tout est traité ! 🎉</p>}
            </div>
        </div>

        {/* Colonne Validés */}
        <div>
            <h3 className="text-lg font-bold mb-4 uppercase text-slate-500 border-b-2 border-slate-300 pb-2">✅ Traités ({expenses.filter(e => e.isProcessed).length})</h3>
            <div className="space-y-4">
                {expenses.filter(e => e.isProcessed).map(exp => {
                const files = attachedFiles[exp.id] || [];
                const hasFiles = files.length > 0;
                return (
                    <div key={exp.id} className="bg-emerald-50 dark:bg-slate-800 p-4 rounded-xl shadow border-l-4 border-emerald-500 flex flex-col md:flex-row justify-between items-center gap-4 opacity-80 hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-4 flex-1">
                            {hasFiles && (
                            <button
                                onClick={() => context.handleOpenFile(files[0].dbKey, files[0].isPdf)}
                                className="w-10 h-10 flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full text-xl shrink-0 shadow-sm"
                                title="Ouvrir le justificatif"
                            >
                                👁️
                            </button>
                            )}
                            <div className="flex-1">
                                <h3 className="font-bold text-base">{exp.prestataire || 'Prestataire Inconnu'}</h3>
                                <div className="mt-1 text-xs">
                                    <span className="text-slate-500">Réclamé: {exp.montantReclame || exp.montant || '0.00'} €</span>
                                    {exp.motifRefus && <span className="text-red-500 ml-2 font-bold">(Motif: {exp.motifRefus})</span>}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end shrink-0">
                            <span className="text-lg font-bold text-emerald-600 mb-1">Accordé : {exp.montantValide || exp.montantReclame || exp.montant || '0.00'} €</span>
                            <button disabled={isPVEClosed} onClick={() => openEditModal(exp)} className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded hover:bg-slate-300">Corriger</button>
                        </div>
                    </div>
                );
                })}
                {expenses.filter(e => e.isProcessed).length === 0 && <p className="text-center text-slate-500 italic py-8">Aucun frais n'a encore été traité.</p>}
            </div>
        </div>

      </div>

      {/* Modal Edition */}
      {editModalExp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl w-96 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Modifier la ligne ({editModalExp.prestataire})</h3>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">Montant Retenu (PVE) en €</label>
              <input
                type="number"
                className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 font-bold text-emerald-600"
                value={editData.montantValide}
                onChange={e => setEditData({...editData, montantValide: e.target.value})}
              />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-bold mb-1">Motif de la modification / refus</label>
              <textarea
                className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 h-24"
                value={editData.motifRefus}
                onChange={e => setEditData({...editData, motifRefus: e.target.value})}
                placeholder="Ex: Vétusté peinture, Hors garantie..."
              ></textarea>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditModalExp(null)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded">Annuler</button>
              <button onClick={submitEdit} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold">Enregistrer</button>
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
