import React, { createContext, useState, useEffect, useCallback } from 'react';

export const ExpertiseContext = createContext();

const initialFormData = {
  dateExp: '', heureExp: '', refPechard: '', nomResidence: '',
  adresse: '', franchise: '', pertesIndirectes: '', expertInfos: '', bureau: '',
  dateSinistre: '', dateDeclaration: '', declarant: '', 
  isContradictoire: false, cieContradictoire: '', bureauContradictoire: '', expertContradictoire: '', compteDeContradictoire: '',
  nomCie: '', nomContrat: '', numPolice: '', numSinistreCie: '',
  cause: "", divers: ""
};

const initialTitles = {
  coord: "Données d'expertise",
  infos: "Informations générales & références diverses",
  cause: "Cause du sinistre",
  orga: "Organisation du bâtiment",
  frais: "Tableau récapitulatif des frais et devis",
  divers: "Divers & Remarques"
};

const initialVisibility = { titre: true, coord: true, infos: true, cause: true, orga: true, frais: true, divers: true };
const initialBlockOrder = ['titre', 'coord', 'infos', 'cause', 'orga', 'frais', 'divers'];
const initialBlockWidths = { titre: '100%', coord: '100%', infos: '100%', cause: '100%', orga: '100%', frais: '100%', divers: '100%' };
const initialStyles = {
  titre: { border: true, fontSize: 16, color: '#0f172a', fontFamily: 'Arial', textAlign: 'center' },
  coord: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' },
  infos: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' },
  cause: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' },
  orga: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' },
  frais: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' },
  divers: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' }
};

const BUILTIN_EXPERTS = [
  { "nom": "HENRY", "tel": "0496/93.36.89" }, { "nom": "LANGE", "tel": "0475/82.83.88" }, { "nom": "MARICHAL", "tel": "0475/73.60.02" }, 
  { "nom": "LEONI", "tel": "0484/22.25.81" }, { "nom": "SAIL Marc", "tel": "0485/84.76.55" }, { "nom": "HOUBAR Paul", "tel": "0475/69.29.42" }, 
  { "nom": "HAAS", "tel": "0495/66.26.70" }, { "nom": "THIRY", "tel": "0485/78.93.84" }, { "nom": "THIRIONET Christophe", "tel": "0496/045075" }, 
  { "nom": "JARDON Stéphane", "tel": "0484/16.52.61" }, { "nom": "VITELLO Bruno", "tel": "0478/43.10.66" }, { "nom": "HAUSEUX Stéphane", "tel": "0494/66.04.68" }, 
  { "nom": "BREVERS Christian", "tel": "0477/39.59.51" }, { "nom": "DEBERG Pierre-Yves", "tel": "0497/36.19.63" }, { "nom": "CORNEROTTE Nicolas", "tel": "0476/63.87.90" }, 
  { "nom": "MARCON Rudi", "tel": "0475/905.990" }, { "nom": "BALTACI Alper", "tel": "0475/820.017" }, { "nom": "HEUSCHLING Denis", "tel": "0497/42.26.74" }, 
  { "nom": "LACROIX Christophe", "tel": "0476/78.90.20" }, { "nom": "RONSSE Vincent", "tel": "0498/38.74.88" }, { "nom": "BERTRAND David", "tel": "+32478977699" }, 
  { "nom": "SOMERS Gaetan", "tel": "+32479471039" }, { "nom": "GILLET Xavier", "tel": "0492/47.19.77" }, { "nom": "LOURTIE Frédéric", "tel": "0498/63.12.30" }, 
  { "nom": "TROKAY", "tel": "0486056438" }, { "nom": "DEDOBBELEER", "tel": "0479/706401" }, { "nom": "VAN BOCKSTAELE", "tel": "0495/52.91.15" }, 
  { "nom": "LIENARD Alexandre", "tel": "0473/96.31.18" }, { "nom": "GILLEBERT Francis", "tel": "0483/584616" }, { "nom": "MAES Geert", "tel": "0477/232343" }, 
  { "nom": "DE JAMBLINNE Maximilien", "tel": "0472/611475" }, { "nom": "FRANCOIS-NAVEZ Hugues", "tel": "0477/72.87.14" }, { "nom": "BECKER", "tel": "0479/29.16.01" }, 
  { "nom": "SIMAR Renaud", "tel": "0479/87.02.90" }, { "nom": "MAIRLOT Caroline", "tel": "" }, { "nom": "BRAHAM Catherine", "tel": "" }, 
  { "nom": "DIDESSE Olivier", "tel": "0473/87.71.27" }, { "nom": "BERNARD Pierre-Alain", "tel": "0496/27.18.98" }, { "nom": "FLEURY", "tel": "0478/349.693" }, 
  { "nom": "HANSON", "tel": "0475765032" }, { "nom": "ESCH Yves", "tel": "0477/94.21.48" }, { "nom": "NEMETH", "tel": "0476 28 90 04" }, 
  { "nom": "MARTIN Loris", "tel": "0495 25 16 87" }, { "nom": "TORMO José", "tel": "0476/45.78.00" }, { "nom": "COMBLEN Jean-Philippe", "tel": "0494/11.88.57" }, 
  { "nom": "DUHOUX Hugues", "tel": "0476/59.08.17" }, { "nom": "BOSSAERT Patrick", "tel": "0475/83.19.09" }, { "nom": "SOMERS Gaétan", "tel": "0479/47.10.39" }, 
  { "nom": "DODEMONT Damien", "tel": "0497/46.29.21" }, { "nom": "LEONARD Jean", "tel": "" }, { "nom": "DE SAINT HUBERT Michel", "tel": "0473/46.14.62" }, 
  { "nom": "BEX Nicolas", "tel": "0473/33.15.16" }, { "nom": "LIBERT Serge", "tel": "0486/513144" }, { "nom": "DE BOIS Thierry", "tel": "0477/13.13.11" }, 
  { "nom": "NOLDEN", "tel": "0496/37.85.29" }, { "nom": "CHAIDRON William", "tel": "0499/94.85.88" }, { "nom": "CORMAN Jean", "tel": "0475/324034" }, 
  { "nom": "DE MARCHIN", "tel": "0479/98.49.86" }, { "nom": "NELIS Julien", "tel": "0472781500" }, { "nom": "DORTU Stéphane", "tel": "0496131064" }, 
  { "nom": "DION Laurent", "tel": "0476618468" }, { "nom": "GABER", "tel": "0494 53 50 48" }
];

