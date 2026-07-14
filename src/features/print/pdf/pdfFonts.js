import { Font } from '@react-pdf/renderer';

import regularFont from './fonts/Arimo/Arimo-Regular.ttf';
import boldFont from './fonts/Arimo/Arimo-Bold.ttf';
import italicFont from './fonts/Arimo/Arimo-Italic.ttf';
import boldItalicFont from './fonts/Arimo/Arimo-BoldItalic.ttf';

let fontsRegistered = false;

export const registerPdfFonts = () => {
  if (fontsRegistered) return;

  try {
    Font.register({
      family: 'Arimo',
      fonts: [
        { src: regularFont },
        { src: boldFont, fontWeight: 'bold' },
        { src: italicFont, fontStyle: 'italic' },
        { src: boldItalicFont, fontWeight: 'bold', fontStyle: 'italic' },
      ],
    });
    fontsRegistered = true;
    console.log('[PDF] Arimo fonts registered successfully.');
  } catch (err) {
    console.error('[PDF] Erreur lors de l\'enregistrement des polices:', err);
    throw new Error('Impossible d\'enregistrer les polices PDF requises.');
  }
};
