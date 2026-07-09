/**
 * Traduit un objet de style provenant de la Sidebar (orienté CSS Web, px)
 * en propriétés supportées par @react-pdf/renderer (orienté pt).
 */
const PX_TO_PT = 0.75;

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
      out.marginTop = styleBlock.marginTop * PX_TO_PT;
  }
  
  if (styleBlock.marginBottom != null) {
      out.marginBottom = styleBlock.marginBottom * PX_TO_PT;
  }

  // Handle borders specifically if specified. 
  // In PrintPreviewWeb, `styleBlock.border === true` applies a border.
  if (styleBlock.border) {
      out.borderWidth = 1;
      out.borderStyle = 'solid';
      out.borderColor = styleBlock.color || '#000000';
      out.padding = 10 * PX_TO_PT;
      out.borderRadius = 3 * PX_TO_PT;
  }
  
  return out;
}
