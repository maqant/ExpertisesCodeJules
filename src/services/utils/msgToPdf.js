import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import MsgReader from '@kenjiuno/msgreader';

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 50;
const HEADER_LEADING = 16;
const BODY_LEADING = 13;
const BODY_FONT_SIZE = 10;
const FOOTER_RESERVE = 40;

// ---------------------------------------------------------------------------
// COUCHE DE SANITIZATION WINANSI (pure, testable unitairement)
// ---------------------------------------------------------------------------
// Contexte : pdf-lib + polices standard (Helvetica) = encodage WinAnsi (CP1252).
// Les .msg mal décodés exposent des points de code C1 (U+0080–U+009F) qui sont
// en réalité des caractères CP1252 (ex: 0x96 = tiret demi-cadratin "–").
// Stratégie : (1) NFC, (2) remap C1 -> Unicode CP1252 réel (encodable WinAnsi),
// (3) whitelist stricte + fallback EXPLICITE (compté, jamais silencieux).

/** Table de correspondance C1 (0x80–0x9F) -> caractère Unicode CP1252 réel. */
const CP1252_C1_REMAP = {
  0x80: '\u20AC', // €
  0x82: '\u201A', 0x83: '\u0192', 0x84: '\u201E', 0x85: '\u2026',
  0x86: '\u2020', 0x87: '\u2021', 0x88: '\u02C6', 0x89: '\u2030',
  0x8A: '\u0160', 0x8B: '\u2039', 0x8C: '\u0152', 0x8E: '\u017D',
  0x91: '\u2018', 0x92: '\u2019', 0x93: '\u201C', 0x94: '\u201D',
  0x95: '\u2022',
  0x96: '\u2013', // – (EN DASH — le coupable du bug)
  0x97: '\u2014', // —
  0x98: '\u02DC', 0x99: '\u2122', 0x9A: '\u0161', 0x9B: '\u203A',
  0x9C: '\u0153', 0x9E: '\u017E', 0x9F: '\u0178',
};

/** Points de code Unicode > 0xFF encodables en WinAnsi (les valeurs du remap). */
const WINANSI_EXTENDED = new Set(
  Object.values(CP1252_C1_REMAP).map((c) => c.codePointAt(0))
);

/** Remplacements de confort pour caractères Unicode fréquents hors WinAnsi. */
const UNICODE_FALLBACKS = {
  '\u2010': '-', '\u2011': '-', '\u2012': '-', '\u2015': '-', // variantes de tirets
  '\u2212': '-',                                              // signe moins
  '\u00AD': '',                                               // soft hyphen
  '\u200B': '', '\u200C': '', '\u200D': '', '\uFEFF': '',     // zero-width / BOM
  '\u2028': '\n', '\u2029': '\n',                             // séparateurs de ligne
  '\u202F': ' ', '\u2007': ' ', '\u2009': ' ',                // espaces fines
};

/** Un point de code est-il encodable en WinAnsi ? */
const isWinAnsiEncodable = (cp) =>
  (cp >= 0x20 && cp <= 0x7E) ||   // ASCII imprimable
  (cp >= 0xA0 && cp <= 0xFF) ||   // Latin-1 haut
  WINANSI_EXTENDED.has(cp);       // extensions CP1252 (–, —, €, …, etc.)

/**
 * Nettoie une chaîne pour l'encodage WinAnsi de pdf-lib.
 * PURE et déterministe. Le '\n' est préservé (géré par wrapText).
 * @param {string} input
 * @returns {{ text: string, replacedCount: number, replacedChars: string[] }}
 */
export function sanitizeWinAnsi(input = '') {
  const src = String(input).normalize('NFC').replace(/\r\n/g, '\n').replace(/\t/g, '    ');
  let out = '';
  let replacedCount = 0;
  const replacedChars = [];

  for (const ch of src) {
    let c = ch;
    const cp0 = c.codePointAt(0);

    // Étape 1 : re-mapping C1 -> CP1252 réel (récupère le caractère voulu)
    if (cp0 >= 0x80 && cp0 <= 0x9F) {
      c = CP1252_C1_REMAP[cp0] ?? '';
      if (c === '') { replacedCount++; replacedChars.push(`U+${cp0.toString(16).toUpperCase()}`); continue; }
    }

    // Étape 2 : fallbacks de confort pour Unicode hors WinAnsi
    if (c in UNICODE_FALLBACKS) c = UNICODE_FALLBACKS[c];
    if (c === '') continue;

    // Étape 3 : whitelist finale
    const cp = c.codePointAt(0);
    if (c === '\n' || isWinAnsiEncodable(cp)) {
      out += c;
    } else if (cp < 0x20) {
      // Autres caractères de contrôle : purge silencieuse acceptable (non imprimables)
      continue;
    } else {
      out += '·';
      replacedCount++;
      replacedChars.push(`U+${cp.toString(16).toUpperCase()}`);
    }
  }

  return { text: out, replacedCount, replacedChars };
}

