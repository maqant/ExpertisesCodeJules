
import React, { useState, useContext } from 'react';
import PrintPVE from "./PrintPVE";
import { useFinanceStore } from '../../store/financeStore';
import { ExpertiseContext } from '../../context/ExpertiseContext';
import { getCompteDeName } from '../../utils/formatters';
import { reformatCompteRendu } from '../../services/aiManager';

const TerrainView = () => {
  const store = useFinanceStore();
  const context = useContext(ExpertiseContext);
  const occupants = store.pii.occupants;
  const expenses = store.metier.expenses.filter(exp => {
    // Règle Métier : Exclure les frais liés à une "Contre-Expertise"
    const occ = occupants.find(o => o.id === exp.compteDe);
    return !(occ && occ.contreExpert);
  });
  const attachedFiles = context?.attachedFiles || {};

  const isPVEClosed = store.metier.isPVEClosed;
  const totalPVE = store.getTotalPVE();
  const totalReclame = store.getTotalReclame();

  const [editModalExp, setEditModalExp] = useState(null);
  const [editData, setEditData] = useState({ montantValide: "", motifRefus: "", isSpontane: false, categorieGarantie: '' });
  const [showSpontaneModal, setShowSpontaneModal] = useState(false);
  const [spontaneData, setSpontaneData] = useState({ prestataire: '', montant: '', typeMontant: 'Forfait', compteDe: '', categorieGarantie: '' });

  // v5.1.0 : Modale de catégorisation (Valider)
  const [categorieModalExp, setCategorieModalExp] = useState(null);

  // v5.1.0 : Modale de clôture (franchise)
  const [showClotureModal, setShowClotureModal] = useState(false);
  const [franchiseTarget, setFranchiseTarget] = useState('');

  // v5.1.0 : Valider ouvre la modale de catégorisation
  const handleValid100 = (exp) => {
    setCategorieModalExp(exp);
  };

  const confirmCategorie = (categorie) => {
    if (categorieModalExp) {
      store.updateExpense(categorieModalExp.id, {
        montantValide: categorieModalExp.montantReclame || categorieModalExp.montant || "0",
        pourcentageVetuste: 0,
        motifRefus: '',
        isProcessed: true,
        categorieGarantie: categorie
      });
    }
    setCategorieModalExp(null);
  };

  // v5.1.0 : Parsing du montant de franchise depuis formData
  const parseFranchiseMontant = () => {
    const str = context.formData?.franchise || '';
    const match = str.match(/([\d.,]+)\s*€?/);
    if (match) return parseFloat(match[1].replace(',', '.')) || 0;
    return parseFloat(String(str).replace(',', '.')) || 0;
  };

  const handleClotureClick = () => {
    const montant = parseFranchiseMontant();
    if (montant > 0) {
      setShowClotureModal(true);
    } else {
      store.togglePVEStatus();
    }
  };

  const confirmCloture = (mode) => {
    const montant = parseFranchiseMontant();
    if (mode === 'assign' && franchiseTarget) {
      store.generateFranchiseExpense(franchiseTarget, montant);
    } else if (mode === 'later') {
      store.setFranchiseOccId(null);
    }
    store.togglePVEStatus();
    setShowClotureModal(false);
    setFranchiseTarget('');
  };

  const [refusModalExp, setRefusModalExp] = useState(null);
  const [refusText, setRefusText] = useState("");

  const openEditModal = (exp) => {
    setEditModalExp(exp);
    setEditData({
      montantValide: exp.montantValide || exp.montantReclame || exp.montant || "",
      motifRefus: exp.motifRefus || "",
      compteDe: exp.compteDe || "",
      typeMontant: exp.typeMontant || "HTVA",
      isSpontane: exp.isSpontane || false,
      categorieGarantie: exp.categorieGarantie || ''
    });
  };

  const submitEdit = () => {
    if (editModalExp) {
      store.updateExpense(editModalExp.id, {
        montantValide: editData.montantValide,
        motifRefus: editData.motifRefus,
        compteDe: editData.compteDe,
        typeMontant: editData.typeMontant,
        isSpontane: editData.isSpontane,
        categorieGarantie: editData.categorieGarantie,
        isProcessed: true
      });
    }
    setEditModalExp(null);
  };

  const openRefusModal = (exp) => {
    setRefusModalExp(exp);
    setRefusText(exp.motifRefus || "");
  };

  const submitRefus = () => {
    if (refusModalExp) {
      store.updateExpense(refusModalExp.id, {
        montantValide: "0",
        motifRefus: refusText,
        isProcessed: true
      });
    }
    setRefusModalExp(null);
    setRefusText("");
  };

  const addSpontane = () => {
    if (spontaneData.prestataire && spontaneData.montant && spontaneData.categorieGarantie) {
      store.addExpense({
        prestataire: spontaneData.prestataire,
        montantReclame: spontaneData.montant,
        montantValide: spontaneData.montant,
        typeMontant: spontaneData.typeMontant,
        compteDe: spontaneData.compteDe,
        categorieGarantie: spontaneData.categorieGarantie,
        type: 'Forfait',
        desc: 'Frais spontané sur place',
        isSpontane: true,
        isProcessed: true
      });
      setShowSpontaneModal(false);
      setSpontaneData({ prestataire: '', montant: '', typeMontant: 'Forfait', compteDe: '', categorieGarantie: '' });
    }
  };

  const [showPrintPVE, setShowPrintPVE] = useState(false);
  const [isReformatting, setIsReformatting] = useState(false);

  const handleMagicCompteRendu = async () => {
      const notes = context.formData.compteRendu;
      if (!notes) return;
      setIsReformatting(true);
      try {
          const res = await reformatCompteRendu(
              notes,
              context.aiConfig?.provider || 'openai',
              context.aiConfig?.model || 'gpt-4o',
              context.aiConfig?.apiKey || ''
          );
          if (res.success) {
              context.setFormData(prev => ({ ...prev, compteRendu: res.data }));
          } else {
              alert("Erreur IA : " + res.error);
          }
      } catch (err) {
          alert("Erreur lors de la remise en forme : " + err.message);
      } finally {
          setIsReformatting(false);
      }
  };

  if (showPrintPVE) {
    return <PrintPVE onBack={() => setShowPrintPVE(false)} />;
  }

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-white p-4 overflow-y-auto w-full relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Expertise Terrain (Fixation PVE)</h1>
        <button
          onClick={() => isPVEClosed ? store.togglePVEStatus() : handleClotureClick()}
          className={`px-4 py-2 rounded font-bold ${isPVEClosed ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}
        >
          {isPVEClosed ? 'Rouvrir l\'expertise' : '🔒 Clôturer l\'expertise'}
        </button>
      </div>

      {/* COMPTE RENDU */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold uppercase">Compte Rendu</h2>
          {context.isAiModeActive && (
            <button
              onClick={handleMagicCompteRendu}
              disabled={isReformatting || !context.formData.compteRendu}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded shadow flex items-center gap-2 disabled:opacity-50 font-bold"
            >
              {isReformatting ? '⏳ Magie en cours...' : '✨ Magique (Remise en forme)'}
            </button>
          )}
        </div>
        <textarea
          name="compteRendu"
          value={context.formData.compteRendu || ""}
          onChange={context.handleChange}
          disabled={isPVEClosed || isReformatting}
          className="w-full bg-slate-900 text-indigo-100 border border-slate-700 rounded p-4 min-h-[200px]"
          placeholder="Prenez vos notes brutes sur le terrain ici..."
        />
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
            disabled={!isPVEClosed}
            className={`px-4 py-2 rounded shadow flex items-center gap-2 ${isPVEClosed ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-400 text-slate-200 cursor-not-allowed'}`}
            title={!isPVEClosed ? 'Clôturez l\'expertise pour générer le CRE' : ''}
          >
            🖨️ Générer CRE
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
                                <h3 className="font-bold text-lg">
                                  {exp.prestataire || 'Prestataire Inconnu'}
                                  {exp.isSpontane && (
                                    <span className="ml-2 inline-flex items-center gap-1 bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
                                      ✨ Spontané
                                    </span>
                                  )}
                                  <div className="mt-2 block">
                                    <select 
                                      className="bg-slate-800 border border-slate-700 text-indigo-300 rounded px-2 py-1 text-xs font-normal"
                                      value={exp.compteDe || ""}
                                      onChange={(e) => store.updateExpense(exp.id, { compteDe: e.target.value })}
                                      onClick={(e) => e.stopPropagation()}
                                      disabled={isPVEClosed}
                                    >
                                      <option value="">Attribuer à...</option>
                                      {occupants.map(o => {
                                        const fullName = `${o.nom || ''} ${o.prenom || ''}`.trim();
                                        if (!fullName) return null;
                                        const displayName = o.etage && o.etage.trim() !== '' ? `${o.etage} - ${fullName}` : fullName;
                                        return <option key={o.id} value={o.id}>{displayName}</option>;
                                      })}
                                    </select>
                                  </div>
                                </h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 italic mb-2">{exp.desc || 'Aucune description'}</p>
                                <div className="text-sm bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 p-2 rounded inline-block">
                                    Réclamé : <span className="font-bold text-lg">{exp.montantReclame || exp.montant || '0.00'} €</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex w-full gap-2 mt-2">
                            <button disabled={isPVEClosed} onClick={() => handleValid100(exp)} className="flex-1 bg-emerald-100 text-emerald-700 py-2 rounded font-bold hover:bg-emerald-200 disabled:opacity-50 flex justify-center items-center gap-1">✅ Valider</button>
                            <button disabled={isPVEClosed} onClick={() => openEditModal(exp)} className="flex-1 bg-orange-100 text-orange-700 py-2 rounded font-bold hover:bg-orange-200 disabled:opacity-50 flex justify-center items-center gap-1">✏️ Modifier</button>
                            <button disabled={isPVEClosed} onClick={() => openRefusModal(exp)} className="flex-1 bg-red-100 text-red-700 py-2 rounded font-bold hover:bg-red-200 disabled:opacity-50 flex justify-center items-center gap-1">❌ Refuser</button>
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

                const valReclame = parseFloat(String(exp.montantReclame || exp.montant || '0').replace(',', '.'));
                const valAccorde = parseFloat(String(exp.montantValide || exp.montantReclame || exp.montant || '0').replace(',', '.'));

                let bgColor = "bg-emerald-50 dark:bg-emerald-900/10";
                let borderColor = "border-emerald-500";
                let textColor = "text-emerald-600";

                if (valAccorde === 0) {
                    bgColor = "bg-red-50 dark:bg-red-900/10";
                    borderColor = "border-red-500";
                    textColor = "text-red-600";
                } else if (valAccorde < valReclame) {
                    bgColor = "bg-orange-50 dark:bg-orange-900/10";
                    borderColor = "border-orange-500";
                    textColor = "text-orange-600";
                }

                return (
                    <div key={exp.id} className={`${bgColor} dark:bg-slate-800 p-4 rounded-xl shadow border-l-4 ${borderColor} flex flex-col md:flex-row justify-between items-center gap-4 opacity-90 hover:opacity-100 transition-opacity`}>
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
                                <h3 className="font-bold text-base">
                                  {exp.prestataire || 'Prestataire Inconnu'}
                                  {exp.isSpontane && (
                                    <span className="ml-2 inline-flex items-center gap-1 bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                      ✨ Spontané
                                    </span>
                                  )}
                                  <div className="mt-2 block">
                                    <select 
                                      className="bg-slate-800 border border-slate-700 text-indigo-300 rounded px-2 py-1 text-xs font-normal"
                                      value={exp.compteDe || ""}
                                      onChange={(e) => store.updateExpense(exp.id, { compteDe: e.target.value })}
                                      onClick={(e) => e.stopPropagation()}
                                      disabled={isPVEClosed}
                                    >
                                      <option value="">Attribuer à...</option>
                                      {occupants.map(o => {
                                        const fullName = `${o.nom || ''} ${o.prenom || ''}`.trim();
                                        if (!fullName) return null;
                                        const displayName = o.etage && o.etage.trim() !== '' ? `${o.etage} - ${fullName}` : fullName;
                                        return <option key={o.id} value={o.id}>{displayName}</option>;
                                      })}
                                    </select>
                                  </div>
                                </h3>
                                <div className="mt-1 text-xs">
                                    <span className="text-slate-500">Réclamé: {exp.montantReclame || exp.montant || '0.00'} €</span>
                                    {exp.motifRefus && <span className="text-red-500 ml-2 font-bold">(Motif: {exp.motifRefus})</span>}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-end shrink-0">
                            <span className={`text-lg font-bold ${textColor} mb-1`}>Accordé : {exp.montantValide || exp.montantReclame || exp.montant || '0.00'} €</span>
                            <button disabled={isPVEClosed} onClick={() => openEditModal(exp)} className="text-xs bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-1 rounded hover:bg-slate-300 dark:hover:bg-slate-600">Corriger</button>
                        </div>
                    </div>
                );
                })}
                {expenses.filter(e => e.isProcessed).length === 0 && <p className="text-center text-slate-500 italic py-8">Aucun frais n'a encore été traité.</p>}
            </div>
        </div>

      </div>

      {/* Modal Refus */}
      {refusModalExp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl w-96 shadow-2xl">
            <h3 className="text-lg font-bold mb-4 text-red-600">Refuser le frais ({refusModalExp.prestataire})</h3>
            <div className="mb-6">
              <label className="block text-sm font-bold mb-1">Motif du refus (Optionnel)</label>
              <textarea
                className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 h-24"
                value={refusText}
                onChange={e => setRefusText(e.target.value)}
                placeholder="Ex: Doublon, Non couvert..."
              ></textarea>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setRefusModalExp(null)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded">Annuler</button>
              <button onClick={submitRefus} className="px-4 py-2 bg-red-600 text-white rounded font-bold">Confirmer Refus</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edition */}
      {editModalExp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl w-96 shadow-2xl" onKeyDown={e => e.key === 'Enter' && submitEdit()}>
            <h3 className="text-lg font-bold mb-4">Modifier la ligne ({editModalExp.prestataire})</h3>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">Bénéficiaire (Compte de)</label>
              <select
                className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                value={editData.compteDe}
                onChange={e => setEditData({...editData, compteDe: e.target.value})}
              >
                <option value="">Non attribué</option>
                {occupants.filter(o => o.nom).map(o => (
                  <option key={o.id} value={o.id}>{o.nom} {o.prenom}</option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">Montant Retenu (PVE) en €</label>
              <div className="flex gap-2">
                <input
                  type="number" autoFocus
                  className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 font-bold text-emerald-600"
                  value={editData.montantValide}
                  onChange={e => setEditData({...editData, montantValide: e.target.value})}
                />
                <select
                  className="p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                  value={editData.typeMontant}
                  onChange={e => setEditData({...editData, typeMontant: e.target.value})}
                >
                  <option value="HTVA">HTVA</option>
                  <option value="Forfait">Forfait</option>
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">Catégorie de garantie</label>
              <select
                className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                value={editData.categorieGarantie}
                onChange={e => setEditData({...editData, categorieGarantie: e.target.value})}
              >
                <option value="">Choisir...</option>
                <option value="Principale">🏠 Garantie Principale (Bâtiment)</option>
                <option value="Complémentaire">📋 Garantie Complémentaire (Frais/Cause)</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">Motif de la modification (Optionnel)</label>
              <input type="text"
                className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                value={editData.motifRefus}
                onChange={e => setEditData({...editData, motifRefus: e.target.value})}
                placeholder="Ex: Vétusté peinture, Hors garantie..."
              />
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
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl w-96 shadow-2xl" onKeyDown={e => e.key === 'Enter' && addSpontane()}>
            <h3 className="text-lg font-bold mb-4">Ajouter un frais spontané</h3>
            <input
              type="text" autoFocus placeholder="Prestataire / Type de frais"
              className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 mb-3"
              value={spontaneData.prestataire} onChange={e => setSpontaneData({...spontaneData, prestataire: e.target.value})}
            />
            <div className="flex gap-2 mb-4">
              <input
                type="number" placeholder="Montant accordé (€)"
                className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                value={spontaneData.montant} onChange={e => setSpontaneData({...spontaneData, montant: e.target.value})}
              />
              <select
                className="p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                value={spontaneData.typeMontant}
                onChange={e => setSpontaneData({...spontaneData, typeMontant: e.target.value})}
              >
                <option value="HTVA">HTVA</option>
                <option value="Forfait">Forfait</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-bold mb-1">Catégorie de garantie</label>
              <select
                className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                value={spontaneData.categorieGarantie}
                onChange={e => setSpontaneData({...spontaneData, categorieGarantie: e.target.value})}
              >
                <option value="">Choisir...</option>
                <option value="Principale">🏠 Garantie Principale (Bâtiment)</option>
                <option value="Complémentaire">📋 Garantie Complémentaire (Frais/Cause)</option>
              </select>
            </div>
            <div className="mb-4">
              <select
                className="w-full bg-slate-800 border border-slate-700 text-indigo-300 rounded px-2 py-1 text-xs"
                value={spontaneData.compteDe || ""}
                onChange={e => setSpontaneData({...spontaneData, compteDe: e.target.value})}
              >
                <option value="">Attribuer à...</option>
                {occupants.map(o => {
                  const fullName = `${o.nom || ''} ${o.prenom || ''}`.trim();
                  if (!fullName) return null;
                  const displayName = o.etage && o.etage.trim() !== '' ? `${o.etage} - ${fullName}` : fullName;
                  return <option key={o.id} value={o.id}>{displayName}</option>;
                })}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSpontaneModal(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded">Annuler</button>
              <button onClick={addSpontane} disabled={!spontaneData.categorieGarantie} className="px-4 py-2 bg-indigo-600 text-white rounded font-bold disabled:opacity-50">Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Catégorisation (v5.1.0) */}
      {categorieModalExp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl w-[420px] shadow-2xl">
            <h3 className="text-lg font-bold mb-2">Catégorie de garantie</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Pour <strong>{categorieModalExp.prestataire}</strong> — {categorieModalExp.montantReclame || categorieModalExp.montant || '0'} €</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => confirmCategorie('Principale')}
                className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors text-center"
              >
                <span className="text-2xl block mb-1">🏠</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">Garantie Principale</span>
                <span className="block text-xs text-slate-500 mt-1">Bâtiment</span>
              </button>
              <button
                onClick={() => confirmCategorie('Complémentaire')}
                className="p-4 rounded-xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-center"
              >
                <span className="text-2xl block mb-1">📋</span>
                <span className="font-bold text-blue-700 dark:text-blue-300 text-sm">Garantie Complémentaire</span>
                <span className="block text-xs text-slate-500 mt-1">Frais / Cause</span>
              </button>
            </div>
            <button onClick={() => setCategorieModalExp(null)} className="w-full text-center text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">Annuler</button>
          </div>
        </div>
      )}

      {/* Modal Clôture Franchise (v5.1.0) */}
      {showClotureModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl w-[420px] shadow-2xl">
            <h3 className="text-lg font-bold mb-2">🔒 Attribution de la franchise</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">À qui attribuer la franchise de <strong className="text-red-500">{parseFranchiseMontant().toFixed(2)} €</strong> ?</p>
            <select
              className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 mb-4"
              value={franchiseTarget}
              onChange={e => setFranchiseTarget(e.target.value)}
            >
              <option value="">Choisir un bénéficiaire...</option>
              {occupants.map(o => {
                const fullName = `${o.nom || ''} ${o.prenom || ''}`.trim();
                if (!fullName) return null;
                const displayName = o.etage && o.etage.trim() !== '' ? `${o.etage} - ${fullName}` : fullName;
                return <option key={o.id} value={o.id}>{displayName}</option>;
              })}
            </select>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => confirmCloture('assign')}
                disabled={!franchiseTarget}
                className="w-full px-4 py-2 bg-emerald-600 text-white rounded font-bold disabled:opacity-50 hover:bg-emerald-500"
              >
                ✅ Attribuer et clôturer
              </button>
              <button
                onClick={() => confirmCloture('later')}
                className="w-full px-4 py-2 bg-amber-500 text-white rounded font-bold hover:bg-amber-400"
              >
                ⏳ Décider plus tard
              </button>
              <button
                onClick={() => setShowClotureModal(false)}
                className="w-full text-center text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mt-1"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TerrainView;