const BUILTIN_FRANCHISES = [
  "Avril 2026 - 333,39 €", "Mars 2026 - 333,01 €", "Février 2026 - 331,21 €", "Janvier 2026 - 329,77 €", "Décembre 2025 - 329,55 €", 
  "Novembre 2025 - 327,71 €", "Octobre 2025 - 326,52 €", "Septembre 2025 - 327,49 €", "Août 2025 - 327,52 €", "Juillet 2025 - 325,93 €", 
  "Juin 2025 - 324,79 €", "Mai 2025 - 325,30 €", "Avril 2025 - 328,01 €", "Mars 2025 - 328,26 €", "Février 2025 - 327,60 €", 
  "Janvier 2025 - 323,13 €", "Décembre 2024 - 321,84 €", "Novembre 2024 - 321,30 €", "Octobre 2024 - 319,76 €", "Septembre 2024 - 321,36 €", 
  "Août 2024 - 321,36 €", "Juillet 2024 - 319,09 €", "Juin 2024 - 318,38 €", "Mai 2024 - 317,22 €", "Avril 2024 - 318,75 €", 
  "Mars 2024 - 317,00 €", "Février 2024 - 314,75 €", "Janvier 2024 - 313,22 €", "Décembre 2023 - 311,88 €", "Novembre 2023 - 311,34 €", 
  "Octobre 2023 - 310,27 €", "Septembre 2023 - 312,43 €", "Août 2023 - 310,05 €", "Juillet 2023 - 307,57 €", "Juin 2023 - 308,02 €", 
  "Mai 2023 - 306,86 €", "Avril 2023 - 308,92 €", "Mars 2023 - 307,17 €", "Février 2023 - 309,33 €", "Janvier 2023 - 309,04 €", 
  "Décembre 2022 - 309,53 €", "Novembre 2022 - 310,23 €", "Octobre 2022 - 303,04 €", "Septembre 2022 - 300,16 €", "Août 2022 - 297,75 €", 
  "Juillet 2022 - 295,30 €", "Juin 2022 - 292,80 €", "Mai 2022 - 290,58 €", "Avril 2022 - 289,61 €", "Mars 2022 - 288,11 €", 
  "Février 2022 - 286,30 €", "Janvier 2022 - 280,05 €"
];

