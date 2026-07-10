/**
 * Traduit un objet de style provenant de la Sidebar (orienté CSS Web, px)
 * en propriétés supportées par @react-pdf/renderer (orienté pt).
 */
import { DENSITY } from './pdfStyles';

const PX_TO_PT = 0.75;

export function adaptSpacerHeight(px) {
  if (!px || px <= 0) return 0;
  return Math.min(px * PX_TO_PT, DENSITY.spacerCap);
}

export function adaptBlockStyle(styleBlock = {}) {
  const out = {};
  
  // ⚠️ fontSize, marginTop, marginBottom sont VOLONTAIREMENT EXCLUS.
  // Le PDF a son propre design system (DENSITY) et ne doit JAMAIS hériter
  // du sizing/spacing de la sidebar web. Seules les propriétés visuelles passent.
  
  if (styleBlock.color) {
      out.color = styleBlock.color;
  }
  
  if (styleBlock.backgroundColor) {
      out.backgroundColor = styleBlock.backgroundColor;
  }
  
  if (styleBlock.textAlign) {
      out.textAlign = styleBlock.textAlign;
  }
  
  if (styleBlock.fontWeight) {
      out.fontWeight = styleBlock.fontWeight === 'bold' ? 'bold' : 'normal';
  }
  
  if (styleBlock.fontStyle === 'italic') {
      out.fontStyle = 'italic';
  }

  // Handle borders specifically if specified. 
  // In PrintPreviewWeb, `styleBlock.border === true` applies a border.
  if (styleBlock.border) {
      out.borderWidth = 1;
      out.borderStyle = 'solid';
      out.borderColor = styleBlock.color || '#000000';
      out.padding = DENSITY.borderedPadding;
      out.borderRadius = DENSITY.borderRadius;
  }
  
  return out;
}
