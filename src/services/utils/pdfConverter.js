import html2canvas from 'html2canvas';
import { PDFDocument } from 'pdf-lib';

// ---------------------------------------------------------
// Helper 1 : Transforme du HTML en Uint8Array (PDF)
// On utilise une div fantôme pour le rendu.
// ---------------------------------------------------------
export const convertHtmlToPdfBytes = async (htmlContent) => {
    // Créer un container invisible de la taille d'un A4 (210mm x 297mm)
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '-9999px';
    container.style.width = '210mm';
    container.style.minHeight = '297mm';
    container.style.padding = '15mm';
    container.style.backgroundColor = 'white';
    container.style.color = 'black';
    container.style.fontFamily = 'Arial, sans-serif';
    container.style.fontSize = '12pt';
    container.style.lineHeight = '1.5';
    container.style.boxSizing = 'border-box';
    container.innerHTML = htmlContent;

    document.body.appendChild(container);

    try {
        const A4W = 595.28;
        const A4H = 841.89;

        // Attendre que le DOM soit bien rendu
        await new Promise(r => setTimeout(r, 100));

        const canvas = await html2canvas(container, {
            scale: 2,
            useCORS: true,
            logging: false
        });

        const pxPerPt = canvas.width / A4W;
        const slicePixH = A4H * pxPerPt;
        const pageCount = Math.max(1, Math.ceil(canvas.height / slicePixH));

        const mergedPdf = await PDFDocument.create();

        for (let i = 0; i < pageCount; i++) {
            const startY = Math.round(i * slicePixH);
            let h = slicePixH;
            if (i === pageCount - 1 && canvas.height % slicePixH > 0) {
                h = canvas.height % slicePixH;
            }

            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = canvas.width;
            sliceCanvas.height = h;
            const ctx = sliceCanvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            ctx.drawImage(canvas, 0, startY, canvas.width, h, 0, 0, canvas.width, h);

            // Strip the data:image/jpeg;base64, part
            const base64 = sliceCanvas.toDataURL('image/jpeg', 0.92).split(',')[1];
            const binStr = atob(base64);
            const bytes = new Uint8Array(binStr.length);
            for (let j = 0; j < binStr.length; j++) bytes[j] = binStr.charCodeAt(j);

            const img = await mergedPdf.embedJpg(bytes);
            const drawnH = h / pxPerPt;
            const page = mergedPdf.addPage([A4W, A4H]);
            // Draw from the top of the page downwards
            page.drawImage(img, { x: 0, y: A4H - drawnH, width: A4W, height: drawnH });
        }

        return await mergedPdf.save();
    } finally {
        document.body.removeChild(container);
    }
};

// ---------------------------------------------------------
// Helper 2 : Convertir un Fichier Texte / EDI -> Uint8Array (PDF)
// ---------------------------------------------------------
export const convertTextToPdfBytes = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    let text = '';
    
    try {
        // Essayer UTF-8
        const decoder = new TextDecoder('utf-8', { fatal: true });
        text = decoder.decode(arrayBuffer);
    } catch (e) {
        // Fallback vers Windows-1252 / ISO-8859-1 (typique vieux EDI)
        console.warn(`[pdfConverter] Fallback encodage Windows-1252 pour ${file.name}`);
        const decoder = new TextDecoder('windows-1252');
        text = decoder.decode(arrayBuffer);
    }

    // Protection anti-binaire : s'il y a des octets nuls, ce n'est pas du texte
    if (text.indexOf('\0') !== -1) {
        throw new Error("Le fichier semble être un fichier binaire non supporté.");
    }

    // Transformer le texte en HTML avec sauts de ligne préservés
    const escapedText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\\n/g, '<br/>');

    const html = `
        <div style="margin-bottom: 20px;">
            <h2 style="border-bottom: 2px solid #ccc; padding-bottom: 5px;">Document original : ${file.name}</h2>
        </div>
        <div style="font-family: monospace; font-size: 10pt; white-space: pre-wrap; word-break: break-all;">
            ${escapedText}
        </div>
    `;

    return convertHtmlToPdfBytes(html);
};
