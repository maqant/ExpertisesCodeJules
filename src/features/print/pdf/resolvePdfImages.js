export const resolvePdfImageBlobUrls = async (reportData, fetchBlobByUuid = null) => {
  // Copie profonde pour éviter de muter l'objet original
  const resolvedData = JSON.parse(JSON.stringify(reportData));

  if (!resolvedData.photos || !resolvedData.photos.occupantsWithPhotos) {
    return resolvedData;
  }

  for (const occ of resolvedData.photos.occupantsWithPhotos) {
    occ.resolvedImages = [];

    // Si le projet a un mécanisme existant injecté pour récupérer par UUID
    if (occ.imageUuids && fetchBlobByUuid) {
      for (const uuid of occ.imageUuids) {
        try {
          const blob = await fetchBlobByUuid(uuid);
          if (blob) {
            const url = URL.createObjectURL(blob);
            occ.resolvedImages.push(url);
          } else {
            console.warn(`[PDF] Image non trouvée pour l'UUID: ${uuid}`);
            // throw new Error(`[PDF] Image introuvable pour l'UUID: ${uuid}`); // Décommenter pour bloquer la génération
          }
        } catch (e) {
          console.error(`[PDF] Erreur lors de la résolution de l'image ${uuid}`, e);
        }
      }
    }
  }

  return resolvedData;
};

export const revokePdfImageBlobUrls = (resolvedData) => {
  if (!resolvedData?.photos?.occupantsWithPhotos) return;

  resolvedData.photos.occupantsWithPhotos.forEach(occ => {
    if (occ.resolvedImages) {
      occ.resolvedImages.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    }
  });
};
