import { create } from 'zustand';

// Utilitaire pour la génération d'ID sécurisée
const generateId = () => crypto.randomUUID();

export const cleanAmount = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    let str = String(val).trim().replace(/\s/g, ''); // Enlève les espaces

    if (str.includes('.') && str.includes(',')) {
        // Ex: 2.700,50 ou 2,700.50
        const lastDot = str.lastIndexOf('.');
        const lastComma = str.lastIndexOf(',');
        if (lastComma > lastDot) {
            str = str.replace(/\./g, '').replace(',', '.'); // Format EU
        } else {
            str = str.replace(/,/g, ''); // Format US
        }
    } else if (str.includes(',')) {
        // Ex: 2700,50 ou 2,700
        if (/(,\d{3})$/.test(str) && str.indexOf(',') === str.lastIndexOf(',')) {
            str = str.replace(',', ''); // Séparateur de milliers US (2,700)
        } else {
            str = str.replace(/,/g, '.'); // Décimale FR (2700,50 -> 2700.50)
        }
    } else if (str.includes('.')) {
        // Ex: 2.700 ou 2.50
        // Si le point est suivi EXACTEMENT de 3 chiffres à la fin du mot, c'est un millier !
        if (/(\.\d{3})$/.test(str) && str.indexOf('.') === str.lastIndexOf('.')) {
            str = str.replace('.', ''); // 2.700 -> 2700
        } else if (str.split('.').length > 2) {
            str = str.replace(/\./g, ''); // 2.700.000 -> 2700000
        }
        // Sinon, c'est une décimale (2.50), on n'y touche pas.
    }

    const parsed = parseFloat(str);
    return isNaN(parsed) ? 0 : parsed;
};

