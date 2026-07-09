import React from 'react';
import { Document, Page, View, Text, Link } from '@react-pdf/renderer';
import { pdfStyles as styles } from './pdfStyles';
import { PDF_SECTIONS } from './pdfSections';
import PDFInfoBlock from './components/PDFInfoBlock';
import PDFFeesTable from './components/PDFFeesTable';
import PDFAnnexesBlock from './components/PDFAnnexesBlock';
import PDFImagesBlock from './components/PDFImagesBlock';
import PDFTextBlock from './components/PDFTextBlock';

const SECTION_LABELS = {
  infos: 'Informations Générales',
  cause: 'Circonstances',
  orga: 'Organisation',
  frais: 'Frais',
  frais_liste: 'Détail des Frais',
  photos: 'Annexes Photographiques',
  divers: 'Divers & Remarques',
};

const SECTION_IDS = {
  infos: PDF_SECTIONS.GENERAL,
  cause: PDF_SECTIONS.CIRCUMSTANCES,
  orga: PDF_SECTIONS.ORGANISATION,
  frais: PDF_SECTIONS.FEES,
  frais_liste: PDF_SECTIONS.FEES,
  photos: PDF_SECTIONS.IMAGES,
  divers: 'divers',
};

export default function PDFReportDocument({ reportData }) {
  if (!reportData) return null;
  const { meta, titre, coord, infos, cause, orga, frais, photos, divers } = reportData;
  const blocks = meta?.orderedBlocks || [];

  // Filtrer les blocs visibles pour le sommaire (exclure titre/coord qui sont l'en-tête)
  const tocBlocks = blocks.filter(b => b !== 'titre' && b !== 'coord' && SECTION_LABELS[b]);

  return (
    <Document
      title="Rapport d'Expertise"
      author="Bureau Yves Péchard"
      subject="Expertise immobilière"
      creator="React-PDF Native Engine"
    >
      {/* ====== PAGE 1 : Titre + Sommaire ====== */}
      <Page size="A4" style={styles.page}>
        {/* En-tête du rapport */}
        <View style={styles.section}>
          <Text style={styles.title}>Rapport d'Expertise</Text>
          <Text style={styles.subtitle}>
            {titre?.formData?.refPechard ? `Réf. ${titre.formData.refPechard}` : 'Document de synthèse'}
          </Text>
          {titre?.formData?.dateExp && (
            <Text style={[styles.mutedText, { textAlign: 'center', marginTop: 5 }]}>
              Date d'expertise : {new Date(titre.formData.dateExp).toLocaleDateString('fr-FR')}
              {titre.formData.heureExp ? ` à ${titre.formData.heureExp}` : ''}
            </Text>
          )}
        </View>

        {/* Coordonnées si présentes */}
        {coord && (
          <View style={[styles.section, { marginTop: 10 }]}>
            {coord.formData?.adresse && (
              <Text style={styles.text}>📍 {coord.formData.adresse}</Text>
            )}
            {coord.formData?.franchise && (
              <Text style={styles.text}>Franchise : {coord.formData.franchise}</Text>
            )}
          </View>
        )}

        {/* Sommaire Interactif */}
        {tocBlocks.length > 1 && (
          <View style={[styles.tocContainer, { marginTop: 20 }]} wrap={false}>
            <Text id={PDF_SECTIONS.SUMMARY} style={styles.tocTitle}>Sommaire</Text>
            <View style={styles.tocDivider} />
            {tocBlocks.map((key, idx) => (
              <View key={key} style={styles.tocItem}>
                <Link src={`#${SECTION_IDS[key] || key}`} style={{ textDecoration: 'none' }}>
                  <Text style={styles.tocLink}>
                    {idx + 1}. {SECTION_LABELS[key]}
                  </Text>
                </Link>
              </View>
            ))}
            <View style={styles.tocDivider} />
          </View>
        )}

        {/* Marqueur de preuve du moteur React-PDF */}
        <Text style={{ fontSize: 6, color: '#e2e8f0', marginTop: 'auto', textAlign: 'center' }}>
          DEBUG PDF ENGINE: React-PDF native
        </Text>
      </Page>

      {/* ====== PAGES SUIVANTES : Contenu dynamique ====== */}
      <Page size="A4" style={styles.page} wrap>
        {blocks.map(key => {
          if (key === 'titre' || key === 'coord') return null;
          if (key === 'infos') return <PDFInfoBlock key={key} id={PDF_SECTIONS.GENERAL} title={infos?.title || 'Informations Générales'} data={infos} />;
          if (key === 'cause') return <PDFTextBlock key={key} id={PDF_SECTIONS.CIRCUMSTANCES} title={cause?.title || 'Circonstances'} content={cause?.formDataCause} />;
          if (key === 'orga') return <PDFTextBlock key={key} id={PDF_SECTIONS.ORGANISATION} title={orga?.title || 'Organisation'} content={orga?.occupantsHierarchy?.map(o => `${o.formattedNomPrenom} — ${o.statut}`).join('\n') || ''} />;
          if (key === 'frais') return <PDFFeesTable key={key} id={PDF_SECTIONS.FEES} title={frais?.title || 'Frais'} data={frais} />;
          if (key === 'photos') return <PDFImagesBlock key={key} id={PDF_SECTIONS.IMAGES} title={photos?.title || 'Images'} data={photos} />;
          if (key === 'divers') return <PDFTextBlock key={key} id="divers" title={divers?.title || 'Divers'} content={divers?.formDataDivers} />;
          return null;
        })}
      </Page>
    </Document>
  );
}
