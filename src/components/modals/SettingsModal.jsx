import React, { useState, useContext, useRef } from 'react';
import { useSidebarUI } from '../../context/SidebarUIContext';
import { ExpertiseContext } from '../../context/ExpertiseContext';
import { useDatasetStore } from '../../store/datasetStore.js';
import { sortFranchisesChronologically } from '../../domain/claims/franchises.js';
import packageInfo from '../../../package.json';

const SettingsModal = () => {
    const { isSettingsModalOpen, setIsSettingsModalOpen, openDossiersFromSettings } = useSidebarUI();
    const context = useContext(ExpertiseContext);
    const { records: datasetRecords, exportAsJSON: exportDatasetJSON, clearRecords: clearDatasetRecords } = useDatasetStore();

    const [addExpertForm, setAddExpertForm] = useState({ nom: '', tel: '' });
    const [editingExpert, setEditingExpert] = useState(null);
    const [addFranchiseForm, setAddFranchiseForm] = useState({ moisAnnee: '', montant: '' });
    const fileInputRef = useRef(null);

    if (!isSettingsModalOpen || !context) return null;

    const {
        expertsList, setExpertsList, franchises, setFranchises,
        isAiModeActive, aiConfig, toggleAiMode, isDebugMode, toggleDebugMode,
        telemetry: contextTelemetry, exportTelemetryJson
    } = context;

    const safeExperts = Array.isArray(expertsList) ? expertsList : [];
    const safeFranchises = Array.isArray(franchises) ? franchises : [];

    const sortedExperts = [...safeExperts].sort((a, b) => (a.nom || a.name || '').localeCompare(b.nom || b.name || ''));

    const handleAddExpert = () => {
        if (!addExpertForm.nom.trim()) return;
        if (editingExpert) {
            setExpertsList(safeExperts.map(e => (e.nom === editingExpert.oldNom && e.tel === editingExpert.oldTel) ? { nom: addExpertForm.nom, tel: addExpertForm.tel } : e));
            setEditingExpert(null);
        } else {
            setExpertsList([...safeExperts, { nom: addExpertForm.nom, tel: addExpertForm.tel }]);
        }
        setAddExpertForm({ nom: '', tel: '' });
    };

    // --- Export JSON de la Base Experts ---
    const handleExportExpertsJson = () => {
        if (safeExperts.length === 0) {
            alert("La base experts est vide : rien à exporter.");
            return;
        }
        try {
            const json = JSON.stringify(safeExperts, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const dateStr = new Date().toISOString().slice(0, 10);
            const a = document.createElement('a');
            a.href = url;
            a.download = `base_experts_${dateStr}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('[SettingsModal] Erreur export experts JSON:', err);
            alert("Erreur lors de l'export du fichier JSON.");
        }
    };

    // --- Import JSON de la Base Experts (fusion sans doublons) ---
    const handleImportExpertsJson = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);

                if (!Array.isArray(parsed)) {
                    alert("Format invalide : le fichier doit contenir un tableau JSON d'experts.\nExemple : [{ \"nom\": \"GABER Lionel\", \"tel\": \"04XX XX XX\" }]");
                    return;
                }

                // Normalisation + validation des entrées
                const validEntries = parsed
                    .filter(item => item && typeof item === 'object' && !Array.isArray(item))
                    .map(item => ({
                        nom: String(item.nom || item.name || '').trim(),
                        tel: String(item.tel || item.phone || '').trim()
                    }))
                    .filter(item => item.nom.length > 0);

                const invalidCount = parsed.length - validEntries.length;

                if (validEntries.length === 0) {
                    alert("Aucun expert valide trouvé dans le fichier.\nChaque entrée doit contenir au minimum un champ \"nom\".");
                    return;
                }

                // Dédoublonnage : contre la base existante ET au sein du fichier importé
                const normalize = (nom) => nom.trim().toLowerCase();
                const existingNames = new Set(
                    safeExperts.map(exp => normalize(exp.nom || exp.name || ''))
                );

                const newExperts = [];
                for (const entry of validEntries) {
                    const key = normalize(entry.nom);
                    if (!existingNames.has(key)) {
                        existingNames.add(key);
                        newExperts.push(entry);
                    }
                }

                if (newExperts.length === 0) {
                    alert(`Import terminé : aucun nouvel expert (${validEntries.length} doublon(s) ignoré(s)).`);
                    return;
                }

                setExpertsList([...safeExperts, ...newExperts]);

                const duplicates = validEntries.length - newExperts.length;
                let message = `✅ Import réussi : ${newExperts.length} expert(s) ajouté(s).`;
                if (duplicates > 0) message += `\n${duplicates} doublon(s) ignoré(s).`;
                if (invalidCount > 0) message += `\n${invalidCount} entrée(s) invalide(s) ignorée(s).`;
                alert(message);
            } catch (err) {
                console.error('[SettingsModal] Erreur import experts JSON:', err);
                alert("Fichier illisible : le contenu n'est pas un JSON valide.");
            }
        };
        reader.onerror = () => {
            alert("Erreur lors de la lecture du fichier.");
        };
        reader.readAsText(file);

        // Reset : permet de réimporter le même fichier consécutivement
        event.target.value = '';
    };

    const handleAddFranchise = () => {
        if (!addFranchiseForm.moisAnnee.trim() || !addFranchiseForm.montant.trim()) return;
        const entry = `${addFranchiseForm.moisAnnee.trim()} - ${addFranchiseForm.montant.trim()}`;
        setFranchises([...safeFranchises, entry]);
        setAddFranchiseForm({ moisAnnee: '', montant: '' });
    };

    const formatFranchiseDisplay = (f) => {
        if (!f) return '';
        if (typeof f === 'string') return f;
        if (typeof f === 'object') return `${f.moisAnnee || ''}${f.montant ? ` - ${f.montant}` : ''}`.trim();
        return String(f);
    };

    return (
        <div 
            className="fixed inset-0 z-[10000] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 print:hidden"
            onClick={() => setIsSettingsModalOpen(false)}
        >
            <div 
                className="bg-slate-900 text-slate-100 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-slate-700 shadow-2xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">⚙️</span>
                        <h2 className="text-base font-extrabold text-white tracking-wide">Paramètres &amp; Réglages Système</h2>
                    </div>
                    <button 
                        onClick={() => setIsSettingsModalOpen(false)}
                        className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors font-bold text-sm"
                        aria-label="Fermer"
                    >
                        ✕
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
                    {/* Shortcut to Dossiers Modal */}
                    <div className="bg-gradient-to-r from-indigo-900/50 to-slate-800 p-4 rounded-xl border border-indigo-500/40 flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-white text-xs">📂 Gestion des dossiers</h3>
                            <p className="text-[10px] text-slate-400">Accéder directement au gestionnaire et au chargement des dossiers sauvegardés.</p>
                        </div>
                        <button 
                            onClick={openDossiersFromSettings}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg transition-colors shadow"
                        >
                            Ouvrir les Dossiers ➔
                        </button>
                    </div>

                    {/* 1. BASE EXPERTS */}
                    <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xs font-bold text-white">➕ Base Experts</h3>
                            <div className="flex gap-1.5">
                                <button
                                    onClick={handleExportExpertsJson}
                                    title="Télécharger la liste des experts au format JSON"
                                    className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold px-2 py-1 rounded text-[10px] transition-colors border border-slate-600 flex items-center gap-1"
                                >
                                    📤 Exporter JSON
                                </button>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Importer une liste d'experts depuis un fichier JSON (fusion sans doublons)"
                                    className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold px-2 py-1 rounded text-[10px] transition-colors border border-slate-600 flex items-center gap-1"
                                >
                                    📥 Importer JSON
                                </button>
                                <input
                                    type="file"
                                    accept=".json,application/json"
                                    ref={fileInputRef}
                                    onChange={handleImportExpertsJson}
                                    className="hidden"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-[10px] text-slate-400 block mb-1">Nom</label>
                                <input type="text" value={addExpertForm.nom} onChange={e=>setAddExpertForm({...addExpertForm, nom:e.target.value})} placeholder="GABER Lionel" className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white"/>
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] text-slate-400 block mb-1">Tél</label>
                                <input type="text" value={addExpertForm.tel} onChange={e=>setAddExpertForm({...addExpertForm, tel:e.target.value})} placeholder="04XX XX XX" className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white"/>
                            </div>
                        </div>
                        <button onClick={handleAddExpert} className="w-full mt-2 bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-1.5 rounded text-xs transition-colors">
                            {editingExpert ? "Enregistrer les modifications" : "Ajouter un expert"}
                        </button>
                        {sortedExperts.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-700/60 max-h-36 overflow-y-auto pr-1">
                                <ul className="space-y-1 text-xs">
                                    {sortedExperts.map((exp, idx) => (
                                        <li key={idx} className="flex justify-between items-center bg-slate-900/90 px-2.5 py-1.5 rounded border border-slate-700">
                                            <span className="text-slate-100 font-medium">
                                                {exp.nom || exp.name || 'Expert'}{exp.tel ? ` (${exp.tel})` : ''}
                                            </span>
                                            <div className="flex gap-2">
                                                <button onClick={()=>{setAddExpertForm({nom:exp.nom || '',tel:exp.tel || ''});setEditingExpert({oldNom:exp.nom,oldTel:exp.tel})}}>✏️</button>
                                                <button onClick={()=>window.confirm('Supprimer cet expert ?')&&setExpertsList(safeExperts.filter(e=>e!==exp))} className="text-red-400">🗑️</button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* 2. BASE FRANCHISES */}
                    <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700">
                        <h3 className="text-xs font-bold text-white mb-2">➕ Base Franchises</h3>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-[10px] text-slate-400 block mb-1">Mois/Année</label>
                                <input type="text" value={addFranchiseForm.moisAnnee} onChange={e=>setAddFranchiseForm({...addFranchiseForm, moisAnnee:e.target.value})} placeholder="Mai 2026" className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white"/>
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] text-slate-400 block mb-1">Montant</label>
                                <input type="text" value={addFranchiseForm.montant} onChange={e=>setAddFranchiseForm({...addFranchiseForm, montant:e.target.value})} placeholder="335,00 €" className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white"/>
                            </div>
                        </div>
                        <button onClick={handleAddFranchise} className="w-full mt-2 bg-slate-700 hover:bg-slate-600 text-white font-bold py-1.5 rounded text-xs transition-colors">Ajouter une franchise</button>
                        {safeFranchises.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-slate-700/60 max-h-32 overflow-y-auto pr-1">
                                <ul className="space-y-1 text-xs">
                                    {sortFranchisesChronologically(safeFranchises).map((f, idx) => (
                                        <li key={idx} className="flex justify-between items-center bg-slate-900/90 px-2.5 py-1.5 rounded border border-slate-700">
                                            <span className="text-slate-100 font-medium">{formatFranchiseDisplay(f)}</span>
                                            <button onClick={()=>setFranchises(safeFranchises.filter((item)=>item!==f))} className="text-red-400">🗑️</button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* 3. TÉLÉMÉTRIE */}
                    <div className="bg-gradient-to-r from-emerald-900/40 to-teal-900/40 p-4 rounded-xl border border-emerald-500/40">
                        <h3 className="text-xs font-bold text-white mb-2">📊 Télémétrie &amp; Usage</h3>
                        <button onClick={() => exportTelemetryJson()} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-xs font-bold shadow transition-colors">📉 Télécharger les Données (.json)</button>
                    </div>

                    {/* 4. GOLDEN DATASET */}
                    <div className="bg-gradient-to-r from-purple-900/40 to-fuchsia-900/40 p-4 rounded-xl border border-purple-500/40">
                        <h3 className="text-xs font-bold text-white mb-2">📊 Golden Dataset (Erreurs IA)</h3>
                        <p className="text-[10px] text-purple-200 leading-tight mb-3">Enregistrements capturés dans le sas de validation. ({datasetRecords.length} enregistrements)</p>
                        <div className="flex gap-2">
                            <button 
                                onClick={exportDatasetJSON}
                                disabled={datasetRecords.length === 0}
                                className="flex-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white py-2 rounded-lg text-xs font-bold shadow transition-colors"
                            >
                                📥 Télécharger (.json)
                            </button>
                            <button 
                                onClick={() => {
                                    if (window.confirm('Voulez-vous vraiment vider le dataset ? N\'oubliez pas de le télécharger d\'abord !')) {
                                        clearDatasetRecords();
                                    }
                                }}
                                disabled={datasetRecords.length === 0}
                                className="px-3 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white py-2 rounded-lg text-xs font-bold shadow transition-colors"
                            >
                                🗑️ Vider
                            </button>
                        </div>
                    </div>

                    {/* 5. COMMUTATEUR IA & CONSOLE DEBUG */}
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-xs">🤖</span>
                                <div>
                                    <div className="text-xs font-bold text-slate-200">Moteur d'IA Global</div>
                                    <div className="text-[9px] text-slate-500">Activer ou désactiver l'exécution des fonctions IA</div>
                                </div>
                            </div>
                            <button
                                onClick={() => { if(contextTelemetry) contextTelemetry.logEvent('CLICK', 'btn_toggle_ai'); toggleAiMode(); }}
                                className={`text-[10px] font-bold px-3 py-1 rounded-lg border transition-colors ${
                                    isAiModeActive 
                                        ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/50 hover:bg-indigo-600/50' 
                                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                                }`}
                            >
                                {isAiModeActive ? '● IA Active' : '○ IA Désactivée'}
                            </button>
                        </div>

                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-xs">🦂</span>
                                <div>
                                    <div className="text-xs font-bold text-slate-200">Console Développeur</div>
                                    <div className="text-[9px] text-slate-500">Mode d'inspection et journaux techniques</div>
                                </div>
                            </div>
                            <button
                                onClick={() => { if(contextTelemetry) contextTelemetry.logEvent('CLICK', 'btn_debug_mode'); toggleDebugMode(); }}
                                className={`text-[10px] font-bold px-3 py-1 rounded-lg border transition-colors ${
                                    isDebugMode 
                                        ? 'bg-red-900/40 text-red-300 border-red-500/50 hover:bg-red-900/60' 
                                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                                }`}
                            >
                                {isDebugMode ? '● Debug Actif' : '○ Debug Masqué'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/80 flex justify-between items-center text-[10px] text-slate-500">
                    <span>ExpertisesCodeJules</span>
                    <span className="font-mono">v{packageInfo.version}</span>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
