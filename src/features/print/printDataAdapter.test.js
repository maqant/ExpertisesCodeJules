import { describe, it, expect } from 'vitest';
import { buildPrintReportData } from './printDataAdapter';

describe('buildPrintReportData', () => {
  it('doit construire un objet stable et sérialisable', () => {
    const input = {
      expenses: [{ id: '1', montant: '100', compteDe: 'Test', isFranchise: false }],
      getSortedBlocks: () => ['frais']
    };
    
    const output = buildPrintReportData(input);
    expect(output).toBeDefined();
    expect(output.frais.expenses).toHaveLength(1);
    expect(output.meta.orderedBlocks).toEqual(['frais']);
    
    // Vérifier l'absence d'éléments non-sérialisables (fonctions, etc.)
    const jsonStr = JSON.stringify(output);
    expect(JSON.parse(jsonStr)).toEqual(output);
  });
});
