import React from 'react';
import { Document, Page, View, Text, Link } from '@react-pdf/renderer';
import { pdfStyles as styles } from './pdfStyles';
import { PDF_SECTIONS } from './pdfSections';
import PDFInfoBlock from './components/PDFInfoBlock';
import PDFFeesTable from './components/PDFFeesTable';
import PDFAnnexesBlock from './components/PDFAnnexesBlock';
import PDFImagesBlock from './components/PDFImagesBlock';
import PDFTextBlock from './components/PDFTextBlock';

export default function PDFReportDocument({ reportData }) {
  if (!reportData) return null;
  const { meta, titre, infos, cause, orga, frais, photos } = reportData;
  const blocks = meta?.orderedBlocks || [];

  const getSectionTitle = (key) => {
    switch (key) {
      case 'infos': return 'Informations Générales';
      case 'cause': return 'Circonstances';
      case 'orga': return 'Organisation';
      case 'frais': return 'Frais';
      case 'photos': return 'Images';
      default: return 'Section';
    }
  };

  const getSectionId = (key) => {
    switch (key) {
      case 'infos': return PDF_SECTIONS.GENERAL;
      case 'cause': return PDF_SECTIONS.CIRCUMSTANCES;
      case 'orga': return PDF_SECTIONS.ORGANISATION;
      case 'frais': return PDF_SECTIONS.FEES;
      case 'photos': return PDF_SECTIONS.IMAGES;
      default: return key;
    }
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Page de titre */}
        <View style={styles.section}>
          <Text style={styles.title}>Rapport d'Expertise</Text>
          <Text style={styles.subtitle}>Document de synthèse</Text>
        </View>

        {/* Sommaire */}
        <View style={styles.section} wrap={false}>
          <Text id={PDF_SECTIONS.SUMMARY} style={styles.tocTitle}>Sommaire</Text>
          {blocks.filter(b => b !== 'titre' && b !== 'coord').map(key => (
            <View key={key} style={styles.tocItem}>
              <Link src={`#${getSectionId(key)}`}>
                <Text style={styles.tocLink}>{getSectionTitle(key)}</Text>
              </Link>
            </View>
          ))}
        </View>

        {/* Dynamic Blocks */}
        {blocks.map(key => {
          if (key === 'infos') return <PDFInfoBlock key={key} id={PDF_SECTIONS.GENERAL} title={infos?.title || "Informations Générales"} data={infos} />;
          if (key === 'cause') return <PDFTextBlock key={key} id={PDF_SECTIONS.CIRCUMSTANCES} title={cause?.title || "Circonstances"} content={cause?.formDataCause} />;
          if (key === 'orga') return <PDFTextBlock key={key} id={PDF_SECTIONS.ORGANISATION} title={orga?.title || "Organisation"} content="Détails de l'organisation..." />;
          if (key === 'frais') return <PDFFeesTable key={key} id={PDF_SECTIONS.FEES} title={frais?.title || "Frais"} data={frais} />;
          if (key === 'photos') return <PDFImagesBlock key={key} id={PDF_SECTIONS.IMAGES} title={photos?.title || "Images"} data={photos} />;
          return null;
        })}
      </Page>
    </Document>
  );
}
