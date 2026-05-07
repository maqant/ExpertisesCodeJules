import { describe, it, expect, beforeEach } from 'vitest';
import { useFinanceStore } from './financeStore';

describe('financeStore getTotalPVE', () => {
  beforeEach(() => {
    // Reset store state before each test
    useFinanceStore.setState({
      metier: {
        expenses: []
      }
    });
  });

  it('should return 0 when there are no expenses', () => {
    expect(useFinanceStore.getState().getTotalPVE()).toBe(0);
  });

  it('should sum expenses using montantValide as highest priority', () => {
    useFinanceStore.setState({
      metier: {
        expenses: [
          { montantValide: 10, montantReclame: 20, montant: 30 },
          { montantValide: 5, montantReclame: 15, montant: 25 }
        ]
      }
    });
    expect(useFinanceStore.getState().getTotalPVE()).toBe(15);
  });

  it('should fallback to montantReclame if montantValide is falsy (e.g., 0, null, undefined, empty string)', () => {
    useFinanceStore.setState({
      metier: {
        expenses: [
          { montantValide: 0, montantReclame: 20 },
          { montantValide: null, montantReclame: 15 },
          { montantValide: undefined, montantReclame: 5 },
          { montantValide: "", montantReclame: 10 }
        ]
      }
    });
    expect(useFinanceStore.getState().getTotalPVE()).toBe(50);
  });

  it('should fallback to montant if both montantValide and montantReclame are falsy', () => {
    useFinanceStore.setState({
      metier: {
        expenses: [
          { montant: 30 },
          { montantReclame: 0, montant: 25 }
        ]
      }
    });
    expect(useFinanceStore.getState().getTotalPVE()).toBe(55);
  });

  it('should parse string amounts with comma as decimal separator', () => {
    useFinanceStore.setState({
      metier: {
        expenses: [
          { montantValide: "10,50" },
          { montantValide: "5,25" }
        ]
      }
    });
    expect(useFinanceStore.getState().getTotalPVE()).toBe(15.75);
  });

  it('should parse string amounts with period as decimal separator', () => {
    useFinanceStore.setState({
      metier: {
        expenses: [
          { montantValide: "10.50" },
          { montantValide: "5.25" }
        ]
      }
    });
    expect(useFinanceStore.getState().getTotalPVE()).toBe(15.75);
  });

  it('should handle unparsable amounts gracefully by treating them as 0', () => {
    useFinanceStore.setState({
      metier: {
        expenses: [
          { montantValide: "abc" },
          { montantValide: 10 }
        ]
      }
    });
    expect(useFinanceStore.getState().getTotalPVE()).toBe(10);
  });

  it('should sum properly when missing all montant fields', () => {
    useFinanceStore.setState({
      metier: {
        expenses: [
          {},
          { id: '123' }
        ]
      }
    });
    expect(useFinanceStore.getState().getTotalPVE()).toBe(0);
  });
});
