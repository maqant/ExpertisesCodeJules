import { describe, it, expect, vi } from 'vitest';
import { resolvePdfImageBlobUrls } from './resolvePdfImages';

describe('resolvePdfImages', () => {
  it('doit résoudre les UUIDs en Blob URLs sans muter l\'original', async () => {
    const reportData = {
      photos: {
        occupantsWithPhotos: [
          { id: '1', nom: 'Test', imageUuids: ['uuid-1', 'uuid-2'] }
        ]
      }
    };

    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:http://test.com/blob-1');
    global.URL.revokeObjectURL = vi.fn();

    const fetchBlobByUuid = vi.fn(async () => new Blob(['fake-image'], { type: 'image/jpeg' }));

    const resolved = await resolvePdfImageBlobUrls(reportData, fetchBlobByUuid);

    // Ne mute pas l'original
    expect(reportData.photos.occupantsWithPhotos[0]).not.toHaveProperty('resolvedImages');
    
    // A ajouté les URL résolues
    expect(resolved.photos.occupantsWithPhotos[0].resolvedImages).toHaveLength(2);
    expect(resolved.photos.occupantsWithPhotos[0].resolvedImages[0]).toBe('blob:http://test.com/blob-1');
  });
});
