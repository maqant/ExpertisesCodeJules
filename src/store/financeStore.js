import { create } from 'zustand';

// Utilitaire pour la génération d'ID sécurisée
const generateId = () => crypto.randomUUID();

// Utilitaire pour parser un montant textuel en nombre
const parseMontant = (val) => {
  if (typeof val === 'number') return val;
  return parseFloat(String(val || '0').replace(',', '.')) || 0;
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
      adresse: "",
      cause: ""
    },
    expenses: [],      // { id, prestataire, type, ref, desc, compteDe, montantReclame, montantValide, pourcentageVetuste, motifRefus, typeMontant, categorieGarantie, tauxTVA, factureRecue, isFranchise }
    paiements: [],     // Phase 3: { id: UUID, dateRecept, montantTotal, ventilations: [{ expenseId, montantAlloue, typeAllocation }] }
    isPVEClosed: false, // Statut de l'expertise (Verrouille les modifications)
    franchiseOccId: null // ID de l'occupant qui porte la franchise (null = pas encore décidé)
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
      ...(data.metier || {})
    }
  }),

  // --- Formulaire (Métier) ---
  updateFormData: (newData) => set((state) => ({
    metier: { ...state.metier, formData: { ...state.metier.formData, ...newData } }
  })),

  // --- Occupants (PII) ---
  addOccupant: (occupant) => set((state) => {
    const id = occupant.id || generateId();
    return { pii: { ...state.pii, occupants: [...state.pii.occupants, { id, ...occupant }] } };
  }),
  updateOccupant: (id, occupantData) => set((state) => ({
    pii: {
      ...state.pii,
      occupants: state.pii.occupants.map(o => o.id === id ? { ...o, ...occupantData } : o)
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

        // Phase 2.3.2 : Calcul automatique si on modifie des données de facturation (et que l'expertise n'est pas close)
        // Ne pas écraser si l'utilisateur a explicitement fourni montantValide (modification manuelle en mode Terrain)
        // Ne pas recalculer pour les frais de franchise (montant négatif fixe)
        if (!state.metier.isPVEClosed && expenseData.montantValide === undefined && !updated.isFranchise) {
          const reclame = parseFloat(String(updated.montantReclame || "0").replace(',', '.')) || 0;
          let vetuste = parseFloat(updated.pourcentageVetuste) || 0;

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

  generateFranchiseExpense: (occId, montant) => set((state) => {
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
      montantReclame: (-Math.abs(montant)).toFixed(2),
      montantValide: (-Math.abs(montant)).toFixed(2),
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
      const val = parseMontant(exp.montantValide || exp.montantReclame || exp.montant);
      return sum + val;
    }, 0);
    return total;
  },

  getTotalReclame: () => {
    const expenses = get().metier.expenses;
    const total = expenses.reduce((sum, exp) => {
      const val = parseMontant(exp.montantReclame || exp.montant);
      return sum + val;
    }, 0);
    return total;
  },

  // v5.1.0 : Sélecteur financier avancé par occupant
  getFinancialSummaryByOcc: (formData) => {
    const state = get();
    const expenses = state.metier.expenses;
    const occupants = state.pii.occupants;
    const franchiseOccId = state.metier.franchiseOccId;

    // Parser le taux PI depuis formData (ex: "10%" → 10)
    const tauxPI = parseFloat(String(formData?.pertesIndirectes || '0').replace('%', '')) || 0;

    // Parser le montant brut de la franchise depuis formData (ex: "Avril 2026 - 333,39 €" → 333.39)
    let franchiseBrute = 0;
    const franchiseStr = formData?.franchise || '';
    const franchiseMatch = franchiseStr.match(/([\d.,]+)\s*€?/);
    if (franchiseMatch) {
      franchiseBrute = parseFloat(franchiseMatch[1].replace(',', '.')) || 0;
    } else {
      franchiseBrute = parseFloat(String(franchiseStr).replace(',', '.')) || 0;
    }

    const summary = {};

    // Initialiser chaque occupant
    occupants.forEach(o => {
      summary[o.id] = {
        nom: `${o.nom || ''} ${o.prenom || ''}`.trim(),
        etage: o.etage || '',
        totalPrincipale: 0,
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
          totalComplementaire: 0,
          franchiseMontant: 0,
          pertesIndirectes: 0,
          totalNet: 0,
          tvaAttendue: 0,
          lignes: []
        };
      }

      const val = parseMontant(exp.montantValide || exp.montantReclame || exp.montant);
      const entry = summary[exp.compteDe];

      if (exp.isFranchise) {
        entry.franchiseMontant += val; // val est déjà négatif
      } else {
        entry.lignes.push(exp);
        const cat = exp.categorieGarantie || 'Principale';
        if (cat === 'Principale') {
          entry.totalPrincipale += val;
        } else {
          entry.totalComplementaire += val;
        }

        // TVA attendue pour les frais HTVA sans facture reçue
        if (exp.typeMontant === 'HTVA' && !exp.factureRecue && (exp.tauxTVA || 0) > 0) {
          entry.tvaAttendue += val * ((exp.tauxTVA || 0) / 100);
        }
      }
    });

    // Calculer PI et Total Net pour chaque occupant
    Object.keys(summary).forEach(occId => {
      const entry = summary[occId];

      // PI = (Total Principale + Franchise) × tauxPI / 100
      // La franchise ne s'applique qu'à l'occupant désigné
      const basePourPI = entry.totalPrincipale + entry.franchiseMontant;

      if (tauxPI > 0 && basePourPI > 0) {
        entry.pertesIndirectes = basePourPI * (tauxPI / 100);
      }

      entry.totalNet = entry.totalPrincipale + entry.totalComplementaire + entry.franchiseMontant + entry.pertesIndirectes;
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
            const m = parseFloat(v.montantAlloue) || 0;
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
