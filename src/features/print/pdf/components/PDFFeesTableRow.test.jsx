import { describe, it, expect } from 'vitest';
import PDFFeesTableRow from './PDFFeesTableRow';

describe('PDFFeesTableRow', () => {
  it('doit utiliser wrap={false} et afficher annexReference avec le style correct', () => {
    const exp = {
      id: '1',
      prestataire: 'Test',
      type: 'Test',
      desc: 'Test',
      annexReference: 'Ref 123',
      montant: '100',
    };

    // PDFFeesTableRow est une fonction qui retourne l'arbre de propriétés de composant
    const element = PDFFeesTableRow({ exp, index: 1 });
    
    // Le container parent doit avoir wrap={false}
    expect(element.props.wrap).toBe(false);

    const children = element.props.children;
    // Index 3 correspond à la cellule de description
    const descCell = children[3];
    const descChildren = descCell.props.children;
    
    // L'annexe référence se trouve au 2eme enfant de la description, encapsulé dans un <Link>
    const linkNode = descChildren[1];
    expect(linkNode).toBeTruthy();
    expect(linkNode.props.src).toBe('https://expertises.local/annex/1');
    
    const annexNode = linkNode.props.children;
    expect(annexNode.props.children).toBe('Ref 123');
    // Le style doit correspondre exactement aux spécifications du design system
    expect(annexNode.props.style.fontStyle).toBe('italic');
    expect(annexNode.props.style.color).toBe('#64748b');
  });
});
