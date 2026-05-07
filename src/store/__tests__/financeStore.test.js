import { describe, it, expect, beforeEach } from 'vitest';
import { useFinanceStore } from '../financeStore';

describe('financeStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useFinanceStore.setState({
      pii: {
        occupants: [],
        prestataires: [],
        experts: []
      },
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
        expenses: [],
        paiements: [],
        isPVEClosed: false
      }
    });
  });

  describe('togglePVEStatus', () => {
    it('should toggle isPVEClosed from false to true', () => {
      const store = useFinanceStore.getState();
      expect(store.metier.isPVEClosed).toBe(false);

      store.togglePVEStatus();

      const newStore = useFinanceStore.getState();
      expect(newStore.metier.isPVEClosed).toBe(true);
    });

    it('should toggle isPVEClosed from true to false', () => {
      useFinanceStore.setState({
        metier: {
          ...useFinanceStore.getState().metier,
          isPVEClosed: true
        }
      });

      const store = useFinanceStore.getState();
      expect(store.metier.isPVEClosed).toBe(true);

      store.togglePVEStatus();

      const newStore = useFinanceStore.getState();
      expect(newStore.metier.isPVEClosed).toBe(false);
    });
  });
});
