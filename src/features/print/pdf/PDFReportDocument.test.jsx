import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import PDFReportDocument from './PDFReportDocument';

describe('PDFReportDocument Robustness & Parity', () => {
  it('renders annexes_libres without crashing when optional configs (like showSubtotals) are missing', () => {
    const reportData = {
      meta: {
        orderedBlocks: ['annexes_libres'],
        styles: {}
      },
      annexesLibres: { 
        title: "Annexes Additionnelles",
        annexes: [
          { nom: "Plan", description: "Plan cadastral" }
        ]
      }
    };
    
    // Appel direct du composant comme fonction (ne lève pas d'erreur)
    const result = PDFReportDocument({ reportData });
    expect(result).toBeDefined();
    
    // Le crash précédent s'arrêtait avant ce point
  });

  it('handles showSubtotals defensively', () => {
    // Cas où showSubtotals est défini à true dans feesOptions
    const reportData = {
      meta: { orderedBlocks: ['frais_liste'] },
      feesOptions: { showSubtotals: true },
      frais: { decomptes: [{ compteDeCourt: "Bailleur", htvaFormate: "100" }] }
    };
    
    const result = PDFReportDocument({ reportData });
    expect(result).toBeDefined();
  });
});

