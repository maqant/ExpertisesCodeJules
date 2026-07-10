import { rgb } from 'pdf-lib';

/**
 * Layout de la pagination — source de vérité unique pour le texte ET la zone
 * cliquable. Toute évolution du positionnement se fait ici, nulle part ailleurs.
 */
const PAGINATION_LAYOUT = {
  textOffsetX: 60,  // distance du texte depuis le bord droit
  textY: 20,
  fontSize: 10,
  // Zone cliquable englobant le texte avec marge de confort
  linkPadding: { left: 5, right: 5, bottom: 5, top: 13 },
};

/** Hauteur A4 en points PDF — fallback si la page 1 a une géométrie invalide. */
const A4_HEIGHT_PT = 842;

/**
 * Ajoute la pagination "Page X" en bas à droite de chaque page,
 * avec un lien cliquable renvoyant au SOMMET de la première page,
 * en conservant le niveau de zoom courant de l'utilisateur.
 *
 * À appeler EN DERNIER dans le post-traitement, après toute fusion,
 * suppression ou réordonnancement de pages.
 *
 * @param {import('pdf-lib').PDFDocument} pdfDoc - Document fusionné final.
 * @param {number} startPageNum - Le numéro à afficher sur la première page de la boucle.
 */
export function addPageNumbersWithHomeLink(pdfDoc, startPageNum = 1) {
  const allPages = pdfDoc.getPages();
  if (allPages.length === 0) return;

  const firstPageRef = allPages[0].ref;

  // Hauteur de la PAGE CIBLE (page 1), lue une seule fois hors boucle.
  // Ne pas confondre avec la hauteur de la page portant le lien : dans un
  // document fusionné, les formats peuvent être hétérogènes (A4, paysage…).
  const { height: rawFirstPageHeight } = allPages[0].getSize();
  const firstPageTop =
    Number.isFinite(rawFirstPageHeight) && rawFirstPageHeight > 0
      ? rawFirstPageHeight
      : A4_HEIGHT_PT;

  if (firstPageTop !== rawFirstPageHeight) {
    console.warn(
      `[pdf/pagination] Hauteur de page 1 invalide (${rawFirstPageHeight}), ` +
        `fallback A4 (${A4_HEIGHT_PT}pt) pour la destination du lien.`
    );
  }

  const { textOffsetX, textY, fontSize, linkPadding } = PAGINATION_LAYOUT;

  allPages.forEach((page, index) => {
    const pageNum = startPageNum + index;
    const { width } = page.getSize();

    // 1. Texte de pagination — comportement existant préservé à l'identique
    page.drawText(`Page ${pageNum}`, {
      x: width - textOffsetX,
      y: textY,
      size: fontSize,
      color: rgb(0.3, 0.3, 0.3),
    });

    // 2. Lien retour page 1 — inutile sur la page 1 elle-même
    if (pageNum === 1) return;

    try {
      const linkAnnotation = pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        // Zone cliquable dérivée du layout du texte : couplage explicite,
        // [x1, y1, x2, y2] en coordonnées PDF (origine bas-gauche)
        Rect: [
          width - textOffsetX - linkPadding.left,
          textY - linkPadding.bottom,
          width - linkPadding.right,
          textY + linkPadding.top,
        ],
        Border: [0, 0, 0], // aucune bordure visible
        // XYZ (left=0, top=hauteur page 1, zoom=null) :
        // positionne la vue au sommet de la page 1 SANS modifier
        // le niveau de zoom courant de l'utilisateur (spec PDF §12.3.2.2).
        Dest: [firstPageRef, 'XYZ', 0, firstPageTop, null],
      });
      const linkRef = pdfDoc.context.register(linkAnnotation);
      page.node.addAnnot(linkRef);
    } catch (err) {
      // Le lien est cosmétique : ne doit jamais bloquer la génération
      // du rapport, mais l'échec doit être VISIBLE, jamais silencieux.
      console.error(
        `[pdf/pagination] Échec création du lien retour page 1 sur la page ${pageNum} :`,
        err
      );
    }
  });
}
