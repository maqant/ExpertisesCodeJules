/**
 * Résolution des images du rapport en blob: URLs pour @react-pdf/renderer.
 *
 * Contrat de sortie :
 *  - resolvedData    : copie profonde du rapport avec `resolvedImages` peuplé
 *  - createdBlobUrls : TOUTES les URLs créées — l'appelant DOIT les révoquer
 *                      via revokePdfImageBlobUrls() après rendu du PDF
 *  - failures        : chaque image non résolue, explicitement. Un rapport
 *                      d'expertise ne part JAMAIS incomplet en silence.
 */
export const resolvePdfImageBlobUrls = async (reportData, fetchBlobByUuid) => {
  if (typeof fetchBlobByUuid !== 'function') {
    throw new TypeError('[PDF] resolvePdfImageBlobUrls requiert un fetchBlobByUuid valide.');
  }

  // structuredClone : préserve Date, Map, etc. (natif, tous navigateurs cibles)
  const resolvedData = structuredClone(reportData);
  const createdBlobUrls = [];
  const failures = [];

  const occupants = resolvedData?.photos?.occupantsWithPhotos ?? [];

  for (const occ of occupants) {
    occ.resolvedImages = [];

    for (const uuid of occ.imageUuids ?? []) {
      try {
        const blob = await fetchBlobByUuid(uuid); // contrat garanti : Blob | null
        if (!blob) {
          failures.push({ uuid, occupant: occ.nom ?? null, reason: 'NOT_FOUND' });
          continue;
        }
        const url = URL.createObjectURL(blob);
        createdBlobUrls.push(url);
        occ.resolvedImages.push(url);
      } catch (error) {
        failures.push({ uuid, occupant: occ.nom ?? null, reason: 'RESOLUTION_ERROR', error });
      }
    }
  }

  return { resolvedData, createdBlobUrls, failures };
};

/** Libère les blob: URLs après génération du PDF. Idempotent. */
export const revokePdfImageBlobUrls = (createdBlobUrls = []) => {
  for (const url of createdBlobUrls) {
    try { URL.revokeObjectURL(url); } catch { /* déjà révoquée : sans effet */ }
  }
};
