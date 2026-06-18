import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import MsgReader from '@kenjiuno/msgreader';

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 50;
const HEADER_LEADING = 16;
const BODY_LEADING = 13;
const BODY_FONT_SIZE = 10;
const FOOTER_RESERVE = 40;

// pdf-lib + Helvetica ne supporte que WinAnsi. On neutralise le reste.
const sanitize = (s = '') =>
  String(s).replace(/\r\n/g, '\n').replace(/[^\x09\x0A\x20-\xFF]/g, '·');

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
    const cleanText = sanitize(text);
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
  const cleanBody = sanitize(rawBody.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim());
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
