import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFNull } from 'pdf-lib';

describe('PDF Link Rewrite (GoTo XYZ)', () => {
  it('doit générer une action GoTo de type XYZ avec le top égal à la hauteur de la page cible', async () => {
    const pdfDoc = await PDFDocument.create();
    const page1 = pdfDoc.addPage([595.28, 841.89]);
    const page2 = pdfDoc.addPage([595.28, 841.89]); // Page cible (annexe)

    // Simuler une annotation de lien pointant vers l'URL traceuse
    const annot = pdfDoc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [0, 0, 100, 100],
      A: {
        Type: 'Action',
        S: 'URI',
        URI: 'https://expertises.local/annex/1'
      }
    });
    page1.node.addAnnot(annot);

    // Mock du finalIndex calculé dans ExpertiseContext
    const finalIndex = [
      { id: '1', startPage: 2 } // 1-indexé
    ];

    // --- Logique de réécriture copiée depuis ExpertiseContext.jsx ---
    const annots = page1.node.Annots();
    for (let a = 0; a < annots.size(); a++) {
      const aNode = annots.lookup(a);
      if (aNode && aNode.lookup(PDFName.of('Subtype')) === PDFName.of('Link')) {
        const action = aNode.lookup(PDFName.of('A'));
        if (action) {
          const uri = action.lookup(PDFName.of('URI'));
          if (uri) {
            const uriStr = uri.decodeText ? uri.decodeText() : String(uri);
            if (uriStr.includes('https://expertises.local/annex/')) {
              const expId = uriStr.split('/annex/')[1].replace(')', '').replace('(', '');
              const targetAnnex = finalIndex.find(x => x.id === expId);
              if (targetAnnex) {
                const targetPageObj = pdfDoc.getPage(targetAnnex.startPage - 1);
                const targetPageRef = targetPageObj.ref;
                const targetHeight = targetPageObj.getHeight();
                
                const newAction = pdfDoc.context.obj({
                  Type: 'Action',
                  S: 'GoTo',
                  D: [
                    targetPageRef, 
                    'XYZ', 
                    0, 
                    targetHeight, 
                    null
                  ]
                });
                aNode.set(PDFName.of('A'), newAction);
              }
            }
          }
        }
      }
    }

    // --- Assertions ---
    const modifiedAnnot = page1.node.Annots().lookup(0);
    const modifiedAction = modifiedAnnot.lookup(PDFName.of('A'));
    
    // Le lien doit être de type GoTo
    expect(modifiedAction.lookup(PDFName.of('S'))).toBe(PDFName.of('GoTo'));
    
    const destination = modifiedAction.lookup(PDFName.of('D'));
    
    // La destination doit utiliser le mode XYZ
    expect(destination.lookup(1)).toBe(PDFName.of('XYZ'));
    
    // Left = 0 (can be read as Number value)
    expect(Number(destination.lookup(2))).toBe(0);
    
    // Top = targetHeight (841.89)
    expect(Number(destination.lookup(3))).toBeCloseTo(841.89, 2);
  });
});
