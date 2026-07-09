/**
 * Traduit un objet de style provenant de la Sidebar (orienté CSS Web, px)
 * en propriétés supportées par @react-pdf/renderer (orienté pt).
 */
import { DENSITY } from './pdfStyles';

// On réduit drastiquement l'influence des espacements envoyés par la Sidebar
// pour garantir un PDF ultra-compact (priorité au DENSITY core)
const PX_TO_PT = 0.35;

export function adaptSpacerHeight(px) {
  if (!px || px <= 0) return 0;
  return Math.min(px * PX_TO_PT, DENSITY.spacerCap);
}

export function adaptBlockStyle(styleBlock = {}) {
  const out = {};
  
  if (styleBlock.fontSize != null) {
      out.fontSize = styleBlock.fontSize * PX_TO_PT;
  }
  
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
  
  if (styleBlock.marginTop != null) {
      out.marginTop = Math.min(styleBlock.marginTop * PX_TO_PT, DENSITY.spacerCap);
  }
  
  if (styleBlock.marginBottom != null) {
      out.marginBottom = Math.min(styleBlock.marginBottom * PX_TO_PT, DENSITY.spacerCap);
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
