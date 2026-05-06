import { useFinanceStore } from "../store/financeStore";
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import localforage from 'localforage';
import html2canvas from 'html2canvas';

export const ExpertiseContext = createContext();

const initialFormData = {
  dateExp: '', heureExp: '', refPechard: '', nomResidence: '',
  adresse: '', franchise: '', pertesIndirectes: '', expertInfos: '', bureau: '',
  dateSinistre: '', dateDeclaration: '', declarant: '', 
  isContradictoire: false, cieContradictoire: '', bureauContradictoire: '', expertContradictoire: '', compteDeContradictoire: '',
  nomCie: '', nomContrat: '', numPolice: '', numSinistreCie: '', numConditionsGenerales: '',
  cause: "", divers: ""
};

const initialTitles = {
  coord: "Données d'expertise",
  infos: "Informations générales & références diverses",
  cause: "Cause et description du sinistre",
  orga: "Parties",
  frais: "Réclamations",
  photos: "Photos",
  divers: "Divers & Remarques",
  annexes_libres: "Annexes Libres"
};

const initialVisibility = { titre: true, coord: true, infos: true, cause: true, orga: true, frais: true, frais_liste: true, photos: true, divers: true, annexes_libres: true };
const initialBlockOrder = ['titre', 'coord', 'infos', 'cause', 'orga', 'frais', 'frais_liste', 'photos', 'divers', 'annexes_libres'];
const initialBlockWidths = { titre: '100%', coord: '100%', infos: '100%', cause: '100%', orga: '100%', frais: '100%', frais_liste: '100%', photos: '100%', divers: '100%', annexes_libres: '100%' };
const initialStyles = {
  titre: { border: true, fontSize: 16, color: '#0f172a', fontFamily: 'Arial', textAlign: 'center' },
  coord: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' },
  infos: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' },
  cause: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' },
  orga: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' },
  frais: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' },
  frais_liste: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' },
  photos: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' },
  divers: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' },
  annexes_libres: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' }
};



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
  const financeStore = useFinanceStore();

  const [activeTab, setActiveTab] = useState('builder');
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Interface
  const [sidebarWidth, setSidebarWidth] = useState(450);
  const [isResizing, setIsResizing] = useState(false);
  const [uiZoom, setUiZoom] = useState(1);
  const [fitBlocks, setFitBlocks] = useState({});
  const [pastedJson, setPastedJson] = useState("");
  const [orgaAdvancedMode, setOrgaAdvancedMode] = useState(false);

  // Paramètres additionnels
  const [showSubtotals, setShowSubtotals] = useState(false);

  // AI Mode Config
  const [isAiModeActive, setIsAiModeActive] = useState(() => localStorage.getItem('isAiModeActive') === 'true');
  const [aiConfig, setAiConfig] = useState(() => ({
      apiKey: localStorage.getItem('aiApiKey') || '',
      model: localStorage.getItem('aiModel') || 'gpt-4o',
      provider: localStorage.getItem('aiProvider') || 'openai'
  }));

  const toggleAiMode = () => {
      setIsAiModeActive(prev => {
          const next = !prev;
          localStorage.setItem('isAiModeActive', next);
          return next;
      });
  };

  const updateAiConfig = (newConfig) => {
      setAiConfig(prev => {
          const next = { ...prev, ...newConfig };
          localStorage.setItem('aiApiKey', next.apiKey);
          localStorage.setItem('aiModel', next.model);
          localStorage.setItem('aiProvider', next.provider);
          return next;
      });
  };

  const [hideAnnexIndex, setHideAnnexIndex] = useState(false);

  // Ingestion Modal State
  const [ingestionModal, setIngestionModal] = useState({ isOpen: false, type: null, file: null, data: null, existingId: null });
  const openIngestion = (file, type, initialData = null, existingId = null) => {
      setIngestionModal({ isOpen: true, type, file, data: initialData, existingId });
  };
  const closeIngestion = () => {
      setIngestionModal({ isOpen: false, type: null, file: null, data: null, existingId: null });
  };
  const [printSelection, setPrintSelection] = useState(null); // null = tout inclus, Set<string> = sélection
  const [coverPageCount, setCoverPageCount] = useState(1); // nb de pages de la page de garde (pour indexation correcte)
  const [expandedOccId, setExpandedOccId] = useState(null);
  const [expandedExpId, setExpandedExpId] = useState(null);

  // Données globales
  const [currentDossierId, setCurrentDossierId] = useState(null);
  const [savedDossiers, setSavedDossiers] = useState([]);
  const [dossierSearch, setDossierSearch] = useState('');
  const [expertsList, setExpertsList] = useState([]);
  const [franchises, setFranchises] = useState([]);
  const [showExpertDropdown, setShowExpertDropdown] = useState(false);
  const [showExpertDropdownContradictoire, setShowExpertDropdownContradictoire] = useState(false);
  const [showFranchiseDropdown, setShowFranchiseDropdown] = useState(false); 
  const [prestatairesList, setPrestatairesList] = useState([]);

  // Formulaire
  const formData = financeStore.metier.formData;
  const setFormData = (data) => {
    if (typeof data === 'function') {
      financeStore.updateFormData(data(formData));
    } else {
      financeStore.updateFormData(data);
    }
  };
  const [blockTitles, setBlockTitles] = useState(initialTitles);
  const [references, setReferences] = useState([]);
  const occupants = financeStore.pii.occupants;
  const setOccupants = financeStore.setOccupants;
  const expenses = financeStore.metier.expenses;
  const setExpenses = financeStore.setExpenses;
  const [attachedFiles, setAttachedFiles] = useState({});
  const [attachedPhotos, setAttachedPhotos] = useState({});
  const [attachedFreeAnnexes, setAttachedFreeAnnexes] = useState([]);
  const [isMerging, setIsMerging] = useState(false);

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
      const savedPrestataires = localStorage.getItem('expertise_prestataires_v1');
      if (savedPrestataires) setPrestatairesList(JSON.parse(savedPrestataires));

      const parsedExperts = savedExperts ? JSON.parse(savedExperts) : [];
      const parsedFranchises = savedFranchises ? JSON.parse(savedFranchises) : [];

      const mergedExpertsMap = new Map();

      parsedExperts.forEach((exp) => {
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
      setStyles(initialStyles); setShowSubtotals(false); setFitBlocks({}); setPastedJson('');
      setAttachedFiles({}); setAttachedPhotos({}); setCurrentDossierId(null);
  };

  const handleChange = (e) => financeStore.updateFormData({ [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
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

  const handleNewDossier = () => {
      if (!window.confirm("Créer un nouveau dossier ? Les données non sauvegardées seront perdues.")) return;
      const name = window.prompt("Nom du nouveau dossier ?");
      if (!name) return;
      
      handleReset();
      
      const newId = crypto.randomUUID();
      const newDossier = { id: newId, name, date: new Date().toLocaleString('fr-FR'), data: { formData: initialFormData, blockTitles: initialTitles } };
      const updated = [newDossier, ...savedDossiers];
      
      setSavedDossiers(updated);
      localStorage.setItem('expertise_dossiers_v1', JSON.stringify(updated));
      setCurrentDossierId(newId);
  };

  const saveDossier = () => {
      let name = formData.refPechard || formData.nomResidence || `Expertise_${new Date().toLocaleDateString()}`;
      if (!currentDossierId) {
          name = window.prompt("Nom de ce dossier (ex: Nom, Ref) ?", name);
          if (!name) return;
      }
      
      const dossierData = { formData, blockTitles, references, occupants, expenses, blocksVisible, styles, blockOrder, blockWidths, customBlocks, showSubtotals, fitBlocks, attachedFiles, attachedPhotos, attachedFreeAnnexes };
      
      let updated;
      if (currentDossierId) {
          updated = savedDossiers.map(d => d.id === currentDossierId ? { ...d, date: new Date().toLocaleString('fr-FR'), data: dossierData } : d);
      } else {
          const newId = crypto.randomUUID();
          const newDossier = { id: newId, name, date: new Date().toLocaleString('fr-FR'), data: dossierData };
          updated = [newDossier, ...savedDossiers];
          setCurrentDossierId(newId);
      }
      
      setSavedDossiers(updated); localStorage.setItem('expertise_dossiers_v1', JSON.stringify(updated));
      alert("✅ Dossier sauvegardé !");
  };

  const saveDossierAs = () => {
      const name = window.prompt("Nom de la copie de ce dossier ?", (formData.refPechard || formData.nomResidence || `Expertise_${new Date().toLocaleDateString()}`) + " (Copie)");
      if (!name) return;
      
      const dossierData = { formData, blockTitles, references, occupants, expenses, blocksVisible, styles, blockOrder, blockWidths, customBlocks, showSubtotals, fitBlocks, attachedFiles, attachedPhotos, attachedFreeAnnexes };
      const newId = crypto.randomUUID();
      const newDossier = { id: newId, name, date: new Date().toLocaleString('fr-FR'), data: dossierData };
      
      const updated = [newDossier, ...savedDossiers];
      setSavedDossiers(updated); localStorage.setItem('expertise_dossiers_v1', JSON.stringify(updated));
      setCurrentDossierId(newId);
      alert("✅ Copie du dossier sauvegardée !");
  };

  const loadDossier = (dossier) => {
      if(!window.confirm(`⚠️ Charger "${dossier.name}" écrasera vos données actuelles. Continuer ?`)) return;
      const d = dossier.data;
      if(d.formData) setFormData(d.formData); 
      if(d.blockTitles) {
          const titles = { ...d.blockTitles };
          if (!titles.annexes_libres) titles.annexes_libres = "Annexes Libres";
          if (titles.cause === "Cause du sinistre") titles.cause = "Cause et description du sinistre";
          setBlockTitles(titles);
      }
      if(d.references) setReferences(d.references); if(d.occupants) setOccupants(d.occupants); 
      if(d.expenses) setExpenses(d.expenses);
      if(d.blocksVisible) {
          const vis = { ...d.blocksVisible };
          if (!('frais_liste' in vis)) vis.frais_liste = true;
          setBlocksVisible(vis);
      }
      if(d.styles) setStyles(d.styles);
      if(d.blockOrder) {
          let order = d.blockOrder;
          if (!order.includes('frais_liste') && order.includes('frais')) {
              const idx = order.indexOf('frais');
              order = [...order.slice(0, idx + 1), 'frais_liste', ...order.slice(idx + 1)];
          }
          setBlockOrder(order);
      }
      if(d.blockWidths) setBlockWidths(d.blockWidths); if(d.customBlocks) setCustomBlocks(d.customBlocks); 
      if(d.showSubtotals !== undefined) setShowSubtotals(d.showSubtotals);
      if(d.fitBlocks) setFitBlocks(d.fitBlocks);
      if(d.attachedFiles) setAttachedFiles(d.attachedFiles); else setAttachedFiles({});
      if(d.attachedPhotos) setAttachedPhotos(d.attachedPhotos); else setAttachedPhotos({});
      if(d.attachedFreeAnnexes) setAttachedFreeAnnexes(d.attachedFreeAnnexes); else setAttachedFreeAnnexes([]);
      setCurrentDossierId(dossier.id);
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
      const BUILTIN_IDS = ['titre', 'coord', 'infos', 'cause', 'orga', 'frais', 'frais_liste', 'photos', 'divers', 'annexes_libres'];
      const currentCustomIds = customBlocks.map(c => c.id);
      const allIds = [...blockOrder];
      
      // S'assurer que tous les blocs natifs sont présents (pour les anciens dossiers)
      BUILTIN_IDS.forEach(id => {
          if (!allIds.includes(id)) allIds.push(id);
      });

      currentCustomIds.forEach(id => {
          if (!allIds.includes(id)) allIds.push(id);
      });
      return allIds.filter(id => {
          if (BUILTIN_IDS.includes(id)) return blocksVisible[id] !== false;
          return blocksVisible[id] || currentCustomIds.includes(id);
      });
  };

  const addRef = () => setReferences([...references, { id: crypto.randomUUID(), nom: '', ref: '' }]);
  const updateRef = (id, field, value) => setReferences(references.map(r => r.id === id ? { ...r, [field]: value } : r));
  const removeRef = (id) => setReferences(references.filter(r => r.id !== id));

  const addOcc = () => {
      const newId = crypto.randomUUID();
      financeStore.addOccupant({ id: newId, nom: '', prenom: '', etage: '', statut: 'Locataire', tel: '', email: '', rc: 'Non', rcPolice: '', secAssurance: 'Non', secType: '', secPolice: '', secCie: '' });
      setExpandedOccId(newId);
      return newId;
  };
  const updateOcc = (id, field, value) => {
      financeStore.updateOccupant(id, { [field]: value });
  };

  const handleAddPrestataire = (name) => {
      const trimmed = (name || '').trim();
      if (!trimmed) return;
      setPrestatairesList(prev => {
          if (prev.includes(trimmed)) return prev;
          const next = [...prev, trimmed].sort((a, b) => a.localeCompare(b));
          localStorage.setItem('expertise_prestataires_v1', JSON.stringify(next));
          return next;
      });
  };
  const removeOcc = (id) => financeStore.removeOccupant(id);

  const parseFloor = (str) => {
      if (!str) return -999;
      const lower = str.toLowerCase();
      if (lower.startsWith('rez') || lower === 'rdc') return 0;
      if (lower.startsWith('sous-sol') || lower.startsWith('cave')) return -1;
      const match = lower.match(/-?\d+/);
      if (match) return parseInt(match[0], 10);
      return -998;
  };

  const sortOccupantsByFloor = () => {
      const statusOrder = { "Propriétaire occupant": 1, "Propriétaire non occupant": 2, "Autre": 3, "Locataire": 4 };
      const sorted = [...occupants].sort((a, b) => {
          const etageA = (a.etage || '').trim();
          const etageB = (b.etage || '').trim();
          
          const floorA = parseFloor(etageA);
          const floorB = parseFloor(etageB);
          
          if (floorA !== floorB) {
              return floorB - floorA; // Descending
          }
          
          if (etageA !== etageB) return etageA.localeCompare(etageB, undefined, { numeric: true, sensitivity: 'base' });
          const rankA = statusOrder[a.statut] || 99;
          const rankB = statusOrder[b.statut] || 99;
          return rankA - rankB;
      });
      setOccupants(sorted);
  };

  const addExpense = (expenseObj = null) => {
      let idToReturn;
      if (expenseObj) {
          financeStore.addExpense(expenseObj);
          setExpandedExpId(expenseObj.id);
          idToReturn = expenseObj.id;
      } else {
          const newId = crypto.randomUUID();
          financeStore.addExpense({ id: newId, prestataire: '', type: '', ref: '', desc: '', compteDe: '', montant: '', montantReclame: '', montantValide: '', pourcentageVetuste: 0, motifRefus: '', typeMontant: 'HTVA', avisCouverture: 'Oui', noteCouverture: '' });
          setExpandedExpId(newId);
          idToReturn = newId;
      }
      return idToReturn;
  };
  const updateExpense = (id, field, value) => {
      let updates = { [field]: value };
      if (field === 'montant') {
         updates.montantReclame = value;
         updates.montantValide = value;
      }
      financeStore.updateExpense(id, updates);
  };
  const removeExpense = (id) => financeStore.removeExpense(id);

  const reorganizeExpenses = () => {
      const occOrder = {};
      occupants.forEach((o, index) => { occOrder[o.id] = index; });
      const sorted = [...expenses].sort((a, b) => {
          const rankA = occOrder.hasOwnProperty(a.compteDe) ? occOrder[a.compteDe] : -1;
          const rankB = occOrder.hasOwnProperty(b.compteDe) ? occOrder[b.compteDe] : -1;
          if (rankA !== rankB) return rankA - rankB; 
          const valA = parseFloat((a.montantReclame || a.montant || '0').toString().replace(',', '.'));
          const valB = parseFloat((b.montantReclame || b.montant || '0').toString().replace(',', '.'));
          return (isNaN(valA) ? 0 : valA) - (isNaN(valB) ? 0 : valB);
      });
      financeStore.setExpenses(sorted);
  };

  const handleAttachFile = async (expenseId, file) => {
      if (!file) return;
      
      try {
          const arrayBuffer = await file.arrayBuffer();
          let pages = 1; // Default for images
          let isPdf = false;

          if (file.type === 'application/pdf') {
              isPdf = true;
              try {
                  const pdfDoc = await PDFDocument.load(arrayBuffer);
                  pages = pdfDoc.getPageCount();
              } catch (e) {
                  console.error("Non-fatal error reading PDF pages:", e);
                  pages = 1;
              }
          } else if (!file.type.startsWith('image/')) {
              return alert("Seuls les fichiers PDF et les images sont acceptés pour le moment.");
          }

          const dbKey = `file_${crypto.randomUUID()}_${file.name}`;
          await localforage.setItem(dbKey, arrayBuffer);
          
          const fileObj = { name: file.name, pages, dbKey, isPdf, type: file.type };
          setAttachedFiles(prev => {
              const current = prev[expenseId] || [];
              return { ...prev, [expenseId]: [...current, fileObj] };
          });
      } catch (err) {
          alert("Erreur lors de la lecture du fichier : " + err.message);
      }
  };

  const handleRemoveFile = async (docId, dbKeyToRemove) => {
      if (dbKeyToRemove) {
          await localforage.removeItem(dbKeyToRemove);
          setAttachedFiles(prev => {
              const current = prev[docId] || [];
              const updated = current.filter(f => f.dbKey !== dbKeyToRemove);
              if (updated.length === 0) {
                  const next = { ...prev };
                  delete next[docId];
                  return next;
              }
              return { ...prev, [docId]: updated };
          });
      } else {
          const files = attachedFiles[docId] || [];
          for (const f of files) await localforage.removeItem(f.dbKey);
          setAttachedFiles(prev => {
              const next = { ...prev };
              delete next[docId];
              return next;
          });
      }
  };

  const handleAttachPhoto = async (occupantId, file) => {
      if (!file) return;
      const isPdf = file.type === 'application/pdf';
      const isImage = file.type.startsWith('image/');
      if (!isPdf && !isImage) return alert('Seuls les images (JPG, PNG) et les PDF sont acceptés.');

      try {
          const arrayBuffer = await file.arrayBuffer();
          const dbKey = `${isPdf ? 'pdf' : 'img'}_${crypto.randomUUID()}_${file.name}`;
          await localforage.setItem(dbKey, arrayBuffer);

          if (isPdf) {
              const pdfDoc = await PDFDocument.load(arrayBuffer);
              const pages = pdfDoc.getPageCount();
              setAttachedPhotos(prev => {
                  const current = prev[occupantId] || [];
                  return { ...prev, [occupantId]: [...current, { name: file.name, dbKey, isPdf: true, pages }] };
              });
          } else {
              const blob = new Blob([arrayBuffer], { type: file.type });
              const dataUrl = URL.createObjectURL(blob);
              setAttachedPhotos(prev => {
                  const current = prev[occupantId] || [];
                  return { ...prev, [occupantId]: [...current, { name: file.name, dbKey, dataUrl, isPdf: false }] };
              });
          }
      } catch (err) {
          alert("Erreur lors de l'ajout du fichier : " + err.message);
      }
  };

  const handleRemovePhoto = async (occupantId, dbKey) => {
      await localforage.removeItem(dbKey);
      setAttachedPhotos(prev => {
          const current = prev[occupantId] || [];
          const updated = current.filter(p => p.dbKey !== dbKey);
          if (updated.length === 0) {
              const next = { ...prev };
              delete next[occupantId];
              return next;
          }
          return { ...prev, [occupantId]: updated };
      });
  };

  const handleAttachFreeAnnex = async (file, generatedTitle = null, desc = '') => {
      if (!file) return;
      const isPdf = file.type === 'application/pdf';
      const isImage = file.type.startsWith('image/');
      if (!isPdf && !isImage) return alert('Seuls les images (JPG, PNG) et les PDF sont acceptés.');

      try {
          const arrayBuffer = await file.arrayBuffer();
          const dbKey = `free_${isPdf ? 'pdf' : 'img'}_${crypto.randomUUID()}_${file.name}`;
          await localforage.setItem(dbKey, arrayBuffer);

          let pages = 1;
          if (isPdf) {
              const pdfDoc = await PDFDocument.load(arrayBuffer);
              pages = pdfDoc.getPageCount();
          }
          
          setAttachedFreeAnnexes(prev => [...prev, { id: crypto.randomUUID().toString(), name: generatedTitle || file.name, customName: generatedTitle || file.name, desc: desc, dbKey, isPdf, pages }]);
      } catch (err) {
          alert('Erreur lors de la lecture du fichier : ' + err.message);
      }
  };

  const handleRemoveFreeAnnex = async (id, dbKeyToRemove) => {
      if (dbKeyToRemove) await localforage.removeItem(dbKeyToRemove);
      setAttachedFreeAnnexes(prev => prev.filter(f => f.id !== id));
  };

  const handleUpdateFreeAnnex = (id, field, value) => {
      setAttachedFreeAnnexes(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const handleOpenFile = async (dbKey) => {
      try {
          const fileBytes = await localforage.getItem(dbKey);
          if (!fileBytes) return alert("Fichier introuvable dans la base locale.");

          let mimeType = 'application/pdf';
          if (dbKey.startsWith('img_')) {
              mimeType = 'image/jpeg';
          } else if (dbKey.startsWith('file_')) {
              // Try to guess from magic bytes or keep application/pdf
              const arr = new Uint8Array(fileBytes).subarray(0, 4);
              const header = Array.from(arr).map(b => b.toString(16)).join('');
              if (header.startsWith('89504e47')) mimeType = 'image/png';
              else if (header.startsWith('ffd8ff')) mimeType = 'image/jpeg';
          }

          const blob = new Blob([fileBytes], { type: mimeType });
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank');
      } catch (err) {
          console.error("Erreur d'ouverture du fichier", err);
          alert("Erreur lors de l'ouverture : " + err.message);
      }
  };


  const generateMasterIndex = useCallback((baseCoverPages, selOverride = undefined) => {
      const sel = selOverride !== undefined ? selOverride : printSelection;
      let currentPage = baseCoverPages + 1;
      let annexeIndex = 1;
      const masterIndex = [];

      const isFileIncluded = (id, dbKey) => !sel || sel.has(`${id}::${dbKey}`);

      const processDoc = (id, label, files) => {
          if (!files) return;
          const arr = Array.isArray(files) ? files : [files];
          const validFiles = arr.filter(f => isFileIncluded(id, f.dbKey));
          if (validFiles.length === 0) return;

          const totalPages = validFiles.reduce((sum, f) => sum + (f.pages || 0), 0);
          if (totalPages === 0) return;

          masterIndex.push({ id, label, annexeIndex, startPage: currentPage, endPage: currentPage + totalPages - 1 });
          currentPage += totalPages;
          annexeIndex++;
      };

      // L'ORDRE ICI DOIT ÊTRE LE MÊME QUE DANS downloadDossierPDF
      processDoc('doc_mail_expertise', 'Mails de fixation et confirmation', attachedFiles['doc_mail_expertise']);
      processDoc('doc_mail_declaration', 'Mail de déclaration', attachedFiles['doc_mail_declaration']);
      processDoc('doc_rapport_cause', 'Rapport de recherche', attachedFiles['doc_rapport_cause']);

      for (const occ of occupants) {
          const photoGroupKey = 'doc_photos_occ_' + occ.id;
          if (sel && !sel.has(photoGroupKey)) continue;
          const pList = attachedPhotos[occ.id];
          if (pList && pList.length > 0) {
              const imgs = pList.filter(p => !p.isPdf);
              const pdfs = pList.filter(p => p.isPdf);
              const totalPages = Math.ceil(imgs.length / 2) + pdfs.reduce((s, p) => s + (p.pages || 0), 0);

              if (totalPages > 0) {
                  masterIndex.push({ id: photoGroupKey, label: `Photos de ${occ.nom}`, annexeIndex, startPage: currentPage, endPage: currentPage + totalPages - 1 });
                  currentPage += totalPages;
                  annexeIndex++;
              }
          }
      }

      expenses.forEach(exp => processDoc(exp.id, exp.prestataire || 'Frais', attachedFiles[exp.id]));
      processDoc('doc_cond_part', 'Conditions particulières', attachedFiles['doc_cond_part']);
      processDoc('doc_cond_gen', 'Conditions générales', attachedFiles['doc_cond_gen']);

      attachedFreeAnnexes.forEach(file => {
          if (!sel || sel.has(`free::${file.id}`)) {
              if (file.pages > 0) {
                  masterIndex.push({ id: file.id, label: file.customName || file.name, annexeIndex, startPage: currentPage, endPage: currentPage + file.pages - 1 });
                  currentPage += file.pages;
                  annexeIndex++;
              }
          }
      });

      return masterIndex;
  }, [attachedFiles, attachedPhotos, attachedFreeAnnexes, occupants, expenses, printSelection]);

  const getPaginationInfo = (docId, forcedLabel = '', selOverride = undefined) => {
      if (hideAnnexIndex) return null;
      const indexList = generateMasterIndex(coverPageCount, selOverride);
      const item = indexList.find(x => x.id === docId);
      if (!item) return null;

      const label = forcedLabel || item.label;
      const pagesText = item.startPage === item.endPage ? `Page ${item.startPage}` : `Pages ${item.startPage} à ${item.endPage}`;
      return { text: `${label} (Annexe ${item.annexeIndex} - ${pagesText})`, num: item.annexeIndex, annexeIndex: item.annexeIndex, startPage: item.startPage, endPage: item.endPage };
  };

  // Retourne la liste ordonnée de toutes les annexes disponibles pour la modale
  const getAnnexList = () => {
      const list = [];
      const addEntry = (id, label, files) => {
          if (!files) return;
          const arr = Array.isArray(files) ? files : [files];
          arr.forEach(f => list.push({ id, label, file: f }));
      };
      addEntry('doc_mail_expertise', 'Mails de fixation et confirmation', attachedFiles['doc_mail_expertise']);
      addEntry('doc_mail_declaration', 'Mail de déclaration', attachedFiles['doc_mail_declaration']);
      addEntry('doc_rapport_cause', 'Rapport de recherche', attachedFiles['doc_rapport_cause']);
      for (const occ of occupants) {
          const pList = attachedPhotos[occ.id];
          if (pList && pList.length > 0) {
              const imgCount = pList.filter(p => !p.isPdf).length;
              const pdfItems = pList.filter(p => p.isPdf);
              const totalPages = Math.ceil(imgCount / 2) + pdfItems.reduce((s, p) => s + (p.pages || 0), 0);
              list.push({ id: 'doc_photos_occ_' + occ.id, label: `Photos/docs de ${occ.nom || 'Inconnu'}`, isPhotos: true, occupantId: occ.id, count: pList.length, totalPages });
          }
      }
      for (const exp of expenses) addEntry(exp.id, exp.prestataire || 'Frais', attachedFiles[exp.id]);
      addEntry('doc_cond_part', 'Conditions particulières', attachedFiles['doc_cond_part']);
      addEntry('doc_cond_gen', 'Conditions générales', attachedFiles['doc_cond_gen']);

      attachedFreeAnnexes.forEach(f => list.push({ id: f.id, label: f.customName || f.name, file: f, isFree: true }));

      return list;
  };

  const downloadSelectedPDF = async (selectedKeys) => {
      // selectedKeys: Set of "id::dbKey" strings (or "id" for photos groups)
      setIsMerging(true);
      try {
          const mergedPdf = await PDFDocument.create();
          const font = await mergedPdf.embedFont(StandardFonts.HelveticaBold);

          const appendPdf = async (dbKey) => {
              const pdfBytes = await localforage.getItem(dbKey);
              if (pdfBytes) {
                  const pdf = await PDFDocument.load(pdfBytes);
                  const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                  copiedPages.forEach((page) => mergedPdf.addPage(page));
              }
          };

          const appendPdfFiles = async (id) => {
              let files = attachedFiles[id];
              if (!files) return;
              if (!Array.isArray(files)) files = [files];
              for (const f of files) {
                  const key = `${id}::${f.dbKey}`;
                  if (selectedKeys.has(key)) await appendPdf(f.dbKey);
              }
          };

          await appendPdfFiles('doc_mail_expertise');
          await appendPdfFiles('doc_mail_declaration');
          await appendPdfFiles('doc_rapport_cause');

          for (const occ of occupants) {
              const photoGroupKey = 'doc_photos_occ_' + occ.id;
              if (!selectedKeys.has(photoGroupKey)) continue;
              const pList = attachedPhotos[occ.id];
              if (pList && pList.length > 0) {
                  // Images en grille 2 par page
                  const imgs = pList.filter(p => !p.isPdf);
                  const pdfs = pList.filter(p => p.isPdf);
                  if (imgs.length > 0) {
                      for (let i = 0; i < imgs.length; i += 2) {
                          const page = mergedPdf.addPage();
                          const { width, height } = page.getSize();
                          page.drawText(`Photos de : ${occ.nom || 'Inconnu'}`, { x: 50, y: height - 50, size: 16, font });
                          const drawImage = async (imgInfo, yOffset) => {
                              try {
                                  const imgBytes = await localforage.getItem(imgInfo.dbKey);
                                  if (!imgBytes) return;
                                  let image;
                                  if (imgInfo.name.toLowerCase().endsWith('.png')) image = await mergedPdf.embedPng(imgBytes);
                                  else image = await mergedPdf.embedJpg(imgBytes);
                                  const imgDims = image.scaleToFit(width - 100, (height - 150) / 2);
                                  page.drawImage(image, { x: (width - imgDims.width) / 2, y: yOffset - imgDims.height, width: imgDims.width, height: imgDims.height });
                              } catch (e) { console.error('[ExpertiseContext] Erreur lors de l\'intégration de l\'image au PDF :', e); }
                          };
                          await drawImage(imgs[i], height - 80);
                          if (i + 1 < imgs.length) await drawImage(imgs[i + 1], height / 2 - 20);
                      }
                  }
                  // PDFs annexes à la suite
                  for (const pdfItem of pdfs) {
                      await appendPdf(pdfItem.dbKey);
                  }
              }
          }

          for (const exp of expenses) {
              await appendPdfFiles(exp.id);
          }

          await appendPdfFiles('doc_cond_part');
          await appendPdfFiles('doc_cond_gen');

          // --- Annexes Libres ---
          for (const file of attachedFreeAnnexes) {
              if (selectedKeys.has(`free::${file.id}`)) {
                  const bytes = await localforage.getItem(file.dbKey);
                  if (!bytes) continue;
                  if (file.isPdf) {
                      const pdf = await PDFDocument.load(bytes);
                      const copied = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                      copied.forEach(p => mergedPdf.addPage(p));
                  } else {
                      // Support image
                      const page = mergedPdf.addPage([A4W, A4H]);
                      let image;
                      try {
                          if (file.name.toLowerCase().endsWith('.png')) image = await mergedPdf.embedPng(bytes);
                          else image = await mergedPdf.embedJpg(bytes);
                      } catch (e) { console.error('[ExpertiseContext] Failed to embed image in PDF:', e); continue; }
                      const dims = image.scaleToFit(A4W - 100, A4H - 150);
                      page.drawImage(image, { x: (A4W - dims.width) / 2, y: (A4H - dims.height) / 2, width: dims.width, height: dims.height });
                      page.drawText(file.customName || file.name, { x: 50, y: A4H - 40, size: 12, color: rgb(0.2, 0.2, 0.2) });
                  }
              }
          }

          const pages = mergedPdf.getPages();
          if (pages.length === 0) { setIsMerging(false); return alert('Aucune annexe sélectionnée.'); }

          let pageNum = 2;
          for (const page of pages) {
              const { width, height } = page.getSize();
              page.drawText(`Page ${pageNum}`, { x: width - 60, y: 20, size: 10, color: rgb(0.3, 0.3, 0.3) });
              pageNum++;
          }

          const mergedPdfBytes = await mergedPdf.save();
          const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Annexes_${formData.nomResidence || 'Expertise'}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
      } catch (err) {
          alert('Erreur lors de la fusion : ' + err.message);
      }
      setIsMerging(false);
  };

  // Capture la page de garde HTML + annexes → UN seul PDF
  const downloadDossierPDF = async (selectedKeys) => {
      setIsMerging(true);
      try {
          const el = document.getElementById('a4-page');
          if (!el) throw new Error('Élément A4 introuvable.');

          // 1. Préparer l'élément : retirer ombre + min-h
          const prevShadow = el.style.boxShadow;
          const prevMinH   = el.style.minHeight;
          el.style.boxShadow = 'none';
          el.style.minHeight = '0';
          await new Promise(r => requestAnimationFrame(r));

          // Constantes PDF
          const A4W = 595.28, A4H = 841.89;

          // Helper de capture html2canvas (réutilisé pour les 2 passes)
          const captureEl = () => html2canvas(el, {
              scale: 2,
              useCORS: true,
              allowTaint: true,
              backgroundColor: '#ffffff',
              logging: false,
              scrollX: 0,
              scrollY: -window.scrollY,
              ignoreElements: (node) => {
                  if (!node.classList) return false;
                  return node.classList.contains('block-controls') ||
                         node.classList.contains('print:hidden') ||
                         node.getAttribute?.('data-html2canvas-ignore') === 'true';
              }
          });

          // --- PASSE 1 : capture avec coverPageCount = 1 (valeur actuelle) ---
          // → mesure la hauteur réelle du canvas pour déterminer le nb de pages de la page de garde
          const canvas1 = await captureEl();
          const pxPerPt   = canvas1.width / A4W;
          const slicePixH = A4H * pxPerPt;
          const significantH = slicePixH * 0.05; // Tolérance de 5% de page pour éviter les sauts de page vides
          const actualCoverPages = Math.max(1, Math.ceil((canvas1.height - significantH) / slicePixH));

          // --- PASSE 2 (si nécessaire) : mettre à jour le DOM et re-capturer ---
          let canvas = canvas1;
          if (actualCoverPages !== coverPageCount) {
              setCoverPageCount(actualCoverPages); // Met à jour le State React

              // Attendre que React refasse le rendu avec les nouveaux numéros du Master Index
              await new Promise(resolve => setTimeout(resolve, 500));

              canvas = await captureEl(); // Nouvelle capture avec les bons numéros affichés !
          }

          el.style.boxShadow = prevShadow;
          el.style.minHeight = prevMinH;

          // Helper: dataURL → Uint8Array sans fetch
          const dataUrlToBytes = (dataUrl) => {
              const base64 = dataUrl.split(',')[1];
              const binStr = atob(base64);
              const bytes = new Uint8Array(binStr.length);
              for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
              return bytes;
          };

          // Split en pages A4
          const mergedPdf = await PDFDocument.create();
          const font = await mergedPdf.embedFont(StandardFonts.HelveticaBold);
          const pageCount = Math.ceil(canvas.height / slicePixH);


          for (let i = 0; i < pageCount; i++) {
              const startY = Math.round(i * slicePixH);
              const endY   = Math.min(Math.round((i + 1) * slicePixH), canvas.height);
              const h = endY - startY;
              if (h < significantH) continue; // ignorer les tranches quasi-vides (fin de min-h)

              const sliceCanvas = document.createElement('canvas');
              sliceCanvas.width  = canvas.width;
              sliceCanvas.height = h;
              const ctx = sliceCanvas.getContext('2d');
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
              ctx.drawImage(canvas, 0, startY, canvas.width, h, 0, 0, canvas.width, h);

              const jpgBytes = dataUrlToBytes(sliceCanvas.toDataURL('image/jpeg', 0.92));
              const img  = await mergedPdf.embedJpg(jpgBytes);
              const drawnH = h / pxPerPt; // hauteur en points PDF
              const page = mergedPdf.addPage([A4W, A4H]);
              page.drawImage(img, { x: 0, y: A4H - drawnH, width: A4W, height: drawnH });
          }

          // 3. Append annexes
          const appendDoc = async (file) => {
              try {
                  const bytes = await localforage.getItem(file.dbKey);
                  if (!bytes) return;
                  if (file.isPdf) {
                      const pdf = await PDFDocument.load(bytes);
                      const copied = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                      copied.forEach(p => mergedPdf.addPage(p));
                  } else {
                      const page = mergedPdf.addPage([A4W, A4H]);
                      let image;
                      try {
                        if (file.name.toLowerCase().endsWith('.png')) image = await mergedPdf.embedPng(bytes);
                        else image = await mergedPdf.embedJpg(bytes);
                      } catch (e) { console.error('[ExpertiseContext] Failed to embed standalone image in PDF:', e); return; }
                      const dims = image.scaleToFit(A4W - 100, A4H - 150);
                      page.drawImage(image, { x: (A4W - dims.width) / 2, y: (A4H - dims.height) / 2, width: dims.width, height: dims.height });
                      page.drawText(file.customName || file.name, { x: 50, y: A4H - 40, size: 12, color: rgb(0.2, 0.2, 0.2) });
                  }
              } catch (e) { console.error('[ExpertiseContext] Non-fatal error during PDF merge operation:', e); }
          };

          const appendPdfFiles = async (id) => {
              let files = attachedFiles[id];
              if (!files) return;
              if (!Array.isArray(files)) files = [files];
              for (const f of files) {
                  if (!selectedKeys || selectedKeys.has(`${id}::${f.dbKey}`)) {
                      await appendDoc({ ...f, isPdf: true });
                  }
              }
          };

          await appendPdfFiles('doc_mail_expertise');
          await appendPdfFiles('doc_mail_declaration');
          await appendPdfFiles('doc_rapport_cause');

          for (const occ of occupants) {
              const photoGroupKey = 'doc_photos_occ_' + occ.id;
              if (selectedKeys && !selectedKeys.has(photoGroupKey)) continue;
              const pList = attachedPhotos[occ.id];
              if (pList && pList.length > 0) {
                  const imgs = pList.filter(p => !p.isPdf);
                  const pdfs = pList.filter(p => p.isPdf);
                  if (imgs.length > 0) {
                      for (let i = 0; i < imgs.length; i += 2) {
                          const page = mergedPdf.addPage();
                          const { width, height } = page.getSize();
                          page.drawText(`Photos de : ${occ.nom || 'Inconnu'}`, { x: 50, y: height - 50, size: 16, font });
                          const drawImg = async (imgInfo, yOff) => {
                              try {
                                  const imgBytes = await localforage.getItem(imgInfo.dbKey);
                                  if (!imgBytes) return;
                                  const img = imgInfo.name.toLowerCase().endsWith('.png') ? await mergedPdf.embedPng(imgBytes) : await mergedPdf.embedJpg(imgBytes);
                                  const d = img.scaleToFit(width - 100, (height - 150) / 2);
                                  page.drawImage(img, { x: (width - d.width) / 2, y: yOff - d.height, width: d.width, height: d.height });
                              } catch (e) { console.error('[ExpertiseContext] Non-fatal error during PDF merge operation:', e); }
                          };
                          await drawImg(imgs[i], height - 80);
                          if (i + 1 < imgs.length) await drawImg(imgs[i + 1], height / 2 - 20);
                      }
                  }
                  for (const p of pdfs) await appendDoc(p);
              }
          }

          for (const exp of expenses) await appendPdfFiles(exp.id);
          await appendPdfFiles('doc_cond_part');
          await appendPdfFiles('doc_cond_gen');

          // 3.5 Annexes Libres
          for (const file of attachedFreeAnnexes) {
              if (!selectedKeys || selectedKeys.has(`free::${file.id}`)) await appendDoc(file);
          }

          // 4. Numérotation globale
          const allPages = mergedPdf.getPages();
          let pageNum = 1;
          for (const page of allPages) {
              const { width, height } = page.getSize();
              page.drawText(`Page ${pageNum}`, { x: width - 60, y: 20, size: 10, color: rgb(0.3, 0.3, 0.3) });
              pageNum++;
          }

          const bytes = await mergedPdf.save();
          const blob = new Blob([bytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `Dossier_${formData.nomResidence || formData.refPechard || 'Expertise'}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
      } catch (err) {
          alert('Erreur lors de la génération : ' + err.message);
      } finally {
          setIsMerging(false);
          setCoverPageCount(1); // Réinitialiser pour la vue normale
      }
  };


  const processJsonData = (rawText) => {
      try {
          let cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          cleanedText = cleanedText.replace(/\\\[/g, '[').replace(/\\\]/g, ']');
          const data = JSON.parse(cleanedText);
          
          if (data.dossiers && Array.isArray(data.dossiers)) {
              setSavedDossiers(prev => {
                  const merged = [...prev];
                  data.dossiers.forEach(d => {
                      if (!merged.find(existing => existing.id === d.id)) merged.push(d);
                  });
                  return merged;
              });
          }
          if (data.franchises && Array.isArray(data.franchises)) {
              const safeFranchises = data.franchises.map(f => typeof f === 'object' && f !== null ? Object.values(f).join(' - ') : String(f));
              setFranchises(prev => Array.from(new Set([...prev, ...safeFranchises])));
          }
          if (data.formData) setFormData(prev => ({ ...prev, ...data.formData }));
          if (data.experts && Array.isArray(data.experts)) {
              const newExperts = data.experts.map(e => {
                  if (typeof e === 'string') return { nom: e, tel: '' };
                  let safeNom = typeof e.nom === 'object' && e.nom !== null ? Object.values(e.nom).join(' ') : String(e.nom || '');
                  let safeTel = typeof e.tel === 'object' && e.tel !== null ? Object.values(e.tel).join(' ') : String(e.tel || '');
                  return { ...e, nom: safeNom, tel: safeTel };
              }).filter(e => e.nom && e.nom.trim() !== "");
              setExpertsList(prev => { 
                  const merged = [...prev]; 
                  newExperts.forEach(ne => { 
                      const keyNe = normalizeExpertKey(ne.nom);
                      if (!merged.find(pe => normalizeExpertKey(pe.nom) === keyNe)) {
                          merged.push(ne); 
                      }
                  }); 
                  return merged; 
              });
          }
          if (data.occupants && Array.isArray(data.occupants)) {
             const newOccupants = data.occupants.reduce((acc, o) => { if (o.nom) acc.push({...o, id: crypto.randomUUID()}); return acc; }, []);
             financeStore.setOccupants([...occupants, ...newOccupants]);
          }
          if (data.expenses && Array.isArray(data.expenses)) {
             const newExpenses = data.expenses.reduce((acc, ex) => { if (ex.prestataire || ex.montant) acc.push({...ex, id: crypto.randomUUID(), montantReclame: ex.montant, montantValide: ex.montant}); return acc; }, []);
             financeStore.setExpenses([...expenses, ...newExpenses]);
          }
          
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
"dossiers": [],
"franchises": [],
"formData": { "dateSinistre": "", "dateDeclaration": "", "declarant": "", "nomCie": "", "nomContrat": "", "numPolice": "", "numSinistreCie": "", "adresse": "", "cause": "" },
"experts": [ { "nom": "NOM", "tel": "04XX XX XX" } ],
"occupants": [ { "etage": "", "statut": "Locataire", "nom": "", "tel": "", "email": "", "rc": "Non", "rcPolice": "", "secAssurance": "Non", "secType": "", "secPolice": "", "secCie": "" } ],
"expenses": [ { "prestataire": "", "type": "", "ref": "", "desc": "", "compteDe": "", "montant": "", "typeMontant": "HTVA" } ]
}`;
      navigator.clipboard.writeText(promptText).then(() => alert("✅ Prompt copié !")).catch(err => alert("Erreur copie."));
  };

  const exportGlobalData = () => {
      const data = {
          dossiers: savedDossiers,
          experts: expertsList,
          franchises: franchises
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Expertise_Sauvegarde_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
  };

  const contextValue = {
      activeTab, setActiveTab, isPreviewMode, setIsPreviewMode, sidebarWidth, setSidebarWidth, isResizing, setIsResizing,
      uiZoom, setUiZoom, fitBlocks, setFitBlocks, pastedJson, setPastedJson,
      orgaAdvancedMode, setOrgaAdvancedMode,
      showSubtotals, setShowSubtotals, currentDossierId, setCurrentDossierId,
      expandedOccId, setExpandedOccId, expandedExpId, setExpandedExpId,
      savedDossiers, setSavedDossiers, dossierSearch, setDossierSearch,
      expertsList, setExpertsList, franchises, setFranchises,
      showExpertDropdown, setShowExpertDropdown, showExpertDropdownContradictoire, setShowExpertDropdownContradictoire,
      showFranchiseDropdown, setShowFranchiseDropdown, prestatairesList, setPrestatairesList, handleAddPrestataire,
      formData, setFormData, blockTitles, setBlockTitles, references, setReferences,
      occupants, setOccupants,
      expenses, setExpenses, blocksVisible, setBlocksVisible,
      customBlocks, setCustomBlocks, blockOrder, setBlockOrder, blockWidths, setBlockWidths, styles, setStyles,
      attachedFiles, handleAttachFile, handleRemoveFile,
      attachedPhotos, setAttachedPhotos,
      handleAttachPhoto, handleRemovePhoto,
      attachedFreeAnnexes, setAttachedFreeAnnexes,
      handleAttachFreeAnnex, handleRemoveFreeAnnex, handleUpdateFreeAnnex,
      isMerging,
      getPaginationInfo, downloadSelectedPDF, downloadDossierPDF, getAnnexList,
      hideAnnexIndex, setHideAnnexIndex,
      printSelection, setPrintSelection,
      coverPageCount, setCoverPageCount,
      startResizing, stopResizing, resize, handleReset, handleChange, handleNewDossier,
      ingestionModal, openIngestion, closeIngestion,
      handleTitleChange, handleStyleChange, moveBlockUp, moveBlockDown, toggleBlockWidth, saveDossier, saveDossierAs, loadDossier,
      deleteDossier, generatePDF, getSortedBlocks, addRef, updateRef, removeRef,
      addOcc, updateOcc, removeOcc, sortOccupantsByFloor, addExpense, updateExpense,
      removeExpense, reorganizeExpenses, processJsonData, handleJsonImport,
      handlePasteImport, copyPrompt, exportGlobalData, handleOpenFile,
      isAiModeActive, aiConfig, toggleAiMode, updateAiConfig
  };

  return (
      <ExpertiseContext.Provider value={contextValue}>
          {children}
      </ExpertiseContext.Provider>
  );
};
