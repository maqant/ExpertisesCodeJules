import { useFinanceStore, cleanAmount } from "../store/financeStore";
import React, { createContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { normalizeAiData, referenceKey } from '../domain/aiDataSchema';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import localforage from 'localforage';
import { processIngestedFile } from '../services/utils/filePreprocessor.js';
import { msgToSinglePagePdf } from '../services/utils/msgToPdf.js';
import html2canvas from 'html2canvas';
import { useTelemetry, exportTelemetryJson, clearTelemetryLogs } from "../hooks/useTelemetry";
import { sanitizeAiConfig } from "../ai/ai.config.js";
import { useDossiersStore } from '../hooks/useDossiersStore';
import { ConflictError } from '../services/storage/dossierStorage';
import ConflictModal from '../components/shared/ConflictModal';
import { subscribeToDossierUpdates } from '../services/utils/tabSync';
import { acquireLock, startHeartbeat, releaseLock, readLock, isLockStale } from '../services/utils/tabLock';
import DossierLockModal from '../components/validation/DossierLockModal';
import { applyValidatedMerge } from '../domain/merge/conservativeMerge.js';
import { removeBlobs } from '../services/attachmentStorage';
import { attachmentRegistry } from '../services/attachmentRegistry';

// v5.4.0 Magic Drop: Fuzzy file name matching utility
// Tries multiple strategies: exact → case-insensitive → without extension → includes
const findMatchingFile = (pendingFiles, sourceFileName) => {
    if (!sourceFileName || !pendingFiles || pendingFiles.length === 0) return null;
    const needle = sourceFileName.trim();
    if (!needle) return null;

    // 1. Exact match
    const exact = pendingFiles.find(f => f.name === needle);
    if (exact) return exact;

    // 2. Case-insensitive match
    const needleLower = needle.toLowerCase();
    const caseInsensitive = pendingFiles.find(f => f.name.toLowerCase() === needleLower);
    if (caseInsensitive) return caseInsensitive;

    // 3. Strip extension from both sides and compare
    const stripExt = (name) => name.replace(/\.[^.]+$/, '').toLowerCase().trim();
    const needleNoExt = stripExt(needle);
    const withoutExt = pendingFiles.find(f => stripExt(f.name) === needleNoExt);
    if (withoutExt) return withoutExt;

    // 4. Inclusion match (one contains the other)
    const includes = pendingFiles.find(f => {
        const fLower = f.name.toLowerCase();
        return fLower.includes(needleLower) || needleLower.includes(fLower);
    });
    if (includes) return includes;

    return null;
};

export const ExpertiseContext = createContext();

const initialFormData = {
  dateExp: '', heureExp: '', refPechard: '', nomResidence: '',
  adresse: '', franchise: '', pertesIndirectes: '', expertInfos: '', bureau: '',
  dateSinistre: '', dateDeclaration: '', declarant: '', 
  isContradictoire: false, cieContradictoire: '', bureauContradictoire: '', expertContradictoire: '', compteDeContradictoire: '',
  nomCie: '', nomContrat: '', numPolice: '', numSinistreCie: '', numConditionsGenerales: '',
  cause: "", divers: "", compteRendu: ""
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

  const [telemetrySessionId, setTelemetrySessionId] = useState(() => crypto.randomUUID());
  const [currentDossierId, setCurrentDossierId] = useState(null);
  const [currentVersion, _setCurrentVersion] = useState(0);
  const currentVersionRef = useRef(0);
  const setCurrentVersion = useCallback((v) => {
      currentVersionRef.current = v;
      _setCurrentVersion(v);
  }, []);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictActionDossier, setConflictActionDossier] = useState(null);
  const telemetry = useTelemetry(telemetrySessionId, currentDossierId);

  const [activeTab, setActiveTab] = useState('builder');
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Interface
  const [sidebarWidth, setSidebarWidth] = useState(450);
  const [isResizing, setIsResizing] = useState(false);
  const [uiZoom, setUiZoom] = useState(1);
  const [fitBlocks, setFitBlocks] = useState({});
  const [pastedJson, setPastedJson] = useState("");
  const [orgaAdvancedMode, setOrgaAdvancedMode] = useState(false);

  // Pending AI data — "sas" de validation avant import
  const [pendingAiData, setPendingAiData] = useState(null);
  // v6.1.0 - Bridge Files : persisté dans le contexte pour survivre aux re-renders de la Sidebar
  const [bridgeFiles, setBridgeFiles] = useState([]);
  // v6.3.2 - Global Assistant Files : séparé du Smart Bridge
  const [globalAssistantFiles, setGlobalAssistantFiles] = useState([]);

  // Paramètres additionnels
  const [showSubtotals, setShowSubtotals] = useState(false);
  const [causeTimeline, setCauseTimeline] = useState([]);

  // v6.2.0 - Debug Logs System
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);

  const addDebugLog = (step, status, data = null, error = null) => {
      setDebugLogs(prevLogs => [...prevLogs, {
          id: Date.now() + Math.random(),
          time: new Date().toLocaleTimeString(),
          step,    // ex: "ROUTEUR", "AGENT_ADMIN", "UPLOAD"
          status,  // 'INFO', 'SUCCESS', 'ERROR', 'WARNING'
          data,    // Le JSON ou le texte retourné
          error    // L'erreur éventuelle
      }]);
  };

  const toggleDebugMode = () => setIsDebugMode(prev => !prev);
  const clearDebugLogs = () => setDebugLogs([]);

  // v6.3.3 - Historique des Logs
  const [logHistory, setLogHistory] = useState([]);
  const [lockStatus, setLockStatus] = useState('idle');
  const [lockInfo, setLockInfo] = useState(null);
  const heartbeatCleanerRef = useRef(null);

  useEffect(() => {
      return () => {
          if (heartbeatCleanerRef.current) heartbeatCleanerRef.current();
      };
  }, []);

  // Écoute des mises à jour inter-onglets (pour avertir l'utilisateur)
  useEffect(() => {
      if (!currentDossierId) return;
      const unsubscribe = subscribeToDossierUpdates(({payload, sourceTabId, isOwnEcho}) => {
          if (isOwnEcho) {
              console.info("[tabSync] Ignored own echo update");
              return;
          }
          if (payload.id === currentDossierId && payload.version > currentVersion) {
              alert("⚠️ AVERTISSEMENT : Ce dossier vient d'être modifié dans un autre onglet. Si vous sauvegardez ici, vous ferez face à un conflit.");
          }
      });
      return unsubscribe;
  }, [currentDossierId, currentVersion]);

  useEffect(() => {
    import('localforage').then(localforage => {
        localforage.default.getItem('expertise_log_history').then(data => {
          if (data) setLogHistory(data);
        });
    });
  }, []);

  const commitLogSession = () => {
    setDebugLogs(currentLogs => {
      if (currentLogs.length === 0) return currentLogs;
      
      const newSession = {
        id: crypto.randomUUID(),
        date: new Date().toLocaleString(),
        logs: currentLogs
      };

      setLogHistory(prev => {
        const next = [newSession, ...prev].slice(0, 50); // Garder les 50 dernières sessions
        import('localforage').then(localforage => {
            localforage.default.setItem('expertise_log_history', next).catch(console.error);
        });
        return next;
      });
      
      return currentLogs;
    });
  };

  const clearLogHistory = () => {
    setLogHistory([]);
    import('localforage').then(localforage => {
        localforage.default.removeItem('expertise_log_history');
    });
  };

  // AI Mode Config
  const [isAiModeActive, setIsAiModeActive] = useState(() => localStorage.getItem('isAiModeActive') === 'true');
  const [aiConfig, setAiConfig] = useState(() => {
      const stored = localStorage.getItem('expertise_aiConfig_v3');
      if (stored) {
          try {
              return sanitizeAiConfig(JSON.parse(stored));
          } catch (e) {
              console.warn("Erreur lecture aiConfig, reset aux défauts.");
          }
      } else {
          // Migration from old flat config
          const oldApiKey = localStorage.getItem('aiApiKey');
          const oldModel = localStorage.getItem('aiModel');
          const oldProvider = localStorage.getItem('aiProvider');
          if (oldApiKey || oldModel) {
              return sanitizeAiConfig({ apiKey: oldApiKey, model: oldModel, provider: oldProvider });
          }
      }
      return sanitizeAiConfig({});
  });

  const toggleAiMode = () => {
      setIsAiModeActive(prev => {
          const next = !prev;
          localStorage.setItem('isAiModeActive', next);
          return next;
      });
  };

  const [isDeepThinkingMode, setIsDeepThinkingMode] = useState(false);
  const toggleDeepThinkingMode = () => setIsDeepThinkingMode(prev => !prev);


  const updateAiConfig = (newConfigPartial) => {
      setAiConfig(prev => {
          const rawNext = { ...prev };
          // Deep merge pour ne pas écraser partials
          if (newConfigPartial.apiKey !== undefined) rawNext.apiKey = newConfigPartial.apiKey;
          if (newConfigPartial.provider !== undefined) rawNext.provider = newConfigPartial.provider;
          if (newConfigPartial.parameters) {
              rawNext.parameters = { ...rawNext.parameters, ...newConfigPartial.parameters };
          }
          if (newConfigPartial.roles) {
              rawNext.roles = { ...rawNext.roles, ...newConfigPartial.roles };
          }
          if (newConfigPartial.processOverrides !== undefined) {
              // Si null est passé explicitement on veut écraser (pour le reset) ou on merge
              rawNext.processOverrides = newConfigPartial.processOverrides === null 
                  ? {} 
                  : { ...rawNext.processOverrides, ...newConfigPartial.processOverrides };
          }
          
          const next = sanitizeAiConfig(rawNext);
          localStorage.setItem('expertise_aiConfig_v3', JSON.stringify(next));
          
          // Compatibilité legacy (à supprimer plus tard si besoin)
          localStorage.setItem('aiApiKey', next.apiKey);
          localStorage.setItem('aiModel', next.roles.extraction); 
          
          return next;
      });
  };

  const setProcessOverride = (processId, modelId) => {
      updateAiConfig({
          processOverrides: { [processId]: modelId },
      });
  };

  const clearProcessOverride = (processId) => {
      setAiConfig(prev => {
          const rawNext = { ...prev };
          if (rawNext.processOverrides) {
              const nextOverrides = { ...rawNext.processOverrides };
              delete nextOverrides[processId];
              rawNext.processOverrides = nextOverrides;
          }
          const next = sanitizeAiConfig(rawNext);
          localStorage.setItem('expertise_aiConfig_v3', JSON.stringify(next));
          return next;
      });
  };

  const [hideAnnexIndex, setHideAnnexIndex] = useState(false);

  // Ingestion Modal State
  const [ingestionModal, setIngestionModal] = useState({ isOpen: false, type: null, file: null, data: null, existingId: null });
  const openIngestion = async (file, type, initialData = null, existingId = null) => {
      const processedFile = await processIngestedFile(file);
      setIngestionModal({ isOpen: true, type, file: processedFile, data: initialData, existingId });
  };
  const closeIngestion = () => {
      setIngestionModal({ isOpen: false, type: null, file: null, data: null, existingId: null });
  };
  const [printSelection, setPrintSelection] = useState(null); // null = tout inclus, Set<string> = sélection
  const [coverPageCount, setCoverPageCount] = useState(1); // nb de pages de la page de garde (pour indexation correcte)
  const [expandedOccId, setExpandedOccId] = useState(null);
  const [expandedExpId, setExpandedExpId] = useState(null);

  // Données globales
  const { savedDossiers, setSavedDossiersGlobal: setSavedDossiers, persistDossier, deleteDossierGlobal, isLoaded } = useDossiersStore();
  const [dossierSearch, setDossierSearch] = useState('');
  const [expertsList, setExpertsList] = useState([]);
  const [franchises, setFranchises] = useState([]);
  // v5.6.0 - Liste des intervenants externes (plombiers, syndics, courtiers, etc.)
  const [intervenantsList, setIntervenantsList] = useState([]);
  // v5.9.4 - AI Status global pour la barre de progression
  const [aiStatus, setAiStatus] = useState('idle');
  // v6.0.0 - Context Vault : mémoire des textes bruts ingérés
  const [rawContexts, setRawContexts] = useState([]);
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

      // L'initialisation est gérée par useDossiersStore
  }, []);

  useEffect(() => {
      localStorage.setItem('expertise_experts_v2', JSON.stringify(expertsList));
      localStorage.setItem('expertise_franchises_v2', JSON.stringify(franchises));
  }, [expertsList, franchises]);

  const performReset = () => {
      setTelemetrySessionId(crypto.randomUUID());
      financeStore.replaceFormData(initialFormData); setBlockTitles(initialTitles); setReferences([]); setOccupants([]); setExpenses([]); 
      setBlocksVisible(initialVisibility); setCustomBlocks([]); setBlockOrder(initialBlockOrder); setBlockWidths(initialBlockWidths); 
      setStyles(initialStyles); setShowSubtotals(false); setFitBlocks({}); setPastedJson('');
      setAttachedFiles({}); setAttachedPhotos({}); setAttachedFreeAnnexes([]); setCurrentDossierId(null);
      setCauseTimeline([]);
      setIntervenantsList([]);
      setRawContexts([]); // v6.0.0 - Context Vault
  };

  const handleReset = () => {
      if(!window.confirm("⚠️ Voulez-vous vraiment effacer tout le contenu de ce document ?")) return;
      performReset();
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

  // v7.0.0 - Fix étanchéité structurel :
  // performReset() vide le store Zustand de manière synchrone.
  // On utilise ensuite directement financeStore.replaceFormData() (Zustand = synchrone)
  // au lieu de setFormData(prev => ...) qui aurait capturé un `prev` React encore stale.
  const handleNewDossier = () => {
      const name = window.prompt("Nom du nouveau dossier ?");
      if (!name) return false;
      
      // performReset vide tout (Zustand synchrone + React state)
      performReset();
      // On écrit directement dans Zustand APRÈS le reset → garanti propre
      useFinanceStore.getState().replaceFormData({ ...initialFormData, refPechard: name });
      
      const newId = crypto.randomUUID();
      const newDossier = { id: newId, name, date: new Date().toLocaleString('fr-FR'), data: { formData: { ...initialFormData, refPechard: name }, blockTitles: initialTitles } };
      const updated = [newDossier, ...savedDossiers];
      
      setSavedDossiers(updated);
      setCurrentDossierId(newId);
      return true;
  };

  const saveDossier = async () => {
      if (lockStatus === 'readonly' || lockStatus === 'blocked') {
          alert("Mode lecture seule actif. Vous ne pouvez pas sauvegarder ce dossier.");
          return;
      }
      let name = formData.refPechard || formData.nomResidence || `Expertise_${new Date().toLocaleDateString()}`;
      if (!currentDossierId) {
          name = window.prompt("Nom de ce dossier (ex: Nom, Ref) ?", name);
          if (!name) return;
      }
      
      const dossierData = { formData, blockTitles, references, occupants, expenses, blocksVisible, styles, blockOrder, blockWidths, customBlocks, showSubtotals, fitBlocks, attachedFiles, attachedPhotos, attachedFreeAnnexes, causeTimeline, intervenantsList, rawContexts };
      
      const dateStr = new Date().toLocaleString('fr-FR');
      let targetDossier;
      let newIdToSet = null;
      
      if (currentDossierId) {
          targetDossier = { id: currentDossierId, name, date: dateStr, data: dossierData };
      } else {
          const newId = crypto.randomUUID();
          targetDossier = { id: newId, name, date: dateStr, data: dossierData };
          newIdToSet = newId;
      }
      
      try {
          const { version } = await persistDossier(targetDossier, currentVersionRef.current);
          setCurrentVersion(version);
          targetDossier.version = version;
          
          let updated;
          if (currentDossierId) {
              updated = savedDossiers.map(d => d.id === targetDossier.id ? targetDossier : d);
          } else {
              updated = [targetDossier, ...savedDossiers];
              setCurrentDossierId(newIdToSet);
          }
          
          setSavedDossiers(updated);
          alert("✅ Dossier sauvegardé !");
      } catch (err) {
          if (err.name === 'ConflictError') {
              setConflictActionDossier(targetDossier);
              setShowConflictModal(true);
          } else {
              alert("❌ Erreur critique lors de la sauvegarde. Vos données n'ont pas été enregistrées. (" + err.message + ")");
          }
      }
  };

  const saveDossierAs = async () => {
      const name = window.prompt("Nom de la copie de ce dossier ?", (formData.refPechard || formData.nomResidence || `Expertise_${new Date().toLocaleDateString()}`) + " (Copie)");
      if (!name) return;
      
      const dossierData = { formData, blockTitles, references, occupants, expenses, blocksVisible, styles, blockOrder, blockWidths, customBlocks, showSubtotals, fitBlocks, attachedFiles, attachedPhotos, attachedFreeAnnexes, causeTimeline, intervenantsList, rawContexts };
      const newId = crypto.randomUUID();
      const newDossier = { id: newId, name, date: new Date().toLocaleString('fr-FR'), data: dossierData };
      
      try {
          const { version } = await persistDossier(newDossier, 0); // New dossier = expected version 0
          setCurrentVersion(version);
          newDossier.version = version;
          const updated = [newDossier, ...savedDossiers];
          setSavedDossiers(updated);
          setCurrentDossierId(newId);
          alert("✅ Copie du dossier sauvegardée !");
      } catch (err) {
          alert("❌ Erreur critique lors de la sauvegarde de la copie. (" + err.message + ")");
      }
  };

  const loadDossier = async (dossier) => {
      if (heartbeatCleanerRef.current) {
          heartbeatCleanerRef.current();
          heartbeatCleanerRef.current = null;
      }
      setLockStatus('idle');
      
      const lockAcquired = await acquireLock(dossier.id);
      if (!lockAcquired) {
          const info = readLock(dossier.id);
          setLockInfo(info);
          setLockStatus('blocked');
      } else {
          setLockStatus('owner');
          heartbeatCleanerRef.current = startHeartbeat(dossier.id);
      }

      setTelemetrySessionId(crypto.randomUUID());
      setCurrentVersion(dossier.version || 0);
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
      if(d.causeTimeline) setCauseTimeline(d.causeTimeline); else setCauseTimeline([]);
      if(d.intervenantsList) setIntervenantsList(d.intervenantsList); else setIntervenantsList([]);
      if(d.rawContexts) setRawContexts(d.rawContexts); else setRawContexts([]); // v6.0.0 - Context Vault
      setCurrentDossierId(dossier.id);
      setActiveTab('builder');
  };

  const deleteDossier = (id) => {
      if(!window.confirm("Voulez-vous vraiment supprimer ce dossier définitivement ?")) return;
      deleteDossierGlobal(id);
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
      const statusOrder = { "Propriétaire occupant": 1, "Propriétaire non occupant": 2, "Propriétaire (occupation inconnue)": 3, "ACP": 4, "Locataire": 5 };
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
          const valA = cleanAmount(a.montantReclame || a.montant || '0');
          const valB = cleanAmount(b.montantReclame || b.montant || '0');
          return valA - valB;
      });
      financeStore.setExpenses(sorted);
  };

  const handleAttachFile = async (expenseId, rawFile, expenseType = null) => {
      if (!rawFile) return;
      
      // v7.17.4 - Idempotence pour éviter les doublons sur double-drop
      setAttachedFiles(prev => {
          const currentList = prev[expenseId] || [];
          const alreadyExists = currentList.find(f => f.name === rawFile.name && f.originalSize === rawFile.size);
          if (alreadyExists) {
              console.warn(`[ExpertiseContext] Fichier ${rawFile.name} déjà attaché à ${expenseId}.`);
              // On jette une erreur silencieuse attrapée plus loin ?
              // Pour simplifier, on utilise une propriété sur le fichier pour stopper.
          }
          return prev; // state read only, but we use an early return via a check outside.
      });

      const currentList = attachedFiles[expenseId] || [];
      const alreadyExists = currentList.find(f => f.name === (rawFile.name + (rawFile.name.toLowerCase().endsWith('.msg') ? '.pdf' : '')) && f.originalSize === rawFile.size);
      if (alreadyExists) return;

      const file = await processIngestedFile(rawFile);
      const dbKey = `file_${crypto.randomUUID()}_${file.name}`;
      
      try {
          let arrayBuffer = await file.arrayBuffer();
          let pages = 1; // Default for images
          let isPdf = false;
          let finalFileName = file.name;
          let finalType = file.type;

          if (finalFileName.toLowerCase().endsWith('.msg')) {
              try {
                  const pdfBytes = await msgToSinglePagePdf(arrayBuffer);
                  arrayBuffer = pdfBytes.buffer || pdfBytes; // Uint8Array -> ArrayBuffer
                  isPdf = true;
                  pages = 1;
                  finalFileName = finalFileName + '.pdf';
                  finalType = 'application/pdf';
              } catch (e) {
                  console.error("Error converting MSG to PDF:", e);
                  return alert("Erreur lors de la conversion du fichier MSG : " + e.message);
              }
          } else if (finalType === 'application/pdf') {
              isPdf = true;
              try {
                  const pdfDoc = await PDFDocument.load(arrayBuffer);
                  pages = pdfDoc.getPageCount();
              } catch (e) {
                  console.error("Non-fatal error reading PDF pages:", e);
                  pages = 1;
              }
          } else if (!finalType.startsWith('image/')) {
              return alert("Seuls les fichiers PDF, MSG et les images sont acceptés pour le moment.");
          }

          await localforage.setItem(dbKey, arrayBuffer);
          
          const fileObj = { name: finalFileName, pages, dbKey, isPdf, type: finalType, expenseType, originalSize: rawFile.size };
          setAttachedFiles(prev => {
              const current = prev[expenseId] || [];
              return { ...prev, [expenseId]: [...current, fileObj] };
          });
      } catch (err) {
          alert("Erreur lors de la lecture du fichier : " + err.message);
      }
  };

  const deleteAttachment = async (type, payload = {}) => {
      const descriptor = attachmentRegistry[type];
      if (!descriptor) {
          console.error(`[deleteAttachment] Type inconnu: "${type}"`);
          return { ok: false, error: 'Type inconnu' };
      }

      const currentState = { attachedFiles, attachedPhotos, attachedFreeAnnexes, causeTimeline, intervenantsList };
      const dbKeys = descriptor.extractKeys(currentState, payload);

      const { ok, failedKeys } = await removeBlobs(dbKeys);
      if (!ok) {
          console.error("[deleteAttachment] Erreur lors de la suppression DB :", failedKeys);
          return { ok: false, error: 'Erreur de suppression base de données.' };
      }

      const stateUpdates = descriptor.removeFromState(currentState, payload);
      if (stateUpdates.attachedFiles) setAttachedFiles(stateUpdates.attachedFiles);
      if (stateUpdates.attachedPhotos) setAttachedPhotos(stateUpdates.attachedPhotos);
      if (stateUpdates.attachedFreeAnnexes) setAttachedFreeAnnexes(stateUpdates.attachedFreeAnnexes);
      if (stateUpdates.causeTimeline) setCauseTimeline(stateUpdates.causeTimeline);
      if (stateUpdates.intervenantsList) setIntervenantsList(stateUpdates.intervenantsList);

      return { ok: true };
  };

  const handleAttachPhoto = async (occupantId, rawFile) => {
      if (!rawFile) return;
      const file = await processIngestedFile(rawFile);
      const isPdf = file.type === 'application/pdf';
      const isImage = file.type.startsWith('image/');
      if (!isPdf && !isImage) return alert('Seuls les images (JPG, PNG) et les PDF sont acceptés.');

      try {
          const arrayBuffer = await file.arrayBuffer();
          const dbKey = `photo_${crypto.randomUUID()}_${file.name}`;
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


  const handleAttachFreeAnnex = async (rawFile, generatedTitle = null, desc = '') => {
      if (!rawFile) return;
      const file = await processIngestedFile(rawFile);
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


  const isExpenseExcludedFromMain = (exp) => {
      if (exp.avisCouverture === 'Non') return true;
      const matchedOcc = occupants.find(o => o.id === exp.compteDe);
      if (matchedOcc && matchedOcc.contreExpert) return true;
      return false;
  };

  const dynamicFreeAnnexes = useMemo(() => {
      let annexes = [...attachedFreeAnnexes];
      
      expenses.forEach(exp => {
          const files = attachedFiles[exp.id] || [];
          const inactive = files.filter(f => f.expenseType && f.expenseType !== exp.type);
          
          if (inactive.length > 0) {
              const mainExpIndex = expenses.filter(e => !isExpenseExcludedFromMain(e)).findIndex(e => e.id === exp.id);
              const expIndexText = mainExpIndex !== -1 ? ` #${mainExpIndex + 1}` : ` (Exclue)`;

              inactive.forEach(f => {
                  annexes.push({
                      id: `inactive_${exp.id}_${f.dbKey}`,
                      dbKey: f.dbKey,
                      name: f.name,
                      customName: `${f.expenseType} relatif à la ligne de frais${expIndexText} (${exp.prestataire || 'Frais'})`,
                      desc: 'Document conservé pour historique',
                      isPdf: f.isPdf,
                      pages: f.pages,
                      isVirtual: true
                  });
              });
          }
      });
      return annexes;
  }, [attachedFreeAnnexes, expenses, attachedFiles, occupants]);

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

      expenses.forEach(exp => {
          const files = attachedFiles[exp.id] || [];
          const activeFiles = files.filter(f => !f.expenseType || f.expenseType === exp.type);
          processDoc(exp.id, exp.prestataire || 'Frais', activeFiles);
      });
      processDoc('doc_pv_police', 'PV de Police', attachedFiles['doc_pv_police']);
      processDoc('doc_cond_part', 'Conditions particulières', attachedFiles['doc_cond_part']);
      processDoc('doc_cond_gen', 'Conditions générales', attachedFiles['doc_cond_gen']);

      dynamicFreeAnnexes.forEach(file => {
          if (!sel || sel.has(`free::${file.id}`)) {
              if (file.pages > 0) {
                  masterIndex.push({ id: file.id, label: file.customName || file.name, annexeIndex, startPage: currentPage, endPage: currentPage + file.pages - 1 });
                  currentPage += file.pages;
                  annexeIndex++;
              }
          }
      });

      return masterIndex;
  }, [attachedFiles, attachedPhotos, attachedFreeAnnexes, occupants, expenses, printSelection, dynamicFreeAnnexes]);

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
      for (const exp of expenses) {
          const files = attachedFiles[exp.id] || [];
          const activeFiles = files.filter(f => !f.expenseType || f.expenseType === exp.type);
          addEntry(exp.id, exp.prestataire || 'Frais', activeFiles);
      }
      addEntry('doc_pv_police', 'PV de Police', attachedFiles['doc_pv_police']);
      addEntry('doc_cond_part', 'Conditions particulières', attachedFiles['doc_cond_part']);
      addEntry('doc_cond_gen', 'Conditions générales', attachedFiles['doc_cond_gen']);

      dynamicFreeAnnexes.forEach(f => list.push({ id: f.id, label: f.customName || f.name, file: f, isFree: true }));

      return list;
  };

  const downloadSelectedPDF = async (selectedKeys) => {
      // selectedKeys: Set of "id::dbKey" strings (or "id" for photos groups)
      setIsMerging(true);
      try {
          const mergedPdf = await PDFDocument.create();
          const font = await mergedPdf.embedFont(StandardFonts.HelveticaBold);

          const appendDoc = async (file) => {
              try {
                  const bytes = await localforage.getItem(file.dbKey);
                  if (!bytes) return;
                  if (file.isPdf) {
                      const pdf = await PDFDocument.load(bytes);
                      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                      copiedPages.forEach((page) => mergedPdf.addPage(page));
                  } else {
                      let img;
                      const isPng = file.dbKey.toLowerCase().includes('png') || (file.name && file.name.toLowerCase().endsWith('.png'));
                      if (isPng) {
                          img = await mergedPdf.embedPng(bytes);
                      } else {
                          img = await mergedPdf.embedJpg(bytes);
                      }
                      const imgDims = img.scale(1);
                      const A4W = 595.28, A4H = 841.89;
                      let scale = Math.min(A4W / imgDims.width, A4H / imgDims.height);
                      if (scale > 1) scale = 1;
                      const drawnW = imgDims.width * scale;
                      const drawnH = imgDims.height * scale;
                      const page = mergedPdf.addPage([A4W, A4H]);
                      page.drawImage(img, { x: (A4W - drawnW) / 2, y: A4H - drawnH, width: drawnW, height: drawnH });
                  }
              } catch (e) {
                  console.error("Failed to append document", file.dbKey, e);
              }
          };

          const appendPdfFiles = async (id, onlyActiveForExpType = null) => {
              let files = attachedFiles[id];
              if (!files) return;
              if (!Array.isArray(files)) files = [files];
              
              if (onlyActiveForExpType) {
                  files = files.filter(f => !f.expenseType || f.expenseType === onlyActiveForExpType);
              }

              for (const f of files) {
                  const key = `${id}::${f.dbKey}`;
                  if (selectedKeys.has(key)) await appendDoc(f);
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
                          const occName = `${occ.nom || 'Inconnu'} ${occ.prenom || ''}`.trim();
                          const occEtage = occ.etage ? ` - ${occ.etage}` : '';
                          page.drawText(`Espace / Partie : ${occName}${occEtage}`, { x: 50, y: height - 50, size: 16, font });
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
                      await appendDoc(pdfItem);
                  }
              }
          }

          for (const exp of expenses) {
              await appendPdfFiles(exp.id, exp.type);
          }

          await appendPdfFiles('doc_pv_police');
          await appendPdfFiles('doc_cond_part');
          await appendPdfFiles('doc_cond_gen');

          // --- Annexes Libres ---
          for (const file of dynamicFreeAnnexes) {
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

          // Helper de capture via un clone off-screen
          const captureElOffScreen = async () => {
              // Créer un host container pour isoler le rendu du layout écran
              const host = document.createElement('div');
              host.style.position = 'fixed';
              host.style.top = '0';
              host.style.left = '-9999px'; // Hors de vue
              host.style.width = '794px'; // Largeur absolue (210mm @ 96dpi)
              host.style.background = '#ffffff';
              host.style.zIndex = '-9999';

              // Cloner l'élément #a4-page actuel
              const clone = el.cloneNode(true);
              host.appendChild(clone);
              document.body.appendChild(host);

              // Laisser le navigateur appliquer le reflow
              await new Promise(resolve => requestAnimationFrame(resolve));

              try {
                  const canvas = await html2canvas(clone, {
                      scale: 2,
                      useCORS: true,
                      allowTaint: true,
                      backgroundColor: '#ffffff',
                      logging: false,
                      width: 794,
                      windowWidth: 794,
                      ignoreElements: (node) => {
                          if (!node.classList) return false;
                          return node.classList.contains('block-controls') ||
                                 node.classList.contains('print:hidden') ||
                                 node.classList.contains('no-print') ||
                                 node.getAttribute?.('data-html2canvas-ignore') === 'true';
                      }
                  });
                  return canvas;
              } finally {
                  // Nettoyage critique du clone hors-écran
                  if (host.parentNode) {
                      host.parentNode.removeChild(host);
                  }
              }
          };

          // --- PASSE 1 : capture avec coverPageCount = 1 (valeur actuelle) ---
          // → mesure la hauteur réelle du canvas pour déterminer le nb de pages de la page de garde
          const canvas1 = await captureElOffScreen();
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

              canvas = await captureElOffScreen(); // Nouvelle capture avec les bons numéros affichés !
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

          const appendPdfFiles = async (id, onlyActiveForExpType = null) => {
              let files = attachedFiles[id];
              if (!files) return;
              if (!Array.isArray(files)) files = [files];
              
              if (onlyActiveForExpType) {
                  files = files.filter(f => !f.expenseType || f.expenseType === onlyActiveForExpType);
              }

              for (const f of files) {
                  if (!selectedKeys || selectedKeys.has(`${id}::${f.dbKey}`)) {
                      await appendDoc(f);
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
                          const occName = `${occ.nom || 'Inconnu'} ${occ.prenom || ''}`.trim();
                          const occEtage = occ.etage ? ` - ${occ.etage}` : '';
                          page.drawText(`Espace / Partie : ${occName}${occEtage}`, { x: 50, y: height - 50, size: 16, font });
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

          for (const exp of expenses) await appendPdfFiles(exp.id, exp.type);
          await appendPdfFiles('doc_pv_police');
          await appendPdfFiles('doc_cond_part');
          await appendPdfFiles('doc_cond_gen');

          // 3.5 Annexes Libres
          for (const file of dynamicFreeAnnexes) {
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
    // 1. Extraction blindée du JSON (ignore le texte avant et après)
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error("Aucun format de données valide trouvé par l'IA.");
    }
    
    let cleanedText = rawText.substring(firstBrace, lastBrace + 1);
    cleanedText = cleanedText.replace(/\\\[/g, '[').replace(/\\\]/g, ']');
    const data = JSON.parse(cleanedText);

    // 2. Fusion sécurisée (Dossiers, Franchises, FormData)
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
      const safeFranchises = data.franchises.map(f => 
        typeof f === 'object' && f !== null ? Object.values(f).join('-') : String(f)
      );
      setFranchises(prev => Array.from(new Set([...prev, ...safeFranchises])));
    }

    if (data.formData) setFormData(prev => ({ ...prev, ...data.formData }));

    // 3. ANTI-DOUBLONS: Occupants
    if (data.occupants && Array.isArray(data.occupants)) {
      const existingNames = occupants.map(o => (o.nom || "").trim().toLowerCase());
      const newOccupants = data.occupants.reduce((acc, o) => {
        const occName = (o.nom || "").trim().toLowerCase();
        if (occName && !existingNames.includes(occName)) {
          acc.push({...o, id: crypto.randomUUID()});
          existingNames.push(occName); // Empêche les doublons au sein même du JSON
        }
        return acc;
      }, []);
      if (newOccupants.length > 0) financeStore.setOccupants([...occupants, ...newOccupants]);
    }

    // 4. ANTI-DOUBLONS: Frais (Vérifie prestataire + montant)
    if (data.expenses && Array.isArray(data.expenses)) {
      const newExpenses = [];
      data.expenses.forEach(ex => {
        const isDuplicate = expenses.some(existing => 
          existing.prestataire?.toLowerCase() === ex.prestataire?.toLowerCase() &&
          (existing.montantReclame === ex.montant || existing.montant === ex.montant)
        );
        if (!isDuplicate && (ex.prestataire || ex.montant)) {
          newExpenses.push({
            ...ex, 
            id: crypto.randomUUID(), 
            montantReclame: ex.montant, 
            montantValide: ex.montant
          });
        }
      });
      if (newExpenses.length > 0) financeStore.setExpenses([...expenses, ...newExpenses]);
    }

    alert("✅ Données IA importées avec succès !");
    setPastedJson("");
    setActiveTab('builder');

  } catch (error) {
    console.error("Erreur brute de l'IA:", rawText);
    alert("❌ Erreur de lecture: Vérifiez que l'IA a bien généré les données. (Détail: " + error.message + ")");
  }
};

  // Fonction appelée par GlobalValidationModal pour appliquer les données sélectionnées
  // v5.4.0: dataOverride permet de passer les données fusionnées directement (bypass du state async React)
  const commitPendingAiData = async (selections, dataOverride = null) => {
      const data = dataOverride || pendingAiData;
      if (!data) return;

      // Capture pendingFiles AVANT de modifier le state
      const pendingFiles = data.pendingFiles || [];

      // 1. FormData — écraser seulement les champs cochés en utilisant la logique métier
      if (selections.formFields && selections.formFields.length > 0 && data.formData) {
          const { next, applied, ignored } = applyValidatedMerge(formData, data.formData, selections.formFields);
          
          if (ignored && ignored.length > 0) {
              console.warn(`[commitPendingAiData] Champs de formulaire ignorés:`, ignored);
          }

          const updates = {};
          applied.forEach(key => updates[key] = next[key]);

          // v5.6.4 - Auto-fill refPechard : si l'IA renvoie vide, utiliser le nom du dossier courant
          if (!updates.refPechard && !formData.refPechard) {
              const currentDossier = savedDossiers.find(d => d.id === currentDossierId);
              if (currentDossier?.name) {
                  updates.refPechard = currentDossier.name;
              }
          }
          if (Object.keys(updates).length > 0) {
              setFormData(prev => ({ ...prev, ...updates }));
          }
      }

      // 2. Occupants — ajouter ou mettre à jour
      const idMapping = {}; // Keeps track of new IDs mapped from temporary AI IDs
      if (selections.occupants && selections.occupants.length > 0) {
          selections.occupants.forEach(sel => {
              const aiOcc = data.occupants.find(o => o.id === sel.id);
              if (!aiOcc) return;

              if (sel.action === 'update' && sel.existingId) {
                  const existingOcc = occupants.find(o => o.id === sel.existingId);
                  if (existingOcc) {
                      const updates = {};
                      Object.keys(aiOcc).forEach(key => {
                          if (key === 'id') return;
                          if (aiOcc[key] && aiOcc[key] !== '' && aiOcc[key] !== existingOcc[key]) {
                              updates[key] = aiOcc[key];
                          }
                      });
                      if (Object.keys(updates).length > 0) {
                          financeStore.updateOccupant(sel.existingId, updates);
                      }
                  }
                  idMapping[aiOcc.id] = sel.existingId;
              } else {
                  const newOccId = crypto.randomUUID();
                  idMapping[aiOcc.id] = newOccId;
                  financeStore.addOccupant({ ...aiOcc, id: newOccId });
              }
          });
      }

      // 2.5 Responsables (v7.13.0)
      if (selections.responsablesIds && selections.responsablesIds.length > 0) {
          const finalRespIds = selections.responsablesIds.map(id => idMapping[id] || id);
          // On ajoute les nouveaux responsables aux responsables existants (au cas où il y en a d'autres non présents dans l'import IA)
          const currentRespIds = financeStore.metier?.responsablesIds || [];
          const mergedRespIds = Array.from(new Set([...currentRespIds, ...finalRespIds]));
          financeStore.setResponsables(mergedRespIds);
      }

      // 3. Expenses — ajouter + Magic Drop auto-attach (séquentiel, pas de setTimeout)
      if (selections.expenses && selections.expenses.length > 0) {
          for (const expId of selections.expenses) {
              const aiExp = data.expenses.find(e => e.id === expId);
              if (!aiExp) continue;

              const newId = crypto.randomUUID();
              let compteDeFinal = aiExp.compteDe || 'unassigned';
              if (idMapping[compteDeFinal]) {
                  compteDeFinal = idMapping[compteDeFinal];
              }

              financeStore.addExpense({
                  ...aiExp,
                  id: newId,
                  montant: aiExp.montant || aiExp.montantReclame || '',
                  montantReclame: aiExp.montant || aiExp.montantReclame || '',
                  montantValide: aiExp.montant || aiExp.montantReclame || '',
                  compteDe: compteDeFinal
              });

              // v5.4.0 Magic Drop: auto-attach file via fuzzy matching
              // v8.0.0: Support de la fusion Devis/Facture (sourceFileNames)
              const filesToAttach = [];
              if (aiExp.sourceFileName && typeof aiExp.sourceFileName === 'string' && aiExp.sourceFileName.trim() !== '') {
                  filesToAttach.push(aiExp.sourceFileName);
              }
              if (Array.isArray(aiExp.sourceFileNames)) {
                  filesToAttach.push(...aiExp.sourceFileNames);
              }

              if (filesToAttach.length > 0 && pendingFiles.length > 0) {
                  for (const fName of filesToAttach) {
                      const matchedFile = findMatchingFile(pendingFiles, fName);
                      if (matchedFile) {
                          try {
                              await handleAttachFile(newId, matchedFile);
                              console.log(`[Magic Drop] ✅ Auto-attaché: "${matchedFile.name}" (source: "${fName}") → frais ${newId}`);
                          } catch (err) {
                              console.warn(`[Magic Drop] ❌ Échec auto-attach pour ${matchedFile.name}:`, err);
                          }
                      } else {
                          console.warn(`[Magic Drop] ⚠️ Aucun fichier ne matche "${fName}". Fichiers disponibles:`, pendingFiles.map(f => f.name));
                      }
                  }
              }
          }
      }

      // 3.5 Magic Drop Cause: Auto-attach technical files to Cause block
      if (data.technicalFilesToAttach && data.technicalFilesToAttach.length > 0 && pendingFiles.length > 0) {
          for (const fileName of data.technicalFilesToAttach) {
              const matchedFile = findMatchingFile(pendingFiles, fileName);
              if (matchedFile) {
                  try {
                      await handleAttachFile('doc_rapport_cause', matchedFile);
                      console.log(`[Magic Drop Cause] ✅ Auto-attaché: "${matchedFile.name}" → doc_rapport_cause`);
                  } catch (err) {
                      console.warn(`[Magic Drop Cause] ❌ Échec auto-attach:`, err);
                  }
              }
          }
      }

      // 4. Experts — Auto-ajout DÉSACTIVÉ (gestion manuelle exclusive).
      // (Supprimé pour éviter de polluer la base de données avec de faux experts).

      // 4.5. Références — ajouter les références cochées (v8.1.0)
      if (selections.references && selections.references.length > 0 && data.references) {
          const newRefs = [];
          selections.references.forEach(refId => {
              const aiRef = data.references.find(r => r.id === refId);
              if (!aiRef) return;
              const exists = references.some(r => referenceKey(r) === referenceKey(aiRef));
              if (!exists && (aiRef.nom || aiRef.ref)) {
                  newRefs.push({
                      id: crypto.randomUUID(),
                      nom: aiRef.nom || '',
                      ref: aiRef.ref || ''
                  });
              }
          });
          if (newRefs.length > 0) {
              setReferences(prev => [...prev, ...newRefs]);
              console.log(`[commitPendingAiData] 📊 ${newRefs.length} références ajoutées`);
          }
      }

      // 5. Photos en attente d'attribution (v5.5.10)
      // Les images (jpg/png) extraites des emails qui n'ont pas été matchées à un frais
      // sont stockées dans attachedPhotos["unassigned"] pour être réattribuées aux occupants
      if (pendingFiles.length > 0) {
          const matchedFileNames = new Set();
          // Récupérer les noms des fichiers déjà matchés aux frais
          if (data.expenses) {
              data.expenses.forEach(exp => {
                  if (exp.sourceFileName) matchedFileNames.add(exp.sourceFileName.toLowerCase());
              });
          }
          
          const unmatchedPhotos = pendingFiles.filter(f => {
              const name = (f.name || '').toLowerCase();
              const isImage = f.type && f.type.startsWith('image/');
              const isMatched = matchedFileNames.has(name);
              return isImage && !isMatched;
          });

          if (unmatchedPhotos.length > 0) {
              for (const photo of unmatchedPhotos) {
                  try {
                      await handleAttachPhoto('unassigned', photo);
                      console.log(`[Magic Drop] 📸 Photo en attente : "${photo.name}" → unassigned`);
                  } catch (err) {
                      console.warn(`[Magic Drop] ❌ Échec stockage photo "${photo.name}":`, err);
                  }
              }
          }
      }

      // 6. Intervenants — ajouter les intervenants cochés (v5.6.0)
      if (selections.intervenants && selections.intervenants.length > 0 && data.intervenants) {
          const newIntervenants = [];
          selections.intervenants.forEach(intervenantId => {
              const aiInter = data.intervenants.find(i => i.id === intervenantId);
              if (!aiInter) return;
              // Anti-doublons par nom
              const exists = intervenantsList.some(i => 
                  (i.nom || '').toLowerCase().trim() === (aiInter.nom || '').toLowerCase().trim() &&
                  (i.prenom || '').toLowerCase().trim() === (aiInter.prenom || '').toLowerCase().trim()
              );
              if (!exists && aiInter.nom) {
                  newIntervenants.push({
                      id: crypto.randomUUID(),
                      nom: aiInter.nom || '',
                      prenom: aiInter.prenom || '',
                      role: aiInter.role || '',
                      societe: aiInter.societe || '',
                      email: aiInter.email || '',
                      tel: aiInter.tel || ''
                  });
              }
          });
          if (newIntervenants.length > 0) {
              setIntervenantsList(prev => [...prev, ...newIntervenants]);
              console.log(`[commitPendingAiData] 🤝 ${newIntervenants.length} intervenants ajoutés`);
          }
      }

      // 6.5 File assignments from Modal (v8.2.0)
      if (selections.fileAssignments && pendingFiles.length > 0) {
          for (const [fName, targetZone] of selections.fileAssignments) {
              if (targetZone === 'unassigned') continue;
              const matchedFile = findMatchingFile(pendingFiles, fName);
              if (matchedFile) {
                  try {
                      await handleAttachFile(targetZone, matchedFile);
                      console.log(`[Magic Drop] ✅ Pièce jointe assignée manuellement : "${matchedFile.name}" → ${targetZone}`);
                  } catch (err) {
                      console.warn(`[Magic Drop] ❌ Échec assignation manuelle pour "${matchedFile.name}":`, err);
                  }
              }
          }
      }

      // 7. Nettoyer APRÈS tous les attachements
      setPendingAiData(null);
      setActiveTab('builder');
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

  const addCauseTimelineItem = (type, contentOrFile, dbKey = null) => {
      setCauseTimeline(prev => [...prev, {
          id: crypto.randomUUID(),
          type: type, // 'text' ou 'file'
          date: new Date().toLocaleDateString('fr-FR'),
          content: type === 'text' ? contentOrFile : '',
          fileName: type === 'file' ? contentOrFile.name : '',
          dbKey: dbKey,
          isPdf: type === 'file' ? contentOrFile.type === 'application/pdf' : false
      }]);
  };



  const toggleExpenseType = (id, targetType) => {
      const exp = expenses.find(e => e.id === id);
      if (!exp || exp.type === targetType) return; // Introuvable ou déjà dans le bon état

      const isMovingToFacture = targetType === 'Facture';
      
      financeStore.updateExpense(id, {
          type: targetType,
          // Si on passe en Facture, on stash l'actuel dans Devis et on charge la Facture
          montantDevis: isMovingToFacture ? exp.montant : exp.montantDevis,
          refDevis: isMovingToFacture ? exp.ref : exp.refDevis,
          prestataireDevis: isMovingToFacture ? exp.prestataire : exp.prestataireDevis,
          descDevis: isMovingToFacture ? exp.desc : exp.descDevis,

          montant: isMovingToFacture ? (exp.montantFacture || '') : (exp.montantDevis || ''),
          ref: isMovingToFacture ? (exp.refFacture || '') : (exp.refDevis || ''),
          prestataire: isMovingToFacture ? (exp.prestataireFacture || '') : (exp.prestataireDevis || ''),
          desc: isMovingToFacture ? (exp.descFacture || '') : (exp.descDevis || ''),
          
          // Si on repasse en Devis, on stash l'actuel dans Facture et on charge le Devis
          montantFacture: !isMovingToFacture ? exp.montant : exp.montantFacture,
          refFacture: !isMovingToFacture ? exp.ref : exp.refFacture,
          prestataireFacture: !isMovingToFacture ? exp.prestataire : exp.prestataireFacture,
          descFacture: !isMovingToFacture ? exp.desc : exp.descFacture,
      });
  };

  // --- Autosave Logic ---
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'saving', 'unsaved'
  const isInitialMount = useRef(true);

  useEffect(() => {
      if (isInitialMount.current) {
          isInitialMount.current = false;
          return;
      }
      
      setSaveStatus('unsaved');
      
      const timer = setTimeout(() => {
          if (!currentDossierId || !isLoaded) return;
          if (lockStatus === 'readonly' || lockStatus === 'blocked') return;
          setSaveStatus('saving');
          
          let targetId = currentDossierId;
          let name = formData.refPechard || formData.nomResidence || `Dossier sans nom`;
          
          if (!targetId) {
              targetId = crypto.randomUUID();
              setCurrentDossierId(targetId);
          }
          
          const safePhotos = {};
          if (attachedPhotos) {
              for (const [occId, photos] of Object.entries(attachedPhotos)) {
                  safePhotos[occId] = photos.map(p => ({ ...p, dataUrl: null }));
              }
          }
          const dossierData = { formData, blockTitles, references, occupants, expenses, blocksVisible, styles, blockOrder, blockWidths, customBlocks, showSubtotals, fitBlocks, attachedFiles, attachedPhotos: safePhotos, attachedFreeAnnexes, causeTimeline, intervenantsList, rawContexts };

          const dateStr = new Date().toLocaleString('fr-FR');
          const targetDossierToSave = { id: targetId, name, date: dateStr, data: dossierData };
          
          setSavedDossiers(prev => {
              let updated;
              if (prev.some(d => d.id === targetId)) {
                  const existing = prev.find(d => d.id === targetId);
                  if (existing && existing.name) {
                      targetDossierToSave.name = existing.name;
                  }
                  updated = prev.map(d => d.id === targetId ? targetDossierToSave : d);
              } else {
                  updated = [targetDossierToSave, ...prev];
              }
              return updated;
          });
          
          // Persistance I/O Asynchrone hors du reducer
          persistDossier(targetDossierToSave, currentVersionRef.current)
            .then(({ version }) => {
                setCurrentVersion(version);
                targetDossierToSave.version = version;
                setSaveStatus('saved');
            })
            .catch(err => {
                console.error("Autosave failed", err);
                if (err.name === 'ConflictError') {
                    setConflictActionDossier(targetDossierToSave);
                    setShowConflictModal(true);
                } else {
                    setSaveStatus('error');
                }
            });
      }, 3000); // 3 seconds of inactivity

      return () => clearTimeout(timer);
  }, [formData, blockTitles, references, occupants, expenses, blocksVisible, styles, blockOrder, blockWidths, customBlocks, showSubtotals, fitBlocks, attachedFiles, attachedPhotos, attachedFreeAnnexes, causeTimeline, intervenantsList, rawContexts, currentDossierId]);
  // --- End Autosave Logic ---

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
      intervenantsList, setIntervenantsList,
      formData, setFormData, blockTitles, setBlockTitles, references, setReferences,
      occupants, setOccupants,
      expenses, setExpenses, blocksVisible, setBlocksVisible,
      customBlocks, setCustomBlocks, blockOrder, setBlockOrder, blockWidths, setBlockWidths, styles, setStyles,
      attachedFiles, handleAttachFile, attachedPhotos, setAttachedPhotos,
      handleAttachPhoto, attachedFreeAnnexes, setAttachedFreeAnnexes,
      handleAttachFreeAnnex, handleUpdateFreeAnnex,
      isExpenseExcludedFromMain, dynamicFreeAnnexes,
      isMerging,
      getPaginationInfo, downloadSelectedPDF, downloadDossierPDF, getAnnexList,
      hideAnnexIndex, setHideAnnexIndex,
      printSelection, setPrintSelection,
      coverPageCount, setCoverPageCount,
      startResizing, stopResizing, resize, handleReset, handleChange, handleNewDossier,
      ingestionModal, openIngestion, closeIngestion,
      handleTitleChange, handleStyleChange, moveBlockUp, moveBlockDown, toggleBlockWidth, saveDossier, saveDossierAs, loadDossier, saveStatus,
      deleteDossier, generatePDF, getSortedBlocks, addRef, updateRef, removeRef,
      addOcc, updateOcc, removeOcc, sortOccupantsByFloor, addExpense, updateExpense,
      removeExpense, reorganizeExpenses, processJsonData, handleJsonImport,
      handlePasteImport, copyPrompt, exportGlobalData, handleOpenFile,
      isAiModeActive, aiConfig, toggleAiMode, updateAiConfig, setProcessOverride, clearProcessOverride,
      isDeepThinkingMode, toggleDeepThinkingMode,
      pendingAiData, setPendingAiData, commitPendingAiData,
      causeTimeline, setCauseTimeline, addCauseTimelineItem,
      toggleExpenseType,
      aiStatus, setAiStatus,
      rawContexts, setRawContexts,
      bridgeFiles, setBridgeFiles,  // v6.1.0 - Smart Bridge file queue
      globalAssistantFiles, setGlobalAssistantFiles, // v6.3.2 - SAS file queue
      isDebugMode, toggleDebugMode, debugLogs, addDebugLog, clearDebugLogs, // v6.2.0
      logHistory, commitLogSession, clearLogHistory, // v6.3.3
      telemetry, exportTelemetryJson, clearTelemetryLogs,
      deleteAttachment
  };

  const handleConflictOverwrite = async () => {
      if (!conflictActionDossier) return;
      try {
          const { version } = await persistDossier(conflictActionDossier, currentVersionRef.current, true);
          setCurrentVersion(version);
          setShowConflictModal(false);
          setConflictActionDossier(null);
          alert("✅ Dossier forcé et sauvegardé !");
      } catch (err) {
          alert("❌ Échec lors de la sauvegarde forcée : " + err.message);
      }
  };

  const handleConflictReload = () => {
      window.location.reload();
  };

  return (
      <ExpertiseContext.Provider value={contextValue}>
          {children}
          <ConflictModal 
              isOpen={showConflictModal} 
              onReload={handleConflictReload} 
              onOverwrite={handleConflictOverwrite} 
          />
          <DossierLockModal
              isOpen={lockStatus === 'blocked'}
              isStale={isLockStale(lockInfo)}
              onRetry={() => {
                  window.location.reload();
              }}
              onReadOnly={() => setLockStatus('readonly')}
              onForceEdit={() => {
                  setLockStatus('owner');
                  heartbeatCleanerRef.current = startHeartbeat(currentDossierId);
              }}
          />
      </ExpertiseContext.Provider>
  );
};
