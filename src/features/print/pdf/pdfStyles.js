import { StyleSheet } from '@react-pdf/renderer';

export const DENSITY = {
  // Page
  pageMarginV: 28,          // pt (~1cm) — au lieu des marges par défaut
  pageMarginH: 32,

  // Typographie
  fontBase: 8.5,            // pt — lisible en impression, dense
  fontTitle: 10,            // titres de section
  fontSmall: 7,             // mentions, pagination annexes
  lineHeight: 1.18,         // seuil plancher de lisibilité. NE PAS descendre sous 1.15

  // Espacement vertical
  blockGap: 6,              // marginBottom entre blocs (au lieu de 20)
  sectionTitleGap: 3,       // sous les titres (au lieu de 8)
  lineGap: 1.5,             // entre Text intra-bloc (au lieu de 5)
  subBlockIndent: 8,        // au lieu de 15 (contradictoire)

  // Blocs bordés
  borderedPadding: 4,       // au lieu de 7.5
  borderRadius: 2,

  // Tableaux
  cellPaddingV: 2,
  cellPaddingH: 4,
  tableHeaderPaddingV: 3,

  // Blocs vides
  emptyBlockGap: 3,         // un bloc vide = 1 ligne + 3pt, rien d'autre

  // Spacers
  spacerCap: 12,            // plafond absolu en pt
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
    marginTop: 8,
    color: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 2,
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
