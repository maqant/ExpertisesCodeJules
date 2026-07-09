import React from 'react';
import { Document, Page, View, Text, Link } from '@react-pdf/renderer';
import { pdfStyles as styles } from './pdfStyles';
import { PDF_SECTIONS } from './pdfSections';

export default function PDFReportDocument({ reportData }) {
  const { title = "Rapport d'Expertise", sections = {} } = reportData || {};

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Page de titre */}
        <View style={styles.section}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Document de synthèse</Text>
        </View>

        {/* Sommaire */}
        <View style={styles.section} wrap={false}>
          <Text id={PDF_SECTIONS.SUMMARY} style={styles.tocTitle}>Sommaire</Text>
          <View style={styles.tocItem}>
            <Link src={`#${PDF_SECTIONS.GENERAL}`}>
              <Text style={styles.tocLink}>Informations Générales</Text>
            </Link>
          </View>
          <View style={styles.tocItem}>
            <Link src={`#${PDF_SECTIONS.CIRCUMSTANCES}`}>
              <Text style={styles.tocLink}>Circonstances</Text>
            </Link>
          </View>
          <View style={styles.tocItem}>
            <Link src={`#${PDF_SECTIONS.ORGANISATION}`}>
              <Text style={styles.tocLink}>Organisation</Text>
            </Link>
          </View>
          <View style={styles.tocItem}>
            <Link src={`#${PDF_SECTIONS.FEES}`}>
              <Text style={styles.tocLink}>Frais</Text>
            </Link>
          </View>
          {sections.annexes && (
            <View style={styles.tocItem}>
              <Link src={`#${PDF_SECTIONS.ANNEXES}`}>
                <Text style={styles.tocLink}>Annexes</Text>
              </Link>
            </View>
          )}
        </View>

        {/* Section Informations Générales */}
        <View style={styles.section} wrap={false}>
          <Text id={PDF_SECTIONS.GENERAL} style={styles.sectionTitle}>Informations Générales</Text>
          <Text style={styles.text}>Contenu des informations générales...</Text>
        </View>

        {/* Section Circonstances */}
        <View style={styles.section} wrap={false}>
          <Text id={PDF_SECTIONS.CIRCUMSTANCES} style={styles.sectionTitle}>Circonstances</Text>
          <Text style={styles.text}>Contenu des circonstances...</Text>
        </View>

        {/* Section Organisation */}
        <View style={styles.section} wrap={false}>
          <Text id={PDF_SECTIONS.ORGANISATION} style={styles.sectionTitle}>Organisation</Text>
          <Text style={styles.text}>Contenu de l'organisation...</Text>
        </View>

        {/* Section Frais */}
        <View style={styles.section} wrap={false}>
          <Text id={PDF_SECTIONS.FEES} style={styles.sectionTitle}>Frais</Text>
          
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={[styles.tableHeaderCell, styles.descriptionCell]}>Description</Text>
              <Text style={[styles.tableHeaderCell, styles.amountCell]}>Montant</Text>
            </View>
            <View style={styles.tableRow}>
              <View style={[styles.tableCell, styles.descriptionCell]}>
                <Text>Frais de déplacement</Text>
                {/* Exemple d'utilisation de annexReference demandée */}
                <Text style={styles.annexReference}>Réf. Annexe 1</Text>
              </View>
              <Text style={[styles.tableCell, styles.amountCell]}>150.00 €</Text>
            </View>
          </View>
        </View>

        {/* Section Annexes (Conditionnelle) */}
        {sections.annexes && (
          <View style={styles.section} wrap={false}>
            <Text id={PDF_SECTIONS.ANNEXES} style={styles.sectionTitle}>Annexes</Text>
            <Text style={styles.text}>Contenu des annexes...</Text>
          </View>
        )}

      </Page>
    </Document>
  );
}
