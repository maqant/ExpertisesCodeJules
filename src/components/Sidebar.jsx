import React, { useContext, useState } from 'react';
import { ExpertiseContext } from '../context/ExpertiseContext';

const Sidebar = () => {
    const context = useContext(ExpertiseContext);
    if (!context) return null;

    const {
        activeTab, setActiveTab, sidebarWidth, isResizing, uiZoom, pastedJson, setPastedJson,
        draggedOccIndex, setDraggedOccIndex, draggedExpIndex, setDraggedExpIndex,
        showSubtotals, setShowSubtotals, orgaAdvancedMode, setOrgaAdvancedMode,
        expandedOccId, setExpandedOccId, expandedExpId, setExpandedExpId,
        savedDossiers, dossierSearch, setDossierSearch, expertsList, setExpertsList, franchises, setFranchises,
        showExpertDropdown, setShowExpertDropdown, showExpertDropdownContradictoire, setShowExpertDropdownContradictoire,
        showFranchiseDropdown, setShowFranchiseDropdown, formData, setFormData, blockTitles, setBlockTitles,
        references, occupants, expenses, blocksVisible, setBlocksVisible, customBlocks, setCustomBlocks,
        blockOrder, setBlockOrder, blockWidths, setBlockWidths, styles, setStyles, startResizing, handleReset, handleChange, handleTitleChange,
        saveDossier, loadDossier, deleteDossier, generatePDF, addRef, updateRef, removeRef,
        addOcc, updateOcc, removeOcc, sortOccupantsByFloor, addExpense, updateExpense, removeExpense,
        reorganizeExpenses, handleJsonImport, handlePasteImport, copyPrompt, exportGlobalData
    } = context;

    const [addExpertForm, setAddExpertForm] = useState({ nom: '', tel: '' });
    const [editingExpert, setEditingExpert] = useState(null);
    const [addFranchiseForm, setAddFranchiseForm] = useState({ moisAnnee: '', montant: '' });

    const handleAddExpert = () => {
        const nom = addExpertForm.nom.trim(); const tel = addExpertForm.tel.trim();
        if (!nom && !tel) return alert("Champ vide.");
        let newList = editingExpert ? expertsList.filter(e => e.nom !== editingExpert.oldNom || e.tel !== editingExpert.oldTel) : [...expertsList];
        newList.push({ nom, tel }); setExpertsList(newList); setAddExpertForm({ nom: '', tel: '' }); setEditingExpert(null);
    };

    const handleAddFranchise = () => {
        if (!addFranchiseForm.moisAnnee || !addFranchiseForm.montant) return alert("Erreur.");
        setFranchises([`${addFranchiseForm.moisAnnee} - ${addFranchiseForm.montant}`, ...franchises]); setAddFranchiseForm({ moisAnnee: '', montant: '' });
    };

    const formatExpertDisplay = (exp) => (exp.nom && exp.tel) ? `${exp.nom} - ${exp.tel}` : (exp.nom || exp.tel || 'Inconnu');

    const sortedExperts = [...expertsList].sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
    const filteredExperts = sortedExperts.filter(exp => (exp.nom || '').toLowerCase().startsWith((formData.expertInfos||'').split(' - ')[0].toLowerCase()));
    const filteredExpertsContradictoire = sortedExperts.filter(exp => (exp.nom || '').toLowerCase().startsWith((formData.expertContradictoire||'').split(' - ')[0].toLowerCase()));
    const filteredFranchises = [...franchises].filter(f => (f || '').toLowerCase().includes((formData.franchise || '').toLowerCase()));

    const AccordionHeader = ({ id, num }) => (
        <summary className="p-2 flex items-center group-open:border-b border-slate-700 cursor-pointer select-none bg-slate-800/80 hover:bg-slate-700/80 rounded-t">
            <span className="text-xs font-bold text-indigo-400 shrink-0 mr-2">{num}.</span>
            <input type="text" value={blockTitles[id]} onChange={(e) => handleTitleChange(id, e.target.value)} onClick={(e) => e.stopPropagation()} className="bg-transparent border-none outline-none text-xs font-bold uppercase text-indigo-300 w-full hover:bg-slate-900/50 px-1 rounded transition-colors" />
        </summary>
    );

    return (
        <>
        <div id="sidebar" style={{ width: `${sidebarWidth}px` }} className="bg-slate-900 text-slate-200 flex flex-col shadow-xl z-10 shrink-0 h-screen overflow-hidden">
            <div className="p-4 border-b border-slate-700">
                <div className="flex justify-between items-center mb-3">
                    <h1 className="text-xl font-bold text-white leading-tight">Page de garde<br/><span className="text-sm font-normal text-indigo-400">Expertise Incendie</span></h1>
                    <button onClick={handleReset} className="bg-slate-800 text-red-400 hover:bg-slate-700 px-3 py-1.5 rounded text-xs font-bold border border-slate-700 transition-colors">🔄 Reset</button>
                </div>
                <div className="flex space-x-2 bg-slate-800 p-1 rounded-lg">
                    <button className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'builder' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} onClick={() => setActiveTab('builder')}>Éditeur</button>
                    <button className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'settings' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`} onClick={() => setActiveTab('settings')}>Paramètres & IA</button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4" style={{ zoom: uiZoom }}>
                {activeTab === 'settings' ? (
                    <div className="space-y-6">
                        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-4 rounded border border-blue-500 shadow-lg">
                            <h3 className="text-sm font-bold text-white mb-2">💾 Sauvegarde Globale</h3>
                            <button onClick={exportGlobalData} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded text-xs font-bold shadow mb-2">📥 Exporter Sauvegarde Totale (.json)</button>
                            <p className="text-[10px] text-indigo-200 leading-tight">Pour restaurer, utilisez simplement la zone "Importer Fichier" tout en bas avec votre fichier .json.</p>
                        </div>

                        <div className="bg-slate-800 p-4 rounded border border-slate-700">
                            <h3 className="text-sm font-bold text-white mb-2">📂 Gestion des dossiers</h3>
                            <button onClick={saveDossier} className="w-full bg-slate-600 hover:bg-slate-500 text-white py-1.5 rounded text-xs font-bold mb-3 shadow">💾 Sauvegarder le dossier actuel</button>
                            {savedDossiers.length > 0 && <input type="text" placeholder="🔍 Rechercher..." value={dossierSearch} onChange={(e) => setDossierSearch(e.target.value)} className="input-field mb-3 w-full" />}
                            <div className="border-t border-slate-700 pt-3 max-h-48 overflow-y-auto pr-1">
                                {savedDossiers.length === 0 ? <p className="text-[10px] text-slate-400 italic text-center">Aucun dossier.</p> : 
                                    <ul className="space-y-2">
                                        {savedDossiers.filter(d => (d.name || '').toLowerCase().includes(dossierSearch.toLowerCase())).map(d => (
                                            <li key={d.id} className="bg-slate-900 p-2 rounded border border-slate-600 flex flex-col gap-1">
                                                <div className="flex justify-between text-xs text-white"><span className="font-bold truncate">{d.name}</span><span className="text-[9px] text-slate-400">{d.date}</span></div>
                                                <div className="flex justify-end gap-2 mt-1"><button onClick={() => deleteDossier(d.id)} className="text-[10px] text-red-400 hover:underline">Supprimer</button><button onClick={() => loadDossier(d)} className="text-[10px] bg-blue-600 hover:bg-blue-500 px-3 py-1 rounded text-white font-bold">📂 Charger</button></div>
                                            </li>
                                        ))}
                                    </ul>
                                }
                            </div>
                        </div>

                        <div className="bg-slate-800 p-4 rounded border border-slate-700">
                            <h3 className="text-sm font-bold text-white mb-2">{editingExpert ? "✏️ Modifier l'Expert" : "➕ Base Experts"}</h3>
                            <div className="flex gap-2"><div className="flex-1"><label>Nom</label><input type="text" value={addExpertForm.nom} onChange={e=>setAddExpertForm({...addExpertForm, nom:e.target.value})} placeholder="GABER Lionel" className="input-field mb-0"/></div><div className="flex-1"><label>Tél</label><input type="text" value={addExpertForm.tel} onChange={e=>setAddExpertForm({...addExpertForm, tel:e.target.value})} placeholder="04XX XX XX" className="input-field mb-0"/></div></div>
                            <button onClick={handleAddExpert} className="w-full mt-2 bg-green-700 hover:bg-green-600 py-1.5 rounded text-xs font-bold">{editingExpert ? "Enregistrer" : "Ajouter"}</button>
                            <div className="mt-4 pt-4 border-t border-slate-700 max-h-48 overflow-y-auto pr-1">
                                <ul className="space-y-1 text-xs">
                                    {sortedExperts.map((exp, idx) => <li key={idx} className="flex justify-between items-center bg-slate-900 px-2 py-1.5 rounded border border-slate-700"><span>{formatExpertDisplay(exp)}</span><div><button onClick={()=>{setAddExpertForm({nom:exp.nom,tel:exp.tel});setEditingExpert({oldNom:exp.nom,oldTel:exp.tel})}}>✏️</button> <button onClick={()=>window.confirm('Supprimer ?')&&setExpertsList(expertsList.filter(e=>e!==exp))} className="text-red-400">🗑️</button></div></li>)}
                                </ul>
                            </div>
                        </div>

                        <div className="bg-slate-800 p-4 rounded border border-slate-700">
                            <h3 className="text-sm font-bold text-white mb-2">➕ Base Franchises</h3>
                            <div className="flex gap-2"><div className="flex-1"><label>Mois/Année</label><input type="text" value={addFranchiseForm.moisAnnee} onChange={e=>setAddFranchiseForm({...addFranchiseForm, moisAnnee:e.target.value})} placeholder="Mai 2026" className="input-field mb-0"/></div><div className="flex-1"><label>Montant</label><input type="text" value={addFranchiseForm.montant} onChange={e=>setAddFranchiseForm({...addFranchiseForm, montant:e.target.value})} placeholder="335,00 €" className="input-field mb-0"/></div></div>
                            <button onClick={handleAddFranchise} className="w-full mt-2 bg-slate-700 hover:bg-slate-600 py-1.5 rounded text-xs font-bold">Ajouter</button>
                            <div className="mt-4 pt-4 border-t border-slate-700 max-h-32 overflow-y-auto pr-1">
                                <ul className="space-y-1 text-xs text-slate-300">
                                    {franchises.map((f, idx) => <li key={idx} className="flex justify-between items-center bg-slate-900 px-2 py-1.5 rounded border border-slate-700"><span>{f}</span><button onClick={()=>window.confirm('Supprimer ?')&&setFranchises(franchises.filter(x=>x!==f))} className="hover:text-red-400 shrink-0">🗑️</button></li>)}
                                </ul>
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-slate-800 to-indigo-900 p-4 rounded border border-indigo-400 shadow-lg">
                            <h3 className="text-sm font-bold text-white mb-2 flex items-center">🤖 Assistant IA (Import rapide)</h3>
                            <p className="text-[10px] text-indigo-200 mb-3 leading-tight">Copiez le prompt et donnez-le à l'IA avec vos notes brutes.<br/>Ensuite, collez la réponse ci-dessous ou importez le fichier.</p>
                            
                            <button onClick={copyPrompt} className="w-full mb-3 bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 rounded text-xs font-bold shadow">📋 1. Copier Prompt</button>
                            
                            <textarea 
                                value={pastedJson} 
                                onChange={(e) => setPastedJson(e.target.value)} 
                                placeholder="Collez la réponse JSON de l'IA ici..." 
                                className="input-field h-24 resize-y mb-2 text-[10px] font-mono leading-tight"
                            />
                            
                            <div className="flex gap-2">
                                <button onClick={handlePasteImport} className="flex-1 bg-green-600 hover:bg-green-500 text-white py-1.5 rounded text-xs font-bold shadow">📥 2. Importer Texte</button>
                                <label className="flex-1 bg-slate-600 hover:bg-slate-500 text-white py-1.5 rounded text-xs font-bold shadow text-center cursor-pointer">📂 Importer Fichier<input type="file" accept=".json" onChange={handleJsonImport} className="hidden" /></label>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div>
                        <details className="bg-slate-800/50 rounded border border-slate-700 mb-2 group" open>
                            <summary className="p-3 text-xs font-bold uppercase text-indigo-400 cursor-pointer select-none group-open:border-b border-slate-700">1. Titre Document</summary>
                            <div className="p-3 space-y-2">
                                <div className="flex gap-2"><div className="flex-1"><label>Date de l'expertise</label><input type="date" name="dateExp" value={formData.dateExp} onChange={handleChange} className="input-field" /></div><div className="flex-1"><label>Heure</label><input type="time" name="heureExp" value={formData.heureExp} onChange={handleChange} className="input-field" /></div></div>
                                <div className="flex gap-2"><div className="flex-1"><label>Réf Péchard</label><input type="text" name="refPechard" value={formData.refPechard} onChange={handleChange} className="input-field" /></div><div className="flex-1"><label>Nom Résidence</label><input type="text" name="nomResidence" value={formData.nomResidence} onChange={handleChange} className="input-field" /></div></div>
                            </div>
                        </details>

                        <details className="bg-slate-800/50 rounded border border-slate-700 mb-2 group">
                            <AccordionHeader id="coord" num="2" />
                            <div className="p-3 space-y-2">
                                <label>Adresse du sinistre</label><input type="text" name="adresse" value={formData.adresse} onChange={handleChange} className="input-field" />
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <label>Franchise applicable</label>
                                        <input type="text" name="franchise" value={formData.franchise} onChange={(e) => { handleChange(e); setShowFranchiseDropdown(true); }} onFocus={() => setShowFranchiseDropdown(true)} onBlur={() => setTimeout(() => setShowFranchiseDropdown(false), 200)} className="input-field mb-0" placeholder="Ex: 335,00 €" />
                                        {showFranchiseDropdown && filteredFranchises.length > 0 && <ul className="absolute z-50 w-full bg-slate-700 border border-slate-500 rounded mt-[-2px] max-h-40 overflow-y-auto">{filteredFranchises.map((f, idx) => <li key={idx} className="px-2 py-1.5 text-xs text-white hover:bg-indigo-500 cursor-pointer" onMouseDown={() => { setFormData({ ...formData, franchise: f }); setShowFranchiseDropdown(false); }}>{f}</li>)}</ul>}
                                    </div>
                                    <div className="flex-1"><label>Pertes indirectes</label><select name="pertesIndirectes" value={formData.pertesIndirectes} onChange={handleChange} className="input-field mb-0"><option value="">Sélectionner...</option><option value="0%">0%</option><option value="5%">5%</option><option value="10%">10%</option></select></div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-700">
                                    <div><label>Bureau d'expertise</label><input type="text" name="bureau" value={formData.bureau} onChange={handleChange} placeholder="Ex: DION" className="input-field mb-0" list="bureau-suggestions" /><datalist id="bureau-suggestions"><option value="Expert interne" /><option value="DION Expertises" /><option value="DE ROO & PARTNERS" /></datalist></div>
                                    <div className="relative"><label>Expert en charge</label><input type="text" name="expertInfos" value={formData.expertInfos} onChange={(e) => { handleChange(e); setShowExpertDropdown(true); }} onFocus={() => setShowExpertDropdown(true)} onBlur={() => setTimeout(() => setShowExpertDropdown(false), 200)} placeholder="Taper le nom..." className="input-field mb-0" />
                                        {showExpertDropdown && filteredExperts.length > 0 && <ul className="absolute z-50 w-full bg-slate-700 border border-slate-500 rounded mt-[-2px] max-h-40 overflow-y-auto">{filteredExperts.map((exp, idx) => <li key={idx} className="px-2 py-1.5 text-xs text-white hover:bg-indigo-500 cursor-pointer" onMouseDown={() => { setFormData({ ...formData, expertInfos: formatExpertDisplay(exp) }); setShowExpertDropdown(false); }}>{formatExpertDisplay(exp)}</li>)}</ul>}
                                    </div>
                                </div>
                                <label className="flex items-center space-x-2 mt-4 cursor-pointer text-white font-bold bg-slate-700 p-2 rounded border border-slate-600"><input type="checkbox" name="isContradictoire" checked={formData.isContradictoire} onChange={handleChange} className="w-4 h-4" /><span>Expertise Contradictoire</span></label>
                                {formData.isContradictoire && (
                                    <div className="border-l-2 border-indigo-500 pl-3 ml-1 mt-2 space-y-2">
                                        <label>Compagnie (Tiers)</label><input type="text" name="cieContradictoire" value={formData.cieContradictoire} onChange={handleChange} className="input-field" />
                                        <div className="grid grid-cols-2 gap-2">
                                            <div><label>Bureau (Tiers)</label><input type="text" name="bureauContradictoire" value={formData.bureauContradictoire} onChange={handleChange} className="input-field mb-0" /></div>
                                            <div className="relative"><label>Expert en charge (Tiers)</label><input type="text" name="expertContradictoire" value={formData.expertContradictoire} onChange={(e) => { handleChange(e); setShowExpertDropdownContradictoire(true); }} onFocus={() => setShowExpertDropdownContradictoire(true)} onBlur={() => setTimeout(() => setShowExpertDropdownContradictoire(false), 200)} placeholder="Taper nom..." className="input-field mb-0" />
                                                {showExpertDropdownContradictoire && filteredExpertsContradictoire.length > 0 && <ul className="absolute z-50 w-full bg-slate-700 border border-slate-500 rounded mt-[-2px] max-h-40 overflow-y-auto">{filteredExpertsContradictoire.map((exp, idx) => <li key={idx} className="px-2 py-1.5 text-xs text-white hover:bg-indigo-500 cursor-pointer" onMouseDown={() => { setFormData({ ...formData, expertContradictoire: formatExpertDisplay(exp) }); setShowExpertDropdownContradictoire(false); }}>{formatExpertDisplay(exp)}</li>)}</ul>}
                                            </div>
                                        </div>
                                        <label>Pour le compte de</label><input type="text" name="compteDeContradictoire" value={formData.compteDeContradictoire} onChange={handleChange} className="input-field" />
                                    </div>
                                )}
                            </div>
                        </details>

                        <details className="bg-slate-800/50 rounded border border-slate-700 mb-2 group">
                            <AccordionHeader id="infos" num="3" />
                            <div className="p-3 space-y-2">
                                <div className="flex gap-2">
                                    <div className="flex-1"><label>Date du sinistre</label><input type="date" name="dateSinistre" value={formData.dateSinistre} onChange={handleChange} className="input-field mb-0" /></div>
                                    <div className="flex-1"><label>Date déclaration</label><input type="date" name="dateDeclaration" value={formData.dateDeclaration} onChange={handleChange} className="input-field mb-0" /></div>
                                </div>
                                <div className="mb-2">
                                    <label>Déclaré par (Nom)</label><input type="text" name="declarant" value={formData.declarant} onChange={handleChange} placeholder="Ex: Mme. X" className="input-field mb-0" />
                                </div>

                                <div className="flex gap-2 pt-2 border-t border-slate-600"><div className="flex-1"><label>Nom Compagnie</label><input type="text" name="nomCie" value={formData.nomCie} onChange={handleChange} className="input-field" /></div><div className="flex-1"><label>Nom Contrat</label><input type="text" name="nomContrat" value={formData.nomContrat} onChange={handleChange} className="input-field" /></div></div>
                                <div className="flex gap-2"><div className="flex-1"><label>N° Police</label><input type="text" name="numPolice" value={formData.numPolice} onChange={handleChange} className="input-field" /></div><div className="flex-1"><label>N° Sinistre Cie</label><input type="text" name="numSinistreCie" value={formData.numSinistreCie} onChange={handleChange} className="input-field" /></div></div>
                                <div className="mt-4 pt-2 border-t border-slate-600">
                                    <div className="flex justify-between items-center mb-2"><label className="text-white mb-0">Références tierces</label><button onClick={addRef} className="bg-slate-600 px-2 py-1 rounded text-[10px]">+ Ajouter</button></div>
                                    {references.map((r) => (
                                        <div key={r.id} className="flex gap-2 relative group mb-1">
                                            <input type="text" autoFocus value={r.nom} onChange={e=>updateRef(r.id, 'nom', e.target.value)} placeholder="Nom (Ex: Syndic)" className="input-field mb-0 w-1/2" /><input type="text" value={r.ref} onChange={e=>updateRef(r.id, 'ref', e.target.value)} placeholder="Référence" className="input-field mb-0 w-1/2" /><button onClick={()=>removeRef(r.id)} className="absolute -right-2 top-1 text-red-400 opacity-0 group-hover:opacity-100">✕</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </details>

                        <details className="bg-slate-800/50 rounded border border-slate-700 mb-2 group">
                            <AccordionHeader id="cause" num="4" />
                            <div className="p-3"><textarea name="cause" value={formData.cause} onChange={handleChange} rows="4" className="input-field resize-none m-0"></textarea></div>
                        </details>

                        <details className="bg-slate-800/50 rounded border border-slate-700 mb-2 group">
                            <AccordionHeader id="orga" num="5" />
                            <div className="p-3 space-y-2">
                                <div className="flex justify-between items-center mb-2">
                                    <button onClick={sortOccupantsByFloor} className="bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-[10px] text-indigo-300 border border-slate-600 transition-colors">🔄 Trier par étage</button>
                                    <label className="flex items-center space-x-2 cursor-pointer text-slate-300 text-[10px] bg-slate-800 p-1.5 rounded border border-slate-700"><input type="checkbox" checked={orgaAdvancedMode} onChange={(e) => setOrgaAdvancedMode(e.target.checked)} className="w-3 h-3 rounded bg-slate-700" /><span>Mode complet (Assurances)</span></label>
                                </div>
                                {occupants.map((o, index) => {
                                    const isExp = expandedOccId === o.id;
                                    return (
                                    <div key={o.id} draggable={!isExp} onDragStart={(e) => { if(isExp) { e.preventDefault(); return; } setDraggedOccIndex(index); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (draggedOccIndex === null || draggedOccIndex === index) return; const newOccs = [...occupants]; const item = newOccs.splice(draggedOccIndex, 1)[0]; newOccs.splice(index, 0, item); setOccupants(newOccs); setDraggedOccIndex(null); }} onDragEnd={() => setDraggedOccIndex(null)} className={`p-2 bg-slate-900 border ${isExp ? 'border-indigo-500' : 'border-slate-600'} rounded relative mb-1 ${!isExp ? 'cursor-move' : ''} ${draggedOccIndex === index ? 'opacity-50 border-indigo-400' : ''}`} >
                                        <button onClick={(e) => { e.stopPropagation(); removeOcc(o.id); }} className="absolute top-1 right-2 text-red-400 text-xs z-10">✕</button>
                                        {!isExp ? (
                                            <div className="text-xs text-slate-300 pr-6 flex items-center gap-2" onClick={() => setExpandedOccId(o.id)}><span className="text-slate-500 cursor-grab">⠿</span><span className="flex-1 truncate"><span className="font-bold text-white">{o.etage || 'Étage'}</span> - {o.statut} : {o.nom || 'Nouvelle personne'}</span></div>
                                        ) : (
                                            <div className="mt-1 grid grid-cols-2 gap-2">
                                                <div><label>Étage / Unité</label><input type="text" autoFocus value={o.etage} onChange={e=>updateOcc(o.id, 'etage', e.target.value)} className="input-field mb-0" /></div>
                                                <div><label>Statut</label><select value={o.statut} onChange={e=>updateOcc(o.id, 'statut', e.target.value)} className="input-field mb-0"><option>Locataire</option><option>Propriétaire occupant</option><option>Propriétaire non occupant</option><option>Syndic / Autre</option></select></div>
                                                <div className="col-span-2"><label>Nom & Prénom</label><input type="text" value={o.nom} onChange={e=>updateOcc(o.id, 'nom', e.target.value)} className="input-field mb-0" /></div>
                                                <div className="col-span-2"><label>Téléphone</label><input type="text" value={o.tel} onChange={e=>updateOcc(o.id, 'tel', e.target.value)} className="input-field mb-0" /></div>
                                                {orgaAdvancedMode && (
                                                    <div className="col-span-2 border-t border-slate-700 mt-2 pt-2">
                                                        <div className="mb-2 w-1/2 pr-1"><label>E-mail</label><input type="email" value={o.email} onChange={e=>updateOcc(o.id, 'email', e.target.value)} className="input-field mb-0" /></div>
                                                        <label className="text-indigo-300 font-bold mb-2">RC Familiale</label>
                                                        <div className="grid grid-cols-2 gap-2 mb-2"><div><label>Assuré ?</label><select value={o.rc} onChange={e=>updateOcc(o.id, 'rc', e.target.value)} className="input-field mb-0"><option>Non</option><option>Oui</option></select></div>{o.rc === 'Oui' && <div><label>N° Police RC</label><input type="text" value={o.rcPolice} onChange={e=>updateOcc(o.id, 'rcPolice', e.target.value)} className="input-field mb-0 border-indigo-500" /></div>}</div>
                                                        <label className="text-indigo-300 font-bold mb-2">Seconde Assurance</label>
                                                        <div className="grid grid-cols-2 gap-2"><div><label>Autre assurance ?</label><select value={o.secAssurance} onChange={e=>updateOcc(o.id, 'secAssurance', e.target.value)} className="input-field mb-0"><option>Non</option><option>Oui</option></select></div>{o.secAssurance === 'Oui' && <div><label>Type</label><input type="text" value={o.secType} onChange={e=>updateOcc(o.id, 'secType', e.target.value)} className="input-field mb-0 border-indigo-500" /></div>}{o.secAssurance === 'Oui' && <div><label>Compagnie (2e ass.)</label><input type="text" value={o.secCie} onChange={e=>updateOcc(o.id, 'secCie', e.target.value)} className="input-field mb-0 border-indigo-500" /></div>}{o.secAssurance === 'Oui' && <div><label>N° Police (2e ass.)</label><input type="text" value={o.secPolice} onChange={e=>updateOcc(o.id, 'secPolice', e.target.value)} className="input-field mb-0 border-indigo-500" /></div>}</div>
                                                    </div>
                                                )}
                                                <div className="col-span-2 flex justify-end mt-1"><button onClick={() => setExpandedOccId(null)} className="text-[10px] text-slate-400 hover:text-white underline">Réduire</button></div>
                                            </div>
                                        )}
                                    </div>
                                )})}
                                <button onClick={addOcc} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 py-1.5 rounded text-xs font-bold shadow">+ Ajouter une partie impliquée</button>
                            </div>
                        </details>

                        <details className="bg-slate-800/50 rounded border border-slate-700 mb-2 group">
                            <AccordionHeader id="frais" num="6" />
                            <div className="p-3 space-y-2">
                                <div className="flex items-center justify-between mb-3 bg-slate-800 p-2 rounded border border-slate-700">
                                    <label className="flex items-center space-x-2 cursor-pointer text-white text-xs font-bold"><input type="checkbox" checked={showSubtotals} onChange={(e) => setShowSubtotals(e.target.checked)} className="w-4 h-4 rounded border-slate-600 bg-slate-700" /><span>Sous-totaux</span></label>
                                    <button onClick={reorganizeExpenses} className="bg-slate-600 hover:bg-slate-500 px-3 py-1 rounded text-[10px] text-white">🔄 Réorganiser</button>
                                </div>
                                {expenses.map((exp, index) => {
                                    const isExp = expandedExpId === exp.id;
                                    return (
                                    <div key={exp.id} draggable={!isExp} onDragStart={(e) => { if(isExp) { e.preventDefault(); return; } setDraggedExpIndex(index); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (draggedExpIndex === null || draggedExpIndex === index) return; const newExps = [...expenses]; const item = newExps.splice(draggedExpIndex, 1)[0]; newExps.splice(index, 0, item); setExpenses(newExps); setDraggedExpIndex(null); }} onDragEnd={() => setDraggedExpIndex(null)} className={`p-2 bg-slate-900 border ${isExp ? 'border-indigo-500' : 'border-slate-600'} rounded relative mb-1 ${!isExp ? 'cursor-move' : ''} ${draggedExpIndex === index ? 'opacity-50 border-indigo-400' : ''}`} >
                                        <button onClick={(e) => { e.stopPropagation(); removeExpense(exp.id); }} className="absolute top-1 right-2 text-red-400 text-xs z-10">✕</button>
                                        {!isExp ? (
                                            <div className="text-xs text-slate-300 pr-6 flex items-center gap-2" onClick={() => setExpandedExpId(exp.id)}><span className="text-slate-500 cursor-grab">⠿</span><span className="flex-1 truncate"><span className="font-bold text-white">{exp.montant ? `${exp.montant} €` : '0,00 €'}</span> - {exp.prestataire || 'Nouveau frais'} {exp.compteDe ? `(${exp.compteDe})` : ''}</span></div>
                                        ) : (
                                            <div className="mt-1 grid grid-cols-2 gap-2">
                                                <div><label>Prestataire</label><input type="text" autoFocus value={exp.prestataire} onChange={e=>updateExpense(exp.id, 'prestataire', e.target.value)} className="input-field mb-0" /></div>
                                                <div><label>Type / Réf</label><div className="flex gap-1"><input type="text" value={exp.type} onChange={e=>updateExpense(exp.id, 'type', e.target.value)} placeholder="Devis" className="input-field mb-0 w-1/2" /><input type="text" value={exp.ref} onChange={e=>updateExpense(exp.id, 'ref', e.target.value)} placeholder="Réf" className="input-field mb-0 w-1/2" /></div></div>
                                                <div className="col-span-2"><label>Description courte</label><input type="text" value={exp.desc} onChange={e=>updateExpense(exp.id, 'desc', e.target.value)} className="input-field mb-0" /></div>
                                                <div className="col-span-2"><label>Pour le compte de</label><input type="text" value={exp.compteDe} onChange={e=>updateExpense(exp.id, 'compteDe', e.target.value)} placeholder="Choisissez..." className="input-field mb-0 border-indigo-500" list="occupants-global-list" /></div>
                                                <div><label>Montant (€)</label><input type="text" value={exp.montant} onChange={e=>updateExpense(exp.id, 'montant', e.target.value)} placeholder="350.00" className="input-field mb-0 font-bold" /></div>
                                                <div><label>Type Montant</label><select value={exp.typeMontant} onChange={e=>updateExpense(exp.id, 'typeMontant', e.target.value)} className="input-field mb-0"><option>HTVA</option><option>Forfait</option><option>TVAC</option></select></div>
                                                <div className="col-span-2 flex justify-end mt-1"><button onClick={() => setExpandedExpId(null)} className="text-[10px] text-slate-400 hover:text-white underline">Réduire</button></div>
                                            </div>
                                        )}
                                    </div>
                                )})}
                                <button onClick={addExpense} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 py-1.5 rounded text-xs font-bold shadow">+ Ajouter une ligne de frais</button>
                                <datalist id="occupants-global-list">{occupants.filter(o => o.nom).map(o => <option key={o.id} value={o.nom} />)}<option value="La copropriété" /></datalist>
                            </div>
                        </details>

                        <details className="bg-slate-800/50 rounded border border-slate-700 mb-2 group">
                            <AccordionHeader id="divers" num="7" />
                            <div className="p-3"><textarea name="divers" value={formData.divers} onChange={handleChange} rows="3" className="input-field resize-none m-0"></textarea></div>
                        </details>
                        
                        <div className="bg-slate-900 border border-slate-600 rounded p-3 mt-4">
                            <h3 className="text-xs font-bold text-white mb-2 uppercase">🧱 Gestion des blocs affichés</h3>
                            <div className="flex flex-wrap gap-2 mb-3 text-[10px]">
                                {['titre', 'coord', 'infos', 'cause', 'orga', 'frais', 'divers'].map(key => (
                                    <label key={key} className={`px-2 py-1 rounded cursor-pointer border ${blocksVisible[key] ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}><input type="checkbox" className="hidden" checked={!!blocksVisible[key]} onChange={() => setBlocksVisible(p => ({...p, [key]: !p[key]}))} />{key.toUpperCase()}</label>
                                ))}
                            </div>
                            <button onClick={() => { 
                                const newId = `custom_${Date.now()}`; 
                                setCustomBlocks([...customBlocks, { id: newId, text: 'Nouveau texte libre...' }]); 
                                setStyles(prev => ({ ...prev, [newId]: { border: true, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' }})); 
                                setBlocksVisible(prev => ({ ...prev, [newId]: true })); 
                                setBlockOrder(prev => [...prev, newId]);
                                setBlockWidths(prev => ({ ...prev, [newId]: '100%' })); 
                            }} className="w-full bg-slate-700 hover:bg-slate-600 border border-slate-500 py-1.5 rounded text-xs font-bold">+ Ajouter un bloc "Texte libre"</button>
                        </div>
                    </div>
                )}
            </div>
            <div className="p-4 border-t border-slate-700 bg-slate-900 flex flex-col gap-2">
                <button onClick={generatePDF} className="w-full bg-indigo-600 hover:bg-indigo-500 py-2 rounded font-bold text-white transition-colors">🖨️ Imprimer le rapport / PDF</button>
            </div>
        </div>
        <div className={`w-1.5 bg-slate-400 hover:bg-indigo-500 ${isResizing ? 'active' : ''}`} onMouseDown={startResizing} style={{cursor: 'col-resize'}}></div>
        </>
    );
};

export default Sidebar;
