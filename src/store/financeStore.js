import { create } from 'zustand';

// Utilitaire pour la génération d'ID sécurisée
const generateId = () => crypto.randomUUID();

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
    expenses: [],      // { id: UUID, prestataire, type, ref, desc, compteDe, montantReclame, montantValide, pourcentageVetuste, motifRefus, typeMontant }
    paiements: [],     // Phase 3: { id: UUID, dateRecept, montantTotal, ventilations: [{ expenseId, montantAlloue, typeAllocation }] }
    isPVEClosed: false // Statut de l'expertise (Verrouille les modifications)
  },

  // ==========================================
  // 2. ACTIONS DE MODIFICATION
  // ==========================================

  // --- Chargement global ---
  loadDossier: (data) => set({
    pii: data.pii || { occupants: [], prestataires: [], experts: [] },
    metier: data.metier || { formData: {}, expenses: [], paiements: [], isPVEClosed: false }
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
        if (!state.metier.isPVEClosed && expenseData.montantValide === undefined) {
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
      const val = parseFloat(String(exp.montantValide || exp.montantReclame || exp.montant || "0").replace(',', '.')) || 0;
      return sum + val;
    }, 0);
    return total;
  },

  getTotalReclame: () => {
    const expenses = get().metier.expenses;
    const total = expenses.reduce((sum, exp) => {
      const val = parseFloat(String(exp.montantReclame || exp.montant || "0").replace(',', '.')) || 0;
      return sum + val;
    }, 0);
    return total;
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