const normalizeExpertKey = (value = "") =>
value
  .toString()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLowerCase();

export const ExpertiseProvider = ({ children }) => {
  const [activeTab, setActiveTab] = useState('builder');
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Interface
  const [sidebarWidth, setSidebarWidth] = useState(450);
  const [isResizing, setIsResizing] = useState(false);
  const [uiZoom, setUiZoom] = useState(1);
  const [fitBlocks, setFitBlocks] = useState({});
  const [pastedJson, setPastedJson] = useState("");

  // Drag and Drop manuel (Listes Sidebar)
  const [draggedOccIndex, setDraggedOccIndex] = useState(null);
  const [draggedExpIndex, setDraggedExpIndex] = useState(null);

  // Paramètres additionnels
  const [showSubtotals, setShowSubtotals] = useState(false);
  const [orgaAdvancedMode, setOrgaAdvancedMode] = useState(false);
  const [expandedOccId, setExpandedOccId] = useState(null);
  const [expandedExpId, setExpandedExpId] = useState(null);

  // Données globales
  const [savedDossiers, setSavedDossiers] = useState([]);
  const [dossierSearch, setDossierSearch] = useState('');
  const [expertsList, setExpertsList] = useState([]);
  const [franchises, setFranchises] = useState([]);
  const [showExpertDropdown, setShowExpertDropdown] = useState(false);
  const [showExpertDropdownContradictoire, setShowExpertDropdownContradictoire] = useState(false);
  const [showFranchiseDropdown, setShowFranchiseDropdown] = useState(false); 

  // Formulaire
  const [formData, setFormData] = useState(initialFormData);
  const [blockTitles, setBlockTitles] = useState(initialTitles);
  const [references, setReferences] = useState([]);
  const [occupants, setOccupants] = useState([]);
  const [expenses, setExpenses] = useState([]);

  // Blocs et Styles
  const [blocksVisible, setBlocksVisible] = useState(initialVisibility);
  const [customBlocks, setCustomBlocks] = useState([]);
  const [blockOrder, setBlockOrder] = useState(initialBlockOrder);
  const [blockWidths, setBlockWidths] = useState(initialBlockWidths);
  const [styles, setStyles] = useState(initialStyles);

  const startResizing = useCallback(() => setIsResizing(true), []);
  const stopResizing = useCallback(() => setIsResizing(false), []);
  const resize = useCallback((e) => {
      if (isResizing && e.clientX > 300 && e.clientX < window.innerWidth * 0.6) setSidebarWidth(e.clientX);
  }, [isResizing]);

  useEffect(() => {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
      return () => { window.removeEventListener("mousemove", resize); window.removeEventListener("mouseup", stopResizing); };
  }, [resize, stopResizing]);

  useEffect(() => {
      const savedExperts = localStorage.getItem('expertise_experts_v2');
      const savedFranchises = localStorage.getItem('expertise_franchises_v2');
      const storedDossiers = localStorage.getItem('expertise_dossiers_v1');

      const parsedExperts = savedExperts ? JSON.parse(savedExperts) : [];
      const parsedFranchises = savedFranchises ? JSON.parse(savedFranchises) : [];

      const mergedExpertsMap = new Map();

      [...parsedExperts, ...BUILTIN_EXPERTS].forEach((exp) => {
          const key = normalizeExpertKey(exp.nom) || normalizeExpertKey(exp.tel);
          if (!key) return;
          mergedExpertsMap.set(key, {
              nom: exp.nom || '',
              tel: exp.tel || ''
          });
      });

      setExpertsList(Array.from(mergedExpertsMap.values()));

      setFranchises(
          Array.from(
              new Set([
                  ...(Array.isArray(parsedFranchises) ? parsedFranchises : []),
                  ...BUILTIN_FRANCHISES
              ])
          )
      );

      if (storedDossiers) setSavedDossiers(JSON.parse(storedDossiers));
  }, []);

  useEffect(() => {
      localStorage.setItem('expertise_experts_v2', JSON.stringify(expertsList));
      localStorage.setItem('expertise_franchises_v2', JSON.stringify(franchises));
  }, [expertsList, franchises]);

  const handleReset = () => {
      if(!window.confirm("⚠️ Voulez-vous réinitialiser tout le document ? Les données non sauvegardées seront perdues.")) return;
      setFormData(initialFormData); setBlockTitles(initialTitles); setReferences([]); setOccupants([]); setExpenses([]); 
      setBlocksVisible(initialVisibility); setCustomBlocks([]); setBlockOrder(initialBlockOrder); setBlockWidths(initialBlockWidths); 
      setStyles(initialStyles); setShowSubtotals(false); setOrgaAdvancedMode(false); setFitBlocks({}); setPastedJson('');
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const handleTitleChange = (id, val) => setBlockTitles({ ...blockTitles, [id]: val });
  const handleStyleChange = (id, prop, val) => setStyles(prev => ({ ...prev, [id]: { ...prev[id], [prop]: val } }));

  const moveBlockUp = (id) => {
      setBlockOrder(prev => {
          const idx = prev.indexOf(id);
          if (idx <= 0) return prev;
          const newOrder = [...prev];
          [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
          return newOrder;
      });
  };

  const moveBlockDown = (id) => {
      setBlockOrder(prev => {
          const idx = prev.indexOf(id);
          if (idx === -1 || idx === prev.length - 1) return prev;
          const newOrder = [...prev];
          [newOrder[idx + 1], newOrder[idx]] = [newOrder[idx], newOrder[idx + 1]];
          return newOrder;
      });
  };

  const toggleBlockWidth = (id) => {
      setBlockWidths(prev => ({
          ...prev,
          [id]: prev[id] === '50%' ? '100%' : '50%'
      }));
  };

  const saveDossier = () => {
      const name = window.prompt("Nom de ce dossier (ex: Nom, Ref) ?", formData.refPechard || formData.nomResidence || `Expertise_${new Date().toLocaleDateString()}`);
      if (!name) return;
      const newDossier = {
          id: Date.now(), name, date: new Date().toLocaleString('fr-FR'),
          data: { formData, blockTitles, references, occupants, expenses, blocksVisible, styles, blockOrder, blockWidths, customBlocks, showSubtotals, orgaAdvancedMode, fitBlocks }
      };
      const updated = [newDossier, ...savedDossiers];
      setSavedDossiers(updated); localStorage.setItem('expertise_dossiers_v1', JSON.stringify(updated));
      alert("✅ Dossier sauvegardé !");
  };

  const loadDossier = (dossier) => {
      if(!window.confirm(`⚠️ Charger "${dossier.name}" écrasera vos données actuelles. Continuer ?`)) return;
      const d = dossier.data;
      if(d.formData) setFormData(d.formData); if(d.blockTitles) setBlockTitles(d.blockTitles);
      if(d.references) setReferences(d.references); if(d.occupants) setOccupants(d.occupants); 
      if(d.expenses) setExpenses(d.expenses); if(d.blocksVisible) setBlocksVisible(d.blocksVisible); 
      if(d.styles) setStyles(d.styles); if(d.blockOrder) setBlockOrder(d.blockOrder); 
      if(d.blockWidths) setBlockWidths(d.blockWidths); if(d.customBlocks) setCustomBlocks(d.customBlocks); 
      if(d.showSubtotals !== undefined) setShowSubtotals(d.showSubtotals); if(d.orgaAdvancedMode !== undefined) setOrgaAdvancedMode(d.orgaAdvancedMode);
      if(d.fitBlocks) setFitBlocks(d.fitBlocks);
      setActiveTab('builder');
  };

  const deleteDossier = (id) => {
      if(!window.confirm("Voulez-vous vraiment supprimer ce dossier définitivement ?")) return;
      const updated = savedDossiers.filter(d => d.id !== id);
      setSavedDossiers(updated);
      localStorage.setItem('expertise_dossiers_v1', JSON.stringify(updated));
  };

  const generatePDF = () => {
      window.print();
  };

  const getSortedBlocks = () => {
      const currentCustomIds = customBlocks.map(c => c.id);
      const allIds = [...blockOrder];
      currentCustomIds.forEach(id => {
          if (!allIds.includes(id)) allIds.push(id);
      });
      return allIds.filter(id => blocksVisible[id] || currentCustomIds.includes(id));
  };

  const addRef = () => setReferences([...references, { id: Date.now(), nom: '', ref: '' }]);
  const updateRef = (id, field, value) => setReferences(references.map(r => r.id === id ? { ...r, [field]: value } : r));
  const removeRef = (id) => setReferences(references.filter(r => r.id !== id));

  const addOcc = () => {
      const newId = Date.now();
      setOccupants([...occupants, { id: newId, nom: '', etage: '', statut: 'Locataire', tel: '', email: '', rc: 'Non', rcPolice: '', secAssurance: 'Non', secType: '', secPolice: '', secCie: '' }]);
      setExpandedOccId(newId);
  };
  const updateOcc = (id, field, value) => {
      setOccupants(prev => {
          const oldOcc = prev.find(o => o.id === id);
          const next = prev.map(o => o.id === id ? { ...o, [field]: value } : o);
          if (field === 'nom' && oldOcc && oldOcc.nom !== value) {
              setExpenses(e => e.map(exp => exp.compteDe === oldOcc.nom ? { ...exp, compteDe: value } : exp));
          }
          return next;
      });
  };
  const removeOcc = (id) => setOccupants(occupants.filter(o => o.id !== id));

  const sortOccupantsByFloor = () => {
      const statusOrder = { "Propriétaire occupant": 1, "Propriétaire non occupant": 2, "Syndic / Autre": 3, "Locataire": 4 };
      const sorted = [...occupants].sort((a, b) => {
          const etageA = (a.etage || '').trim();
          const etageB = (b.etage || '').trim();
          if (etageA !== etageB) return etageA.localeCompare(etageB, undefined, { numeric: true, sensitivity: 'base' });
          const rankA = statusOrder[a.statut] || 99;
          const rankB = statusOrder[b.statut] || 99;
          return rankA - rankB;
      });
      setOccupants(sorted);
  };

  const addExpense = () => {
      const newId = Date.now();
      setExpenses([...expenses, { id: newId, prestataire: '', type: '', ref: '', desc: '', compteDe: '', montant: '', typeMontant: 'HTVA' }]);
      setExpandedExpId(newId);
  };
  const updateExpense = (id, field, value) => setExpenses(expenses.map(exp => exp.id === id ? { ...exp, [field]: value } : exp));
  const removeExpense = (id) => setExpenses(expenses.filter(exp => exp.id !== id));

  const reorganizeExpenses = () => {
      const occOrder = {};
      occupants.forEach((o, index) => { if (o.nom && o.nom.trim() !== '') occOrder[o.nom.trim()] = index; });
      const sorted = [...expenses].sort((a, b) => {
          const rankA = occOrder.hasOwnProperty((a.compteDe || '').trim()) ? occOrder[(a.compteDe || '').trim()] : -1;
          const rankB = occOrder.hasOwnProperty((b.compteDe || '').trim()) ? occOrder[(b.compteDe || '').trim()] : -1;
          if (rankA !== rankB) return rankA - rankB; 
          const valA = parseFloat((a.montant || '0').toString().replace(',', '.'));
          const valB = parseFloat((b.montant || '0').toString().replace(',', '.'));
          return (isNaN(valA) ? 0 : valA) - (isNaN(valB) ? 0 : valB);
      });
      setExpenses(sorted);
  };

  const processJsonData = (rawText) => {
      try {
          let cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          cleanedText = cleanedText.replace(/\\\[/g, '[').replace(/\\\]/g, ']');
          const data = JSON.parse(cleanedText);
          
          if (data.formData) setFormData(prev => ({ ...prev, ...data.formData }));
          if (data.experts && Array.isArray(data.experts)) {
              const newExperts = data.experts.filter(e => e.nom && e.nom.trim() !== "");
              setExpertsList(prev => { const merged = [...prev]; newExperts.forEach(ne => { if (!merged.find(pe => pe.nom.toLowerCase() === ne.nom.toLowerCase())) merged.push(ne); }); return merged; });
          }
          if (data.occupants && Array.isArray(data.occupants)) setOccupants(prev => [...prev, ...data.occupants.filter(o => o.nom).map(o => ({...o, id: Date.now() + Math.random()}))]);
          if (data.expenses && Array.isArray(data.expenses)) setExpenses(prev => [...prev, ...data.expenses.filter(ex => ex.prestataire || ex.montant).map(ex => ({...ex, id: Date.now() + Math.random()}))]);
          
          alert("✅ Données IA importées avec succès !"); 
          setPastedJson('');
          setActiveTab('builder');
      } catch (error) { 
          alert("❌ Erreur de lecture : " + error.message); 
      }
  };

  const handleJsonImport = (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => { processJsonData(event.target.result); };
      reader.readAsText(file);
      e.target.value = null;
  };

  const handlePasteImport = () => {
      if(!pastedJson.trim()) return alert("Veuillez coller la réponse de l'IA dans la zone de texte d'abord.");
      processJsonData(pastedJson);
  };

  const copyPrompt = () => {
      const promptText = `Tu es un assistant spécialisé dans l'extraction de données pour l'encodage de dossiers d'expertise incendie.
Je vais te fournir des données brutes en vrac. Analyse ces informations et formate-les STRICTEMENT dans le format JSON ci-dessous.
Règles IMPÉRATIVES :
1. Ne renvoie QUE du texte au format JSON valide. Aucun texte d'explication.
2. Si introuvable, laisse "". N'invente JAMAIS.
3. Montants au format texte avec virgule (ex: "350,00").
4. "statut" DOIT être : "Locataire", "Propriétaire occupant", "Propriétaire non occupant", ou "Syndic / Autre".
5. "typeMontant" DOIT être : "HTVA", "TVAC", ou "Forfait".

Voici le format JSON :
{
"formData": { "dateSinistre": "", "dateDeclaration": "", "declarant": "", "nomCie": "", "nomContrat": "", "numPolice": "", "numSinistreCie": "", "adresse": "", "cause": "" },
"experts": [ { "nom": "NOM", "tel": "04XX XX XX" } ],
"occupants": [ { "etage": "", "statut": "Locataire", "nom": "", "tel": "", "email": "", "rc": "Non", "rcPolice": "", "secAssurance": "Non", "secType": "", "secPolice": "", "secCie": "" } ],
"expenses": [ { "prestataire": "", "type": "", "ref": "", "desc": "", "compteDe": "", "montant": "", "typeMontant": "HTVA" } ]
}`;
      navigator.clipboard.writeText(promptText).then(() => alert("✅ Prompt copié !")).catch(err => alert("Erreur copie."));
  };

  const contextValue = {
      activeTab, setActiveTab, isPreviewMode, setIsPreviewMode, sidebarWidth, setSidebarWidth, isResizing, setIsResizing,
      uiZoom, setUiZoom, fitBlocks, setFitBlocks, pastedJson, setPastedJson,
      draggedOccIndex, setDraggedOccIndex, draggedExpIndex, setDraggedExpIndex,
      showSubtotals, setShowSubtotals, orgaAdvancedMode, setOrgaAdvancedMode,
      expandedOccId, setExpandedOccId, expandedExpId, setExpandedExpId,
      savedDossiers, setSavedDossiers, dossierSearch, setDossierSearch,
      expertsList, setExpertsList, franchises, setFranchises,
      showExpertDropdown, setShowExpertDropdown, showExpertDropdownContradictoire, setShowExpertDropdownContradictoire,
      showFranchiseDropdown, setShowFranchiseDropdown,
      formData, setFormData, blockTitles, setBlockTitles, references, setReferences,
      occupants, setOccupants, expenses, setExpenses, blocksVisible, setBlocksVisible,
      customBlocks, setCustomBlocks, blockOrder, setBlockOrder, blockWidths, setBlockWidths, styles, setStyles,
      startResizing, stopResizing, resize, handleReset, handleChange,
      handleTitleChange, handleStyleChange, moveBlockUp, moveBlockDown, toggleBlockWidth, saveDossier, loadDossier,
      deleteDossier, generatePDF, getSortedBlocks, addRef, updateRef, removeRef,
      addOcc, updateOcc, removeOcc, sortOccupantsByFloor, addExpense, updateExpense,
      removeExpense, reorganizeExpenses, processJsonData, handleJsonImport,
      handlePasteImport, copyPrompt
  };

  return (
      <ExpertiseContext.Provider value={contextValue}>
          {children}
      </ExpertiseContext.Provider>
  );
};
