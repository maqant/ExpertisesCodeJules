import { StyleSheet } from '@react-pdf/renderer';

export const COLORS = {
  text: '#1e293b',
  tableBorder: '#94a3b8',
  cardBg: '#f1f5f9',
  cardBorder: '#94a3b8',
  cardResponsibleBg: '#fff7ed',
  cardResponsibleBorder: '#fed7aa',
};

export const solidBorder = (width = 1, color = COLORS.cardBorder) => ({
  borderWidth: width,
  borderColor: color,
  borderStyle: 'solid',
});

export const DENSITY = {
  // Page
  pageMarginV: 28,          // pt (~1cm)
  pageMarginH: 32,

  // Typographie
  fontBase: 8.5,            // pt
  fontTitle: 10,            // titres de section
  fontSmall: 7,             // mentions, pagination annexes
  lineHeight: 1.05,         // texte courant — plancher absolu technique
  lineHeightTight: 1.0,     // tableaux uniquement

  // Espacement vertical global (Tokens centraux)
  blockGap: 4,              // espace entre sections (très compact)
  headerGap: 4,             // sous le PDFReportHeader
  sectionInnerGap: 1,       // espacements internes de section
  itemGap: 2,               // entre items d'une liste (annexes, photos)
  keepWithNext: 24,         // minPresenceAhead minimal : titre + 1 ligne
  sectionTitleGap: 1,
  lineGap: 0,               // intra-bloc : aucun espace additionnel
  subBlockIndent: 6,

  // Cartes occupants (organisation)
  occupantIndent: 12,       // décalage par niveau de profondeur
  occupantGap: 1,           // entre cartes
  occupantPadding: 2,
  occupantPaddingResponsible: 2,

  // Blocs bordés
  borderedPadding: 2,
  borderRadius: 2,

  // Tableaux
  cellPaddingV: 1,          // plancher absolu
  cellPaddingH: 4,
  tableHeaderPaddingV: 2,

  // Spacers
  spacerCap: 4,
};

export const pdfStyles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    paddingVertical: DENSITY.pageMarginV,
    paddingHorizontal: DENSITY.pageMarginH,
  },
  section: {
    marginBottom: DENSITY.blockGap,
  },
  sectionTitle: {
    fontSize: DENSITY.fontTitle,
    fontWeight: 'bold',
    marginBottom: DENSITY.sectionTitleGap,
    marginTop: 2,
    color: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 1,
  },
  bodyText: {
    fontSize: DENSITY.fontBase,
    lineHeight: DENSITY.lineHeight,
    marginBottom: DENSITY.lineGap,
  },
  block: {
    marginBottom: DENSITY.blockGap,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 10,
    textAlign: 'center',
  },
  text: {
    fontSize: DENSITY.fontBase,
    color: '#334155',
    lineHeight: DENSITY.lineHeight,
    marginBottom: DENSITY.lineGap,
  },
  mutedText: {
    fontSize: DENSITY.fontSmall,
    color: '#64748b',
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRightWidth: 0,
    borderBottomWidth: 0,
    marginTop: 10,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableHeader: {
    backgroundColor: '#f8fafc',
  },
  tableHeaderCell: {
    padding: DENSITY.tableHeaderPaddingV,
    fontSize: DENSITY.fontBase,
    fontWeight: 'bold',
    color: '#1e293b',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  tableCell: {
    paddingVertical: DENSITY.cellPaddingV,
    paddingHorizontal: DENSITY.cellPaddingH,
    fontSize: DENSITY.fontBase,
    color: '#334155',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  descriptionCell: {
    flex: 3,
  },
  amountCell: {
    flex: 1,
    textAlign: 'right',
  },
  annexReference: {
    fontSize: DENSITY.fontSmall,
    fontStyle: 'italic',
    color: '#64748b',
  },
  tocContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tocTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#0f172a',
  },
  tocDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    marginVertical: 5,
  },
  tocItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingLeft: 10,
  },
  tocLink: {
    fontSize: 11,
    color: '#2563eb',
    textDecoration: 'none',
  }
});