/** Wrapper interne : sanitize + traçabilité (jamais de perte muette). */
const sanitize = (s, context = '') => {
  const { text, replacedCount, replacedChars } = sanitizeWinAnsi(s);
  if (replacedCount > 0) {
    console.warn(
      `[msgToPdf] ${replacedCount} caractère(s) non encodable(s) WinAnsi remplacé(s)` +
      (context ? ` (${context})` : '') +
      ` : ${[...new Set(replacedChars)].join(', ')}`
    );
  }
  return text;
};

// ---------------------------------------------------------------------------

const stripHtml = (html = '') =>
  html.replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');

function wrapText(text, font, size, maxWidth) {
  const out = [];
  for (const para of String(text).split('\n')) {
    if (para === '') { out.push(''); continue; }
    let cur = '';
    for (const word of para.split(/\s+/)) {
      const test = cur ? `${cur} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        cur = test;
      } else {
        if (cur) out.push(cur);
        if (font.widthOfTextAtSize(word, size) > maxWidth) {
          let chunk = '';
          for (const ch of word) {
            if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
              out.push(chunk); chunk = ch;
            } else chunk += ch;
          }
          cur = chunk;
        } else cur = word;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

/**
 * Génère un PDF d'UNE SEULE PAGE à partir d'un buffer .msg.
 * @param {ArrayBuffer|Uint8Array} msgBuffer
 * @returns {Promise<Uint8Array>}
 * @throws si le parsing échoue (PAS d'erreur silencieuse).
 */
export async function msgToSinglePagePdf(msgBuffer) {
  const msgReader = new MsgReader(msgBuffer);
  const fileData = msgReader.getFileData();

  if (!fileData) throw new Error('msgToSinglePagePdf: impossible de parser le MSG');

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([A4.w, A4.h]);
  const maxWidth = A4.w - 2 * MARGIN;
  let currentY = A4.h - MARGIN;

  const drawLine = (label, text, useBold = false) => {
    if (!text) return;
    const cleanText = sanitize(text, `en-tête "${label}"`);
    const labelWidth = fontBold.widthOfTextAtSize(label, 11);
    page.drawText(label, { x: MARGIN, y: currentY, size: 11, font: fontBold, color: rgb(0, 0, 0) });
    
    // Si le texte dépasse la ligne (ex: objet très long), on wrap
    const lines = wrapText(cleanText, font, 11, maxWidth - labelWidth - 10);
    for (let i = 0; i < lines.length; i++) {
      page.drawText(lines[i], { x: MARGIN + labelWidth + 5, y: currentY, size: 11, font: font, color: rgb(0.2, 0.2, 0.2) });
      currentY -= HEADER_LEADING;
    }
  };

  // 1. En-tête
  const sender = fileData.senderName ? `${fileData.senderName} <${fileData.senderEmail || ''}>` : fileData.senderEmail;
  const recipients = fileData.recipients ? fileData.recipients.map(r => r.name || r.email).join('; ') : '';
  const dateStr = fileData.messageDeliveryTime || fileData.clientSubmitTime || fileData.creationTime;
  
  let formattedDate = 'Inconnue';
  if (dateStr) {
      try {
          const d = new Date(dateStr);
          formattedDate = d.toLocaleString('fr-FR');
      } catch (e) {
          formattedDate = String(dateStr);
      }
  }

  drawLine('De :', sender);
  drawLine('À :', recipients);
  drawLine('Date :', formattedDate);
  drawLine('Objet :', fileData.subject || '(sans objet)');

  // Séparation
  currentY -= 10;
  page.drawLine({
    start: { x: MARGIN, y: currentY },
    end: { x: A4.w - MARGIN, y: currentY },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8)
  });
  currentY -= 20;

  // 2. Corps
  const rawBody = fileData.body || stripHtml(fileData.bodyHTML) || "";
  const cleanBody = sanitize(rawBody.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), 'corps');
  const bodyLines = wrapText(cleanBody, font, BODY_FONT_SIZE, maxWidth);

  const yEnd = MARGIN + FOOTER_RESERVE;
  let truncated = false;

  for (const line of bodyLines) {
    if (currentY - BODY_LEADING < yEnd) {
      truncated = true;
      break;
    }
    page.drawText(line, { x: MARGIN, y: currentY, size: BODY_FONT_SIZE, font: font, color: rgb(0.15, 0.15, 0.15) });
    currentY -= BODY_LEADING;
  }

  // 3. Footer
  const footerText = truncated
    ? "Pièce jointe (email) — extrait page 1 — contenu tronqué"
    : "Pièce jointe (email) — page 1";
  
  const fWidth = font.widthOfTextAtSize(footerText, 8);
  page.drawText(footerText, {
    x: (A4.w - fWidth) / 2,
    y: MARGIN / 2,
    size: 8,
    font: font,
    color: rgb(0.5, 0.5, 0.5)
  });

  return await pdfDoc.save();
}
