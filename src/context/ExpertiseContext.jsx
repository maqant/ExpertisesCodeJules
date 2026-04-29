import React, { createContext, useState, useEffect, useCallback } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import localforage from 'localforage';

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
  cause: "Cause du sinistre",
  orga: "Parties",
  frais: "Réclamations",
  photos: "Photos",
  divers: "Divers & Remarques"
};

const initialVisibility = { titre: true, coord: true, infos: true, cause: true, orga: true, frais: true, photos: true, divers: true };
const initialBlockOrder = ['titre', 'coord', 'infos', 'cause', 'orga', 'frais', 'photos', 'divers'];
const initialBlockWidths = { titre: '100%', coord: '100%', infos: '100%', cause: '100%', orga: '100%', frais: '100%', photos: '100%', divers: '100%' };
const initialStyles = {
  titre: { border: true, fontSize: 16, color: '#0f172a', fontFamily: 'Arial', textAlign: 'center' },
  coord: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' },
  infos: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' },
  cause: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' },
  orga: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' },
  frais: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' },
  photos: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' },
  divers: { border: false, fontSize: 12, color: '#0f172a', fontFamily: 'Arial', textAlign: 'left' }
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
  const [activeTab, setActiveTab] = useState('builder');
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Interface
  const [sidebarWidth, setSidebarWidth] = useState(450);
  const [isResizing, setIsResizing] = useState(false);
  const [uiZoom, setUiZoom] = useState(1);
  const [fitBlocks, setFitBlocks] = useState({});
  const [pastedJson, setPastedJson] = useState("");

  // Paramètres additionnels
  const [showSubtotals, setShowSubtotals] = useState(false);
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
  const [formData, setFormData] = useState(initialFormData);
  const [blockTitles, setBlockTitles] = useState(initialTitles);
  const [references, setReferences] = useState([]);
  const [occupants, setOccupants] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [attachedFiles, setAttachedFiles] = useState({});
  const [attachedPhotos, setAttachedPhotos] = useState({});
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
      let name = formData.refPechard || formData.nomResidence || `Expertise_${new Date().toLocaleDateString()}`;
      if (!currentDossierId) {
          name = window.prompt("Nom de ce dossier (ex: Nom, Ref) ?", name);
          if (!name) return;
      }
      
      const dossierData = { formData, blockTitles, references, occupants, expenses, blocksVisible, styles, blockOrder, blockWidths, customBlocks, showSubtotals, fitBlocks, attachedFiles, attachedPhotos };
      
      let updated;
      if (currentDossierId) {
          updated = savedDossiers.map(d => d.id === currentDossierId ? { ...d, date: new Date().toLocaleString('fr-FR'), data: dossierData } : d);
      } else {
          const newId = Date.now();
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
      
      const newId = Date.now();
      const dossierData = { formData, blockTitles, references, occupants, expenses, blocksVisible, styles, blockOrder, blockWidths, customBlocks, showSubtotals, fitBlocks, attachedFiles, attachedPhotos };
      const newDossier = { id: newId, name, date: new Date().toLocaleString('fr-FR'), data: dossierData };
      
      const updated = [newDossier, ...savedDossiers];
      setSavedDossiers(updated); localStorage.setItem('expertise_dossiers_v1', JSON.stringify(updated));
      setCurrentDossierId(newId);
      alert("✅ Copie du dossier sauvegardée !");
  };

  const loadDossier = (dossier) => {
      if(!window.confirm(`⚠️ Charger "${dossier.name}" écrasera vos données actuelles. Continuer ?`)) return;
      const d = dossier.data;
      if(d.formData) setFormData(d.formData); if(d.blockTitles) setBlockTitles(d.blockTitles);
      if(d.references) setReferences(d.references); if(d.occupants) setOccupants(d.occupants); 
      if(d.expenses) setExpenses(d.expenses); if(d.blocksVisible) setBlocksVisible(d.blocksVisible); 
      if(d.styles) setStyles(d.styles); if(d.blockOrder) setBlockOrder(d.blockOrder); 
      if(d.blockWidths) setBlockWidths(d.blockWidths); if(d.customBlocks) setCustomBlocks(d.customBlocks); 
      if(d.showSubtotals !== undefined) setShowSubtotals(d.showSubtotals);
      if(d.fitBlocks) setFitBlocks(d.fitBlocks);
      if(d.attachedFiles) setAttachedFiles(d.attachedFiles); else setAttachedFiles({});
      if(d.attachedPhotos) setAttachedPhotos(d.attachedPhotos); else setAttachedPhotos({});
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
      setOccupants([...occupants, { id: newId, nom: '', etage: '', statut: 'Locataire', tel: '', email: '', rc: 'Non', rcPolice: '', secAssurance: 'Non', secType: '', secPolice: '', secCie: '', showDetails: false, contreExpert: false, nomContreExpert: '', hasContact: false, contactNom: '', contactTel: '', iban: '' }]);
      setExpandedOccId(newId);
  };
  const updateOcc = (id, field, value) => {
      const fmtOccName = (o) => o.nom ? (o.etage && o.etage.trim() !== '' ? `${o.etage} - ${o.nom}` : o.nom) : '';
      setOccupants(prev => {
          const oldOcc = prev.find(o => o.id === id);
          const next = prev.map(o => o.id === id ? { ...o, [field]: value } : o);
          if (oldOcc) {
              const oldNameFormatted = fmtOccName(oldOcc);
              const nextOcc = next.find(o => o.id === id);
              const newNameFormatted = fmtOccName(nextOcc);
              if ((field === 'nom' || field === 'etage') && oldNameFormatted !== newNameFormatted && oldNameFormatted !== '') {
                  setExpenses(e => e.map(exp => exp.compteDe === oldNameFormatted ? { ...exp, compteDe: newNameFormatted } : exp));
              }
          }
          return next;
      });
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
  const removeOcc = (id) => setOccupants(occupants.filter(o => o.id !== id));

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

  const addExpense = () => {
      const newId = Date.now();
      setExpenses([...expenses, { id: newId, prestataire: '', type: '', ref: '', desc: '', compteDe: '', montant: '', typeMontant: 'HTVA', avisCouverture: 'Oui', noteCouverture: '' }]);
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

  const handleAttachFile = async (expenseId, file) => {
      if (!file) return;
      if (file.type !== 'application/pdf') return alert("Seuls les fichiers PDF sont acceptés pour le moment.");
      
      try {
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await PDFDocument.load(arrayBuffer);
          const pages = pdfDoc.getPageCount();
          
          const dbKey = `pdf_${Date.now()}_${file.name}`;
          await localforage.setItem(dbKey, arrayBuffer);
          
          const fileObj = { name: file.name, pages, dbKey };
          setAttachedFiles(prev => {
              const current = prev[expenseId] || [];
              return { ...prev, [expenseId]: [...current, fileObj] };
          });
      } catch (err) {
          alert("Erreur lors de la lecture du PDF : " + err.message);
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
      if (!file.type.startsWith('image/')) return alert("Seuls les images (JPG, PNG) sont acceptées.");
      
      try {
          const arrayBuffer = await file.arrayBuffer();
          const dbKey = `img_${Date.now()}_${file.name}`;
          await localforage.setItem(dbKey, arrayBuffer);
          
          const blob = new Blob([arrayBuffer], { type: file.type });
          const dataUrl = URL.createObjectURL(blob);

          setAttachedPhotos(prev => {
              const current = prev[occupantId] || [];
              return { ...prev, [occupantId]: [...current, { name: file.name, dbKey, dataUrl }] };
          });
      } catch (err) {
          alert("Erreur lors de l'ajout de la photo : " + err.message);
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

  const getPaginationInfo = (docId, forcedLabel = '') => {
      let currentPage = 2; // Page de garde = 1 page
      let annexeIndex = 1;
      
      const checkDoc = (id, label = '', pagesOverride = null) => {
          let pages = 0;
          if (pagesOverride !== null) {
              pages = pagesOverride;
          } else if (attachedFiles[id] && Array.isArray(attachedFiles[id])) {
              pages = attachedFiles[id].reduce((sum, f) => sum + f.pages, 0);
          } else if (attachedFiles[id]) {
              // Backward compatibility
              pages = attachedFiles[id].pages || 0;
          }
          
          if (docId === id) {
              if (pages === 0) return null;
              const endPage = currentPage + pages - 1;
              const pagesText = pages === 1 ? `Page ${currentPage}` : `Pages ${currentPage} à ${endPage}`;
              // Use forcedLabel if provided (useful for dynamic stuff), otherwise use the block's label
              const finalLabel = forcedLabel || label;
              const text = finalLabel ? `${finalLabel} (Annexe ${annexeIndex} - ${pagesText})` : `(Annexe ${annexeIndex} - ${pagesText})`;
              return { text, annexeIndex, startPage: currentPage, endPage };
          }
          if (pages > 0) {
              currentPage += pages;
              annexeIndex++;
          }
          return null;
      };

      let res;
      res = checkDoc('doc_mail_expertise', 'Mails de fixation et confirmation'); if (res) return res;
      res = checkDoc('doc_mail_declaration', 'Mail de déclaration'); if (res) return res;
      res = checkDoc('doc_rapport_cause', 'Rapport de recherche'); if (res) return res;
      
      for (const occ of occupants) {
          const pList = attachedPhotos[occ.id];
          if (pList && pList.length > 0) {
             const pPages = Math.ceil(pList.length / 2);
             res = checkDoc('doc_photos_occ_' + occ.id, `Photos de ${occ.nom}`, pPages); if (res) return res;
          }
      }
      
      for (const exp of expenses) {
          res = checkDoc(exp.id); if (res) return res;
      }
      
      res = checkDoc('doc_cond_part', 'Conditions particulières'); if (res) return res;
      res = checkDoc('doc_cond_gen', 'Conditions générales'); if (res) return res;
      
      return null;
  };

  const downloadMergedPDF = async () => {
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
              if (!Array.isArray(files)) files = [files]; // Backward compatibility
              for (const f of files) {
                  await appendPdf(f.dbKey);
              }
          };

          await appendPdfFiles('doc_mail_expertise');
          await appendPdfFiles('doc_mail_declaration');
          await appendPdfFiles('doc_rapport_cause');

          for (const occ of occupants) {
              const pList = attachedPhotos[occ.id];
              if (pList && pList.length > 0) {
                  for (let i = 0; i < pList.length; i += 2) {
                      const page = mergedPdf.addPage();
                      const { width, height } = page.getSize();
                      page.drawText(`Photos de : ${occ.nom || 'Inconnu'}`, { x: 50, y: height - 50, size: 16, font });
                      
                      const drawImage = async (imgInfo, yOffset) => {
                          try {
                              const imgBytes = await localforage.getItem(imgInfo.dbKey);
                              if (!imgBytes) return;
                              let image;
                              if (imgInfo.name.toLowerCase().endsWith('.png')) {
                                  image = await mergedPdf.embedPng(imgBytes);
                              } else {
                                  image = await mergedPdf.embedJpg(imgBytes);
                              }
                              const imgDims = image.scaleToFit(width - 100, (height - 150) / 2);
                              page.drawImage(image, {
                                  x: (width - imgDims.width) / 2,
                                  y: yOffset - imgDims.height,
                                  width: imgDims.width,
                                  height: imgDims.height,
                              });
                          } catch (e) {
                              console.error("Erreur image:", e);
                          }
                      };
                      
                      await drawImage(pList[i], height - 80);
                      if (i + 1 < pList.length) {
                          await drawImage(pList[i + 1], height / 2 - 20);
                      }
                  }
              }
          }
          
          for (const exp of expenses) {
              await appendPdfFiles(exp.id);
          }
          
          await appendPdfFiles('doc_cond_part');
          await appendPdfFiles('doc_cond_gen');

          const pages = mergedPdf.getPages();
          if (pages.length === 0) {
              setIsMerging(false);
              return alert("Aucune annexe à fusionner.");
          }

          let pageNum = 2; 
          for (const page of pages) {
              const { width, height } = page.getSize();
              page.drawText(`Page ${pageNum}`, {
                  x: width - 60,
                  y: 20,
                  size: 10,
                  color: rgb(0.3, 0.3, 0.3)
              });
              pageNum++;
          }

          const mergedPdfBytes = await mergedPdf.save();
          const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `Annexes_${formData.nomResidence || 'Expertise'}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
      } catch (err) {
          alert("Erreur lors de la fusion : " + err.message);
      }
      setIsMerging(false);
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
      showSubtotals, setShowSubtotals, currentDossierId, setCurrentDossierId,
      expandedOccId, setExpandedOccId, expandedExpId, setExpandedExpId,
      savedDossiers, setSavedDossiers, dossierSearch, setDossierSearch,
      expertsList, setExpertsList, franchises, setFranchises,
      showExpertDropdown, setShowExpertDropdown, showExpertDropdownContradictoire, setShowExpertDropdownContradictoire,
      showFranchiseDropdown, setShowFranchiseDropdown, prestatairesList, setPrestatairesList, handleAddPrestataire,
      formData, setFormData, blockTitles, setBlockTitles, references, setReferences,
      occupants, setOccupants, expenses, setExpenses, blocksVisible, setBlocksVisible,
      customBlocks, setCustomBlocks, blockOrder, setBlockOrder, blockWidths, setBlockWidths, styles, setStyles,
      attachedFiles, attachedPhotos, isMerging, handleAttachFile, handleRemoveFile, handleAttachPhoto, handleRemovePhoto, getPaginationInfo, downloadMergedPDF,
      startResizing, stopResizing, resize, handleReset, handleChange,
      handleTitleChange, handleStyleChange, moveBlockUp, moveBlockDown, toggleBlockWidth, saveDossier, saveDossierAs, loadDossier,
      deleteDossier, generatePDF, getSortedBlocks, addRef, updateRef, removeRef,
      addOcc, updateOcc, removeOcc, sortOccupantsByFloor, addExpense, updateExpense,
      removeExpense, reorganizeExpenses, processJsonData, handleJsonImport,
      handlePasteImport, copyPrompt, exportGlobalData
  };

  return (
      <ExpertiseContext.Provider value={contextValue}>
          {children}
      </ExpertiseContext.Provider>
  );
};