export const useFinanceStore = create((set, get) => ({
  // ==========================================
  // 1. SQUELETTE DE DONNÉES STRICT (Phase 2.1)
  // ==========================================

  // Nœud PII : Données Sensibles (RGPD)
  pii: {
    occupants: [],     // { id: UUID, nom, tel, email, statut, etc. }
    prestataires: [],  // Liste des prestataires (pourrait inclure coordonnées bancaires etc)
    experts: []        // Experts impliqués
  },

  // Nœud Métier : Données Financières et Techniques
  metier: {
    formData: {
      dateSinistre: "",
      dateDeclaration: "",
      declarant: "",
      nomCie: "",
      nomContrat: "",
      numPolice: "",
      numSinistreCie: "",
      numeroPVPolice: "",
      adresse: "",
      cause: ""
    },
    expenses: [],      // { id, prestataire, type, ref, desc, compteDe, montantReclame, montantValide, pourcentageVetuste, motifRefus, typeMontant, categorieGarantie, tauxTVA, factureRecue, isFranchise }
    paiements: [],     // Phase 3: { id: UUID, dateRecept, montantTotal, ventilations: [{ expenseId, montantAlloue, typeAllocation }] }
    isPVEClosed: false, // Statut de l'expertise (Verrouille les modifications)
    franchiseOccId: null, // ID de l'occupant qui porte la franchise (null = pas encore décidé)
    referentielFranchises: [], // Liste des franchises applicables selon date
    responsablesIds: [] // Liste des IDs des occupants responsables du sinistre
  },

  // ==========================================
  // 2. ACTIONS DE MODIFICATION
  // ==========================================

  // --- Chargement global ---
  loadDossier: (data) => set({
    pii: data.pii || { occupants: [], prestataires: [], experts: [] },
    metier: {
      formData: {},
      expenses: [],
      paiements: [],
      isPVEClosed: false,
      franchiseOccId: null,
      referentielFranchises: [],
      responsablesIds: [],
      ...(data.metier || {})
    }
  }),

  // --- Franchise Référentiel ---
  setReferentielFranchises: (liste) => set((state) => ({
    metier: { ...state.metier, referentielFranchises: liste }
  })),

  // --- Formulaire (Métier) ---
  updateFormData: (newData) => set((state) => ({
    metier: { ...state.metier, formData: { ...state.metier.formData, ...newData } }
  })),
  replaceFormData: (newData) => set((state) => ({
    metier: { ...state.metier, formData: newData }
  })),

  // --- Occupants (PII) ---
  addOccupant: (occupant) => set((state) => {
    const id = occupant.id || generateId();
    const formattedOcc = { ...occupant, nom: occupant.nom ? String(occupant.nom).toUpperCase() : '' };
    return { pii: { ...state.pii, occupants: [...state.pii.occupants, { id, ...formattedOcc }] } };
  }),
  updateOccupant: (id, occupantData) => set((state) => ({
    pii: {
      ...state.pii,
      occupants: state.pii.occupants.map(o => {
          if (o.id === id) {
              const updated = { ...o, ...occupantData };
              if (updated.nom) updated.nom = String(updated.nom).toUpperCase();
              return updated;
          }
          return o;
      })
    }
  })),
  removeOccupant: (id) => set((state) => ({
    pii: {
      ...state.pii,
      occupants: state.pii.occupants.filter(o => o.id !== id)
    }
  })),
  setOccupants: (occupantsList) => set((state) => ({
    pii: { ...state.pii, occupants: occupantsList }
  })),

  // --- Frais (Métier) ---
  addExpense: (expense) => set((state) => {
    const id = expense.id || generateId();
    // Phase 2.3.1 : Enrichissement du modèle
    // Si l'ancien système n'a que "montant", on le map sur montantReclame et montantValide (par défaut)
    const baseMontant = expense.montantReclame || expense.montant || "";

    const defaultExpense = {
      montantReclame: baseMontant,
      montantValide: baseMontant,
      pourcentageVetuste: expense.pourcentageVetuste || 0,
      motifRefus: expense.motifRefus || "",
      isProcessed: expense.isProcessed || false,
      typeMontant: expense.typeMontant || 'HTVA',
      isSpontane: expense.isSpontane || false,
      // v5.1.0 : Nouveaux champs financiers
      categorieGarantie: expense.categorieGarantie || '',
      tauxTVA: expense.tauxTVA ?? 0,
      factureRecue: expense.factureRecue || false,
      isFranchise: expense.isFranchise || false,
      ...expense
    };
    return {
      metier: { ...state.metier, expenses: [...state.metier.expenses, { id, ...defaultExpense }] }
    };
  }),

  updateExpense: (id, expenseData) => set((state) => {
    const expenses = state.metier.expenses.map(e => {
      if (e.id === id) {
        // Validation stricte de compteDe (éviter la data corruption de nombres/floats bizarres)
        let cleanCompteDe = expenseData.compteDe !== undefined ? expenseData.compteDe : e.compteDe;
        if (cleanCompteDe && typeof cleanCompteDe !== 'string') {
          cleanCompteDe = String(cleanCompteDe);
        }

        const updated = { ...e, ...expenseData, compteDe: cleanCompteDe };

        // Sécurisation des frais "Forfait"
        if (updated.typeMontant === 'Forfait') {
          updated.montantValide = updated.montantReclame;
          updated.pourcentageVetuste = 0;
        } 
        // Phase 2.3.2 : Calcul automatique si on modifie des données de facturation (et que l'expertise n'est pas close)
        // Ne pas écraser si l'utilisateur a explicitement fourni montantValide (modification manuelle en mode Terrain)
        // Ne pas recalculer pour les frais de franchise (montant négatif fixe)
        else if (!state.metier.isPVEClosed && expenseData.montantValide === undefined && !updated.isFranchise) {
          const reclame = cleanAmount(updated.montantReclame);
          let vetuste = cleanAmount(updated.pourcentageVetuste);

          // Calcul mathématique avec vétusté
          const valide = reclame * (1 - (vetuste / 100));
          // On s'assure d'arrondir correctement pour la finance
          updated.montantValide = valide.toFixed(2).replace('.', ',');
        }
        return updated;
      }
      return e;
    });
    return { metier: { ...state.metier, expenses } };
  }),

  removeExpense: (id) => set((state) => ({
    metier: { ...state.metier, expenses: state.metier.expenses.filter(e => e.id !== id) }
  })),

  setExpenses: (expensesList) => set((state) => ({
    metier: { ...state.metier, expenses: expensesList }
  })),

  // --- Clôture / Action Terrain ---
  togglePVEStatus: () => set((state) => ({
    metier: { ...state.metier, isPVEClosed: !state.metier.isPVEClosed }
  })),

  // --- Franchise (v5.1.0) ---
  setFranchiseOccId: (occId) => set((state) => ({
    metier: { ...state.metier, franchiseOccId: occId }
  })),

  // --- Responsabilité (v7.13.0) ---
  toggleResponsable: (occId) => set((state) => {
    const ids = state.metier.responsablesIds || [];
    const newIds = ids.includes(occId) ? ids.filter(id => id !== occId) : [...ids, occId];
    return { metier: { ...state.metier, responsablesIds: newIds } };
  }),
  setResponsables: (ids) => set((state) => ({
    metier: { ...state.metier, responsablesIds: ids }
  })),

  generateFranchiseExpense: (occId) => set((state) => {
    // Supprimer tout ancien frais franchise existant avant d'en créer un nouveau
    const franchiseBrute = get().getFranchiseMontant();

    // Supprimer tout ancien frais franchise existant avant d'en créer un nouveau
    const cleanedExpenses = state.metier.expenses.filter(e => !e.isFranchise);
    const id = generateId();
    const franchiseExp = {
      id,
      prestataire: 'Franchise contractuelle',
      type: 'Franchise',
      ref: '',
      desc: 'Franchise déduite conformément aux conditions du contrat',
      compteDe: occId,
      montantReclame: (-Math.abs(franchiseBrute)).toFixed(2),
      montantValide: (-Math.abs(franchiseBrute)).toFixed(2),
      typeMontant: 'Forfait',
      categorieGarantie: 'Principale',
      tauxTVA: 0,
      factureRecue: false,
      isFranchise: true,
      isSpontane: false,
      isProcessed: true,
      pourcentageVetuste: 0,
      motifRefus: ''
    };
    return {
      metier: {
        ...state.metier,
        expenses: [...cleanedExpenses, franchiseExp],
        franchiseOccId: occId
      }
    };
  }),

  // v5.3.1 : Répartition SPLIT de la franchise sur plusieurs occupants
  // splitMap = [{ occId: 'uuid', montant: 150.00 }, ...]
  generateFranchiseExpenseSplit: (splitMap) => set((state) => {
    const cleanedExpenses = state.metier.expenses.filter(e => !e.isFranchise);
    const franchiseExps = splitMap
      .filter(entry => entry.montant > 0)
      .map(entry => ({
        id: generateId(),
        prestataire: 'Franchise contractuelle',
        type: 'Franchise',
        ref: '',
        desc: 'Franchise déduite (quote-part)',
        compteDe: entry.occId,
        montantReclame: (-Math.abs(entry.montant)).toFixed(2),
        montantValide: (-Math.abs(entry.montant)).toFixed(2),
        typeMontant: 'Forfait',
        categorieGarantie: 'Principale',
        tauxTVA: 0,
        factureRecue: false,
        isFranchise: true,
        isSpontane: false,
        isProcessed: true,
        pourcentageVetuste: 0,
        motifRefus: ''
      }));
    return {
      metier: {
        ...state.metier,
        expenses: [...cleanedExpenses, ...franchiseExps],
        franchiseOccId: 'SPLIT'
      }
    };
  }),

  // --- Paiements (Phase 3) ---
  addPaiement: (paiement) => set((state) => {
    const id = paiement.id || generateId();
    return {
      metier: { ...state.metier, paiements: [...(state.metier.paiements || []), { id, ...paiement }] }
    };
  }),

  removePaiement: (id) => set((state) => ({
    metier: { ...state.metier, paiements: (state.metier.paiements || []).filter(p => p.id !== id) }
  })),

  // ==========================================
  // 3. SÉLECTEURS / CALCULS
  // ==========================================

  getTotalPVE: () => {
    const expenses = get().metier.expenses;
    const total = expenses.reduce((sum, exp) => {
      const val = cleanAmount(exp.montantValide || exp.montantReclame || exp.montant);
      return sum + val;
    }, 0);
    return total;
  },

  getTotalReclame: () => {
    const expenses = get().metier.expenses;
    const total = expenses.reduce((sum, exp) => {
      const val = cleanAmount(exp.montantReclame || exp.montant);
      return sum + val;
    }, 0);
    return total;
  },

  getFranchiseMontant: () => {
    const state = get();
    const formData = state.metier.formData;
    const refFranchises = state.metier.referentielFranchises || [];
    let foundInRef = false;
    let franchiseBrute = 0;
    
    if (formData?.dateSinistre && refFranchises.length > 0) {
      const dateSinistre = new Date(formData.dateSinistre);
      if (!isNaN(dateSinistre.getTime())) {
        const year = dateSinistre.getFullYear();
        const month = dateSinistre.getMonth() + 1;
        const matchingRef = refFranchises.find(f => 
          (f.year === year || f.annee === year) && 
          (f.month === month || f.mois === month)
        );
        if (matchingRef && matchingRef.montant) {
          franchiseBrute = cleanAmount(matchingRef.montant);
          foundInRef = true;
        }
      }
    }

    if (!foundInRef) {
      const franchiseStr = String(formData?.franchise || '').trim();
      const matchEuro = franchiseStr.match(/([\d.,]+)\s*€/);
      if (matchEuro) {
        franchiseBrute = cleanAmount(matchEuro[1]);
      } else {
        const numbers = franchiseStr.match(/[\d.,]+/g);
        if (numbers && numbers.length > 0) {
           franchiseBrute = cleanAmount(numbers[numbers.length - 1]);
        }
      }
    }
    return franchiseBrute;
  },

  // v5.1.0 : Sélecteur financier avancé par occupant
  getFinancialSummaryByOcc: (formData) => {
    const state = get();
    const expenses = state.metier.expenses;
    const occupants = state.pii.occupants;
    const franchiseOccId = state.metier.franchiseOccId;

    // Parser le taux PI depuis formData (ex: "10%" → 10)
    const tauxPI = cleanAmount(String(formData?.pertesIndirectes || '0').replace('%', ''));

    // Utilisation du sélecteur unifié
    const franchiseBrute = get().getFranchiseMontant();

    const summary = {};

    // Initialiser chaque occupant
    occupants.forEach(o => {
      summary[o.id] = {
        nom: `${o.nom || ''} ${o.prenom || ''}`.trim(),
        etage: o.etage || '',
        totalPrincipale: 0,
        totalPrincipaleForfait: 0,
        totalPrincipaleHorsForfait: 0,
        totalComplementaire: 0,
        franchiseMontant: 0,
        pertesIndirectes: 0,
        totalNet: 0,
        tvaAttendue: 0,
        lignes: []
      };
    });

    // Répartir les frais
    expenses.forEach(exp => {
      if (!exp.isProcessed || !exp.compteDe) return;
      if (!summary[exp.compteDe]) {
        // Occupant inconnu ou supprimé, créer une entrée fallback
        summary[exp.compteDe] = {
          nom: exp.compteDe,
          etage: '',
          totalPrincipale: 0,
          totalPrincipaleForfait: 0,
          totalPrincipaleHorsForfait: 0,
          totalComplementaire: 0,
          franchiseMontant: 0,
          pertesIndirectes: 0,
          totalNet: 0,
          tvaAttendue: 0,
          lignes: []
        };
      }

      const val = cleanAmount(exp.montantValide || exp.montantReclame || exp.montant);
      const entry = summary[exp.compteDe];

      if (exp.isFranchise) {
        entry.franchiseMontant += val; // val est déjà négatif
      } else {
        entry.lignes.push(exp);
        const cat = exp.categorieGarantie || 'Principale';

        // Comptabilité à 100% — toujours le montant validé intégral
        if (cat === 'Principale') {
          entry.totalPrincipale += val;
          if (exp.typeMontant === 'Forfait') {
            entry.totalPrincipaleForfait += val;
          } else {
            entry.totalPrincipaleHorsForfait += val;
          }
        } else {
          entry.totalComplementaire += val;
        }

        // TVA attendue pour les frais HTVA sans facture reçue
        if (exp.typeMontant === 'HTVA' && !exp.factureRecue && (exp.tauxTVA || 0) > 0) {
          entry.tvaAttendue += val * ((exp.tauxTVA || 0) / 100);
        }
      }
    });

    // v5.1.1 : Détection règle AXA
    const isAxa = state.metier.formData?.isAxa === true;

    // Calculer PI et Total Net pour chaque occupant avec imputation stricte de la franchise
    Object.keys(summary).forEach(occId => {
      const entry = summary[occId];

      const absFranchise = Math.abs(entry.franchiseMontant);
      
      // v5.1.1 : Chez AXA, PI = % de l'argent REÇU (80% de Principale - franchise)
      // Hors AXA, PI = % de (100% Principale - franchise)
      // PI ne s'applique JAMAIS sur la Complémentaire
      if (isAxa) {
        // Le 1er paiement compte les Forfaits à 100% et le reste à 80%
        const base1erPaiementPrincipale = (entry.totalPrincipaleHorsForfait * 0.8) + entry.totalPrincipaleForfait;
        const franchiseSurBase = Math.min(absFranchise, base1erPaiementPrincipale);
        const apresfranchise = base1erPaiementPrincipale - franchiseSurBase;

        // PI sur l'argent reçu au 1er paiement
        if (tauxPI > 0 && apresfranchise > 0) {
          entry.pertesIndirectes = apresfranchise * (tauxPI / 100);
        }

        // Indemnisation = ce que la personne va effectivement toucher au 1er paiement
        entry.totalNet = apresfranchise + entry.pertesIndirectes + entry.totalComplementaire;
        // Le premierPaiement est identique à totalNet chez AXA
        entry.premierPaiement = entry.totalNet;
      } else {
        // Hors AXA : calcul classique sur base 100%
        const partFranchiseImputeePrincipale = Math.min(absFranchise, entry.totalPrincipale);
        const basePourPI = entry.totalPrincipale - partFranchiseImputeePrincipale;

        if (tauxPI > 0 && basePourPI > 0) {
          entry.pertesIndirectes = basePourPI * (tauxPI / 100);
        }

        entry.totalNet = entry.totalPrincipale + entry.totalComplementaire + entry.franchiseMontant + entry.pertesIndirectes;
        entry.premierPaiement = null; // Pas applicable
      }
    });

    return summary;
  },

  // Calcul du montant total alloué (versé) sur un frais spécifique
  getStatutPaiementFrais: (expenseId) => {
    const paiements = get().metier.paiements || [];
    let totalHTVA = 0;
    let totalTVA = 0;
    let totalForfait = 0;

    paiements.forEach(p => {
      if (p.ventilations && Array.isArray(p.ventilations)) {
        p.ventilations.forEach(v => {
          if (v.expenseId === expenseId) {
            const m = cleanAmount(v.montantAlloue);
            if (v.typeAllocation === 'HTVA') totalHTVA += m;
            else if (v.typeAllocation === 'TVA') totalTVA += m;
            else totalForfait += m;
          }
        });
      }
    });

    return { totalHTVA, totalTVA, totalForfait, totalGlobal: totalHTVA + totalTVA + totalForfait };
  }
}));
