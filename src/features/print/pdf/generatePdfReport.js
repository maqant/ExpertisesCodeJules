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

  // 2. Instanciation du document PDF avec les données résolues (Blob URLs)
  const doc = <PDFReportDocument reportData={resolvedReportData} />;

  // 3. Génération du Blob via @react-pdf/renderer
  const asPdf = pdf();
  asPdf.updateContainer(doc);
  const blob = await asPdf.toBlob();

  return { blob, resolvedReportData };
};
