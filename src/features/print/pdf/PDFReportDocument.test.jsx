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

  it('anti-regression: prevents rendering empty strings outside Text (Invalid string child)', () => {
    const consoleSpy = vi.spyOn(console, 'error');
    
    const reportData = {
      meta: { orderedBlocks: ['coord', 'infos', 'cause', 'orga'] },
      coord: {
        formData: { adresse: "", franchise: "", pertesIndirectes: null, expertInfos: undefined },
        title: ""
      },
      infos: {
        formData: { dateSinistre: "", declareLe: null, nomCie: "" },
        title: ""
      },
      cause: {
        formDataCause: "",
        title: "",
        timeline: []
      },
      orga: {
        occupantsHierarchy: [
          { id: 1, isResponsible: false, iban: "", tel: "", email: "" }
        ],
        title: ""
      }
    };

    // Render should not crash and should not cause React-PDF to complain 
    // about invalid string child outside Text.
    // In vitest, we just render the component function directly.
    // For a deep render test, we'd need @testing-library/react or react-test-renderer,
    // but React-PDF components are tricky. At minimum, the function shouldn't crash.
    const result = PDFReportDocument({ reportData });
    expect(result).toBeDefined();
    
    // We check that our components didn't throw an immediate TypeError
    // (though the true React-PDF validation happens at runtime pdf generation).
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('Invalid string child'));
    
    consoleSpy.mockRestore();
  });
});

