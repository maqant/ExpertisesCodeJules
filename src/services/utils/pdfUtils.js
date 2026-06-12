// v5.9.2 - Modularisation aiManager
/**
 * pdfUtils.js
 * Utilitaires de traitement PDF : conversion en images Base64 et extraction hybride texte/vision.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configurer le worker PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Cache v5.7.2 - Accélère considérablement la préparation des fichiers partagés entre agents
export const _pdfCache = new Map();
export const _imgCache = new Map();

// Utilitaire de conversion File -> Base64
export const fileToBase64 = async (file) => {
    const cacheKey = file.name + "_" + file.size;
    if (_imgCache.has(cacheKey)) return _imgCache.get(cacheKey);

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            _imgCache.set(cacheKey, reader.result);
            resolve(reader.result);
        };
        reader.onerror = error => reject(error);
    });
};

// Utilitaire pour extraire les pages d'un PDF sous forme d'images Base64
// (conservé tel quel pour les agents qui forcent le mode vision : Financier sur factures scannées)
export const pdfToBase64Images = async (file, maxPagesOverride = 20) => {
    const cacheKey = file.name + "_" + file.size + "_" + maxPagesOverride;
    if (_pdfCache.has(cacheKey)) return _pdfCache.get(cacheKey);

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const images = [];
    const maxPages = Math.min(pdf.numPages, maxPagesOverride); // Limite de sécurité à 20 pages par défaut

    for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const scale = 1.5;
        const viewport = page.getViewport({ scale });

        // Créer un canvas HTML
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Rendre la page sur le canvas
        await page.render({ canvasContext: context, viewport: viewport }).promise;

        // Convertir en base64
        images.push(canvas.toDataURL('image/jpeg', 0.8));
    }
    
    _pdfCache.set(cacheKey, images);
    return images;
};

// v5.9.1 - Optimisation Hybride PDF
// Seuil de densité textuelle : si une page contient moins de MIN_CHARS_PER_PAGE caractères
// exploitables en moyenne, on considère le PDF comme "scanné" → fallback vision.
// Valeur calibrée empiriquement : 80 chars/page couvre les polices avec beaucoup de tableaux.
const MIN_CHARS_PER_PAGE_THRESHOLD = 80;

/**
 * v5.9.1 - Optimisation Hybride PDF
 * Tente d'extraire le texte brut d'un PDF via pdfjs.getTextContent().
 * - Si le PDF est "digital" (texte dense) → retourne { mode: 'text', text: string }
 * - Si le PDF est "scanné" (texte rare/absent) → retourne { mode: 'vision', images: base64[] }
 *
 * Avantages :
 *   - PDFs textuels (polices, conditions générales, emails PDF) : ~10x moins de tokens, ~50% plus rapide.
 *   - PDFs scannés (factures photo, rapports manuscrits) : fallback vision inchangé.
 *   - Le cache est partagé avec pdfToBase64Images via _pdfCache.
 *
 * @param {File} file - Le fichier PDF
 * @param {number} maxPages - Nombre max de pages à traiter (défaut: 20)
 * @returns {Promise<{mode: 'text'|'vision', text?: string, images?: string[]}>}
 */
export const pdfExtractHybrid = async (file, maxPages = 20) => {
    const cacheKey = file.name + "_" + file.size + "_hybrid_" + maxPages;
    if (_pdfCache.has(cacheKey)) return _pdfCache.get(cacheKey);

    let arrayBuffer;
    try {
        arrayBuffer = await file.arrayBuffer();
    } catch (e) {
        console.warn(`[PDF Hybrid] ❌ Impossible de lire le buffer de "${file.name}":`, e);
        return { mode: 'vision', images: [] };
    }

    let pdf;
    try {
        pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    } catch (e) {
        console.warn(`[PDF Hybrid] ❌ Impossible de parser "${file.name}" avec pdfjs:`, e);
        return { mode: 'vision', images: [] };
    }

    const pagesToProcess = Math.min(pdf.numPages, maxPages);
    let fullText = '';
    let totalChars = 0;

    // Passe 1 : extraction texte rapide sur toutes les pages
    try {
        for (let i = 1; i <= pagesToProcess; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map(item => item.str || '')
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
            totalChars += pageText.length;
            fullText += `\n--- Page ${i} ---\n${pageText}`;
        }
    } catch (e) {
        console.warn(`[PDF Hybrid] ⚠️ Erreur extraction texte "${file.name}", fallback vision:`, e);
        // Si l'extraction texte échoue complètement → vision directe
        const images = await pdfToBase64Images(file, maxPages);
        const result = { mode: 'vision', images };
        _pdfCache.set(cacheKey, result);
        return result;
    }

    const avgCharsPerPage = totalChars / pagesToProcess;
    const isScanned = avgCharsPerPage < MIN_CHARS_PER_PAGE_THRESHOLD;

    console.log(
        `[PDF Hybrid] "${file.name}" — ${pagesToProcess} pages, ${totalChars} chars ` +
        `(moy. ${avgCharsPerPage.toFixed(0)}/page) → mode: ${isScanned ? '🖼️ VISION (scanné)' : '📝 TEXTE (digital)'}`
    );

    let result;
    if (isScanned) {
        // PDF scanné : on rend quand même les images (vision)
        const images = await pdfToBase64Images(file, maxPages);
        result = { mode: 'vision', images };
    } else {
        // PDF digital : texte brut, tronqué à 30 000 chars pour la sécurité anti-crash
        const truncated = fullText.length > 30000 ? fullText.substring(0, 30000) + '\n[... texte tronqué à 30 000 caractères]' : fullText;
        result = { mode: 'text', text: truncated };
    }

    _pdfCache.set(cacheKey, result);
    return result;
};
