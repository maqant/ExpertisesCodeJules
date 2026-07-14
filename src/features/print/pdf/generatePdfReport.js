import React from 'react';
import { pdf } from '@react-pdf/renderer';
import PDFReportDocument from './PDFReportDocument';
import { resolvePdfImageBlobUrls, revokePdfImageBlobUrls } from './resolvePdfImages';
import { registerPdfFonts } from './pdfFonts';

export class PdfImageResolutionError extends Error {
  constructor(failures) {
    super(`[PDF] Erreur Critique: ${failures.length} image(s) n'ont pas pu être résolue(s) en Blob URL. La génération du PDF est interrompue pour éviter un rendu incomplet.`);
    this.name = 'PdfImageResolutionError';
    this.failures = failures;
  }
}

export function auditReportParity(reportData) {
  const issues = [];
  const known = ['titre','coord','infos','cause','orga','frais','frais_liste','photos','divers','annexes_libres'];
  for (const key of reportData?.meta?.orderedBlocks || []) {
    if (!known.includes(key) && !key.startsWith('custom_')) issues.push(`Bloc inconnu: ${key}`);
    if (key.startsWith('custom_') && !reportData?.customBlocks?.find(b => b.id === key)) issues.push(`Custom block sans données: ${key}`);
    if (!key.startsWith('custom_') && known.includes(key) && key !== 'frais_liste' && !reportData[key] && key !== 'annexes_libres') issues.push(`Données absentes pour bloc visible: ${key}`);
  }
  if (issues.length) console.error('[PDF PARITY AUDIT]', issues);
  return issues;
}

export const generatePdfReportBlob = async ({ reportData, fetchBlobByUuid }) => {
  if (!reportData) {
    throw new Error("Les données du rapport (reportData) sont requises pour générer le PDF.");
  }

  // 1. Résolution asynchrone des images pour éviter les problèmes de rendu
  const { resolvedData: resolvedReportData, createdBlobUrls, failures } = await resolvePdfImageBlobUrls(reportData, fetchBlobByUuid);

  if (failures.length > 0) {
    // Décision métier explicite : on BLOQUE et on informe l'expert.
    // Un rapport avec photos manquantes n'est pas un rapport.
    revokePdfImageBlobUrls(createdBlobUrls);
    throw new PdfImageResolutionError(failures);
  }

  try {
    // Audit de complétude avant rendu (Parité)
    auditReportParity(resolvedReportData);

    // Enregistrement des polices avant l'instanciation
    registerPdfFonts();

    // 2. Instanciation du document PDF avec les données résolues (Blob URLs)
    const doc = React.createElement(PDFReportDocument, { reportData: resolvedReportData });

    // 3. Génération du Blob via @react-pdf/renderer
    const asPdf = pdf();
    asPdf.updateContainer(doc);
    const blob = await asPdf.toBlob();

    return { blob, resolvedReportData, createdBlobUrls };
  } catch (error) {
    revokePdfImageBlobUrls(createdBlobUrls); // nettoyage en cas d'erreur de React-PDF
    throw error;
  }
};
