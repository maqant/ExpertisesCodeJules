import React from 'react';
import { pdf } from '@react-pdf/renderer';
import PDFReportDocument from './PDFReportDocument';
import { resolvePdfImageBlobUrls } from './resolvePdfImages';

export const generatePdfReportBlob = async ({ reportData, fetchBlobByUuid }) => {
  if (!reportData) {
    throw new Error("Les données du rapport (reportData) sont requises pour générer le PDF.");
  }

  // 1. Résolution asynchrone des images pour éviter les problèmes de rendu
  const resolvedReportData = await resolvePdfImageBlobUrls(reportData, fetchBlobByUuid);

  // Sécurité: Vérifier qu'aucun UUID brut ne passe au PDF
  if (resolvedReportData.photos && resolvedReportData.photos.occupantsWithPhotos) {
    resolvedReportData.photos.occupantsWithPhotos.forEach(occ => {
      // Si on attendait des images via imageUuids, on doit s'assurer que resolvedImages contient autant d'URL résolues
      if (occ.imageUuids && occ.imageUuids.length > 0) {
        if (!occ.resolvedImages || occ.resolvedImages.length !== occ.imageUuids.length) {
          throw new Error(`[PDF] Erreur Critique: L'image UUID n'a pas pu être résolue en Blob URL pour ${occ.nom}. La génération du PDF est interrompue pour éviter un rendu incomplet.`);
        }
      }
    });
  }

  // 2. Instanciation du document PDF avec les données résolues (Blob URLs)
  const doc = <PDFReportDocument reportData={resolvedReportData} />;

  // 3. Génération du Blob via @react-pdf/renderer
  const asPdf = pdf();
  asPdf.updateContainer(doc);
  const blob = await asPdf.toBlob();

  return { blob, resolvedReportData };
};
