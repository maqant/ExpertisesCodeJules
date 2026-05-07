import { describe, it, expect, beforeEach } from 'vitest';
import { useFinanceStore } from './financeStore';

describe('financeStore - getStatutPaiementFrais', () => {
  // Clear the store before each test
  beforeEach(() => {
    useFinanceStore.setState({
      pii: { occupants: [], prestataires: [], experts: [] },
      metier: { formData: {}, expenses: [], paiements: [], isPVEClosed: false }
    });
  });

  it('should return 0 for all totals when there are no paiements', () => {
    const store = useFinanceStore.getState();
    const result = store.getStatutPaiementFrais('exp1');

    expect(result).toEqual({
      totalHTVA: 0,
      totalTVA: 0,
      totalForfait: 0,
      totalGlobal: 0
    });
  });

  it('should handle missing or invalid ventilations gracefully', () => {
    useFinanceStore.setState({
      metier: {
        paiements: [
          { id: 'p1' }, // Missing ventilations
          { id: 'p2', ventilations: null }, // Null ventilations
          { id: 'p3', ventilations: 'not-an-array' } // Invalid ventilations
        ]
      }
    });

    const store = useFinanceStore.getState();
    const result = store.getStatutPaiementFrais('exp1');

    expect(result).toEqual({
      totalHTVA: 0,
      totalTVA: 0,
      totalForfait: 0,
      totalGlobal: 0
    });
  });

  it('should correctly sum HTVA, TVA, and Forfait for a specific expenseId', () => {
    useFinanceStore.setState({
      metier: {
        paiements: [
          {
            id: 'p1',
            ventilations: [
              { expenseId: 'exp1', montantAlloue: 100, typeAllocation: 'HTVA' },
              { expenseId: 'exp1', montantAlloue: 21, typeAllocation: 'TVA' },
              { expenseId: 'exp2', montantAlloue: 50, typeAllocation: 'HTVA' } // Different expense
            ]
          },
          {
            id: 'p2',
            ventilations: [
              { expenseId: 'exp1', montantAlloue: 50, typeAllocation: 'Forfait' },
              { expenseId: 'exp1', montantAlloue: '10.5', typeAllocation: 'HTVA' } // String number
            ]
          }
        ]
      }
    });

    const store = useFinanceStore.getState();
    const result = store.getStatutPaiementFrais('exp1');

    expect(result).toEqual({
      totalHTVA: 110.5,
      totalTVA: 21,
      totalForfait: 50,
      totalGlobal: 181.5
    });
  });

  it('should properly ignore allocations for other expenseIds', () => {
    useFinanceStore.setState({
      metier: {
        paiements: [
          {
            id: 'p1',
            ventilations: [
              { expenseId: 'exp2', montantAlloue: 100, typeAllocation: 'HTVA' },
              { expenseId: 'exp3', montantAlloue: 21, typeAllocation: 'TVA' }
            ]
          }
        ]
      }
    });

    const store = useFinanceStore.getState();
    const result = store.getStatutPaiementFrais('exp1');

    expect(result).toEqual({
      totalHTVA: 0,
      totalTVA: 0,
      totalForfait: 0,
      totalGlobal: 0
    });
  });

  it('should handle unparseable montantAlloue gracefully', () => {
    useFinanceStore.setState({
      metier: {
        paiements: [
          {
            id: 'p1',
            ventilations: [
              { expenseId: 'exp1', montantAlloue: 'invalid', typeAllocation: 'HTVA' },
              { expenseId: 'exp1', montantAlloue: undefined, typeAllocation: 'TVA' },
              { expenseId: 'exp1', montantAlloue: null, typeAllocation: 'Forfait' }
            ]
          }
        ]
      }
    });

    const store = useFinanceStore.getState();
    const result = store.getStatutPaiementFrais('exp1');

    expect(result).toEqual({
      totalHTVA: 0,
      totalTVA: 0,
      totalForfait: 0,
      totalGlobal: 0
    });
  });
});
