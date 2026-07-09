import React from 'react';
import { Document, Page } from '@react-pdf/renderer';
import { pdfStyles as styles } from './pdfStyles';

import PDFReportHeader from './components/PDFReportHeader';
import PDFCoordBlock from './components/PDFCoordBlock';
import PDFInfoBlock from './components/PDFInfoBlock';
import PDFCircumstancesBlock from './components/PDFCircumstancesBlock';
import PDFOrganisationBlock from './components/PDFOrganisationBlock';
import PDFFeesTable from './components/PDFFeesTable';
import PDFFeesDetailBlock from './components/PDFFeesDetailBlock';
import PDFImagesBlock from './components/PDFImagesBlock';
import PDFDiversBlock from './components/PDFDiversBlock';
import PDFCustomBlock from './components/PDFCustomBlock';
import PDFMissingBlock from './components/PDFMissingBlock';

// PARITÉ STRICTE : ce switch doit refléter renderBlocksInOrder() de PrintPreviewWeb.jsx.
// Toute modification de l'un impose la modification de l'autre.
export default function PDFReportDocument({ reportData }) {
  if (!reportData) return null;
  const blockStyles = reportData.meta.styles || {};
  const { metadata } = reportData;

  const renderBlock = (key) => {
    switch (true) {
      case key === 'titre':
        return <PDFReportHeader key={key} data={reportData.titre} styleBlock={blockStyles.titre} />;
      case key === 'coord':
        return <PDFCoordBlock key={key} data={reportData.coord} styleBlock={blockStyles.coord} />;
      case key === 'infos':
        return <PDFInfoBlock key={key} data={reportData.infos} styleBlock={blockStyles.infos} />;
      case key === 'cause':
        return <PDFCircumstancesBlock key={key} data={reportData.cause} styleBlock={blockStyles.cause} />;
      case key === 'orga':
        return <PDFOrganisationBlock key={key} data={reportData.orga} styleBlock={blockStyles.orga} metadata={metadata} />;
      case key === 'frais':
        return <PDFFeesTable key={key} data={reportData.frais} styleBlock={blockStyles.frais} metadata={metadata} />;
      case key === 'frais_liste':
        return <PDFFeesDetailBlock key={key} data={reportData.frais} styleBlock={blockStyles.frais_liste || blockStyles.frais} showSubtotals={metadata.showSubtotals} />;
      case key === 'photos':
        return <PDFImagesBlock key={key} data={reportData.photos} styleBlock={blockStyles.photos} />;
      case key === 'divers':
        return <PDFDiversBlock key={key} data={reportData.divers} styleBlock={blockStyles.divers} />;
      case key.startsWith('custom_'): {
        const blockData = reportData.customBlocks?.find(b => b.id === key);
        if (!blockData) {
          console.error(`[PDF PARITY AUDIT] Custom block "${key}" présent dans orderedBlocks mais absent de customBlocks.`);
          return <PDFMissingBlock key={key} blockKey={key} />;
        }
        return <PDFCustomBlock key={key} data={blockData} styleBlock={blockStyles[key]} />;
      }
      default:
        console.error(`[PDF PARITY AUDIT] Bloc inconnu non rendu : "${key}".`);
        return <PDFMissingBlock key={key} blockKey={key} />;
    }
  };

  return (
    <Document
      title="Rapport d'Expertise"
      author="Bureau Yves Péchard"
      subject="Expertise immobilière"
      creator="React-PDF Native Engine"
    >
      <Page size="A4" style={styles.page} wrap>
        {(reportData.meta.orderedBlocks || []).map(renderBlock)}
      </Page>
    </Document>
  );
}
