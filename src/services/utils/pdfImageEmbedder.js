/**
 * pdfImageEmbedder.js
 * Incorporation universelle d'images dans un document pdf-lib.
 * PNG/JPEG : direct. WebP (legacy) : transcodage canvas → JPEG.
 * Format inconnu : erreur EXPLICITE (jamais silencieuse).
 */
import { sniffFormat, IMAGE_FORMATS } from './imageFormatSniffer.js';

const TRANSCODE_QUALITY = 0.85;

async function transcodeWebpToJpeg(bytes) {
    const blob = new Blob([bytes], { type: 'image/webp' });
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    if (bitmap.close) bitmap.close();
    const jpegBlob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Transcodage WebP->JPEG: toBlob null')), 'image/jpeg', TRANSCODE_QUALITY)
    );
    return new Uint8Array(await jpegBlob.arrayBuffer());
}

/**
 * @param {PDFDocument} pdfDoc - document pdf-lib cible
 * @param {Uint8Array|ArrayBuffer} bytes - octets de l'image
 * @param {string} [name] - nom de fichier (log uniquement)
 * @returns {Promise<PDFImage>} image incorporée, prête pour drawImage
 * @throws {Error} format non supporté — l'appelant DOIT gérer visiblement
 */
export async function embedImageInPdf(pdfDoc, bytes, name = 'image') {
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const format = sniffFormat(u8);
    switch (format) {
        case IMAGE_FORMATS.PNG:  return pdfDoc.embedPng(u8);
        case IMAGE_FORMATS.JPEG: return pdfDoc.embedJpg(u8);
        case IMAGE_FORMATS.WEBP: {
            console.warn(`[pdfImageEmbedder] WebP legacy détecté (${name}) — transcodage JPEG à la volée.`);
            return pdfDoc.embedJpg(await transcodeWebpToJpeg(u8));
        }
        default:
            throw new Error(`[pdfImageEmbedder] Format non incorporable pour "${name}" (magic bytes inconnus).`);
    }
}
