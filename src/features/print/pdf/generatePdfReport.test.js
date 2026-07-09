import { describe, it, expect, vi } from 'vitest';
import { generatePdfReportBlob } from './generatePdfReport';

// Mock de react-pdf et des composants enfants
vi.mock('@react-pdf/renderer', () => ({
  pdf: () => ({
    updateContainer: vi.fn(),
    toBlob: vi.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }))
  })
}));
vi.mock('./PDFReportDocument', () => ({ default: () => null }));

describe('generatePdfReportBlob', () => {
  it('doit lever une erreur si un UUID brut n\'a pas pu être résolu', async () => {
    const reportData = {
      photos: {
        occupantsWithPhotos: [
          { id: '1', nom: 'Test', imageUuids: ['uuid-missing'] } // Ne sera pas résolu par le mock
        ]
      }
    };

    const fetchBlobByUuid = vi.fn().mockResolvedValue(null);

    await expect(generatePdfReportBlob({ reportData, fetchBlobByUuid }))
      .rejects.toThrow(/UUID n'a pas pu être résolue/);
  });
});
