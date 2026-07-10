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

// ============================================================
// CONTRAT TYPOGRAPHIQUE — SOURCE DE VÉRITÉ UNIQUE
// ------------------------------------------------------------
// RÈGLE ABSOLUE : le lineHeight est TOUJOURS exprimé en points
// absolus, pré-calculé ici. Aucune valeur relative (unitless)
// ne doit jamais atteindre le moteur de @react-pdf/renderer.
// Motif : la résolution relative dépend du fontSize présent au
// même nœud lors du flattening ; en son absence, le moteur
// multiplie contre 18pt (défaut) → espacements incohérents.
// ------------------------------------------------------------
// Ratios calibrés métriques AFM Helvetica + français accentué :
//   1.22 corps de texte (confort légal, compact)
//   1.12 tableaux (PLANCHER PHYSIQUE — capitales accentuées É/À)
//   1.15 titres
// ============================================================

const LH_RATIO = {
  body: 1.22,
  tight: 1.12,   // plancher absolu — ne JAMAIS descendre en dessous
  heading: 1.15,
};

/**
 * Factory typographique : produit une paire insécable
 * fontSize / lineHeight (en points absolus).
 * @param {number} size  - corps en pt
 * @param {number} ratio - ratio de hauteur de ligne (défaut : corps)
 * @param {object} extra - propriétés additionnelles (color, fontWeight…)
 */
export const typo = (size, ratio = LH_RATIO.body, extra = {}) => ({
  fontSize: size,
  lineHeight: Math.round(size * ratio * 10) / 10, // pt ABSOLUS
  ...extra,
});

export const DENSITY = {
  // Page
  pageMarginV: 28,          // pt (~1cm)
  pageMarginH: 32,

  // Typographie (les lineHeights vivent dans TYPO)
  fontBase: 8.5,            // pt
  fontTitle: 10,            // titres de section
  fontSmall: 7,             // mentions, pagination annexes

  // Espacement vertical global (Tokens centraux)
  blockGap: 8,              // espace entre sections — bien séparer les blocs
  headerGap: 4,             // sous le PDFReportHeader
  sectionInnerGap: 1,       // espacements internes de section — quasi nul
  itemGap: 3,               // entre items d'une liste (annexes, photos)
  keepWithNext: 24,         // minPresenceAhead minimal : titre + 1 ligne
  sectionTitleGap: 1,       // contenu collé au titre
  lineGap: 0,               // intra-bloc : aucun espacement additionnel
  subBlockIndent: 8,        

  // Cartes occupants (organisation)
  occupantIndent: 14,       // décalage par niveau de profondeur
  occupantGap: 2,           // entre cartes
  occupantPadding: 2,
  occupantPaddingResponsible: 3,

  // Blocs bordés
  borderedPadding: 4,       
  borderRadius: 2,

  // Tableaux
  cellPaddingV: 1,          // plancher absolu
  cellPaddingH: 4,
  tableHeaderPaddingV: 2,

  // Spacers
  spacerCap: 12,            
};

// Tokens typographiques nommés — SEUL point d'entrée autorisé
// pour tout <Text> du module print.
export const TYPO = {
  body:       typo(DENSITY.fontBase),                                        // 8.5 / 10.4pt
  bodyBold:   typo(DENSITY.fontBase, LH_RATIO.body, { fontWeight: 'bold' }),
  small:      typo(DENSITY.fontSmall),                                       // 7 / 8.5pt
  smallMuted: typo(DENSITY.fontSmall, LH_RATIO.body, { color: '#64748b' }),
  tableCell:  typo(DENSITY.fontBase, LH_RATIO.tight),                        // 8.5 / 9.5pt
  heading:    typo(DENSITY.fontTitle, LH_RATIO.heading, { fontWeight: 'bold' }),
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
    ...TYPO.heading,
    marginBottom: DENSITY.sectionTitleGap,
    color: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 2,
  },
  bodyText: {
    ...TYPO.body,
    color: COLORS.text,
    marginBottom: DENSITY.lineGap,
  },
  bodyLabel: {
    ...TYPO.bodyBold,
    color: COLORS.text,
  },
  block: {
    marginBottom: DENSITY.blockGap,
  },
  title: {
    ...typo(24, LH_RATIO.heading, { fontWeight: 'bold' }),
    marginBottom: 20,
    textAlign: 'center',
    color: '#1e293b',
  },
  subtitle: {
    ...typo(14, LH_RATIO.heading),
    color: '#475569',
    marginBottom: 10,
    textAlign: 'center',
  },
  text: {
    ...TYPO.body,
    color: '#334155',
    marginBottom: DENSITY.lineGap,
  },
  mutedText: {
    ...TYPO.smallMuted,
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
    ...typo(DENSITY.fontBase, LH_RATIO.tight, { fontWeight: 'bold' }),
    padding: DENSITY.tableHeaderPaddingV,
    color: '#1e293b',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  tableCell: {
    ...TYPO.tableCell,
    paddingVertical: DENSITY.cellPaddingV,
    paddingHorizontal: DENSITY.cellPaddingH,
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
    ...typo(DENSITY.fontSmall, LH_RATIO.body, { fontStyle: 'italic', color: '#64748b' }),
  },
  tocContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tocTitle: {
    ...typo(18, LH_RATIO.heading, { fontWeight: 'bold' }),
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
    ...typo(11, LH_RATIO.body, { color: '#2563eb' }),
    textDecoration: 'none',
  }
});
