// v5.9.2 - Modularisation aiManager
/**
 * aiHelpers.js
 * Utilitaires partagés entre les agents IA :
 * - normalizeDate : normalisation des dates extraites par l'IA
 * - processInParallelBatches : batching parallèle de fichiers
 * - buildContentArrayParallel : construction du contentArray multimodal (texte/vision)
 * - Franchise légale : résolution par date de sinistre
 */

import { fileToBase64, pdfToBase64Images, pdfExtractHybrid } from './pdfUtils.js';
import { parseMsgFile } from './msgUtils.js';

// v5.5.15 - Table de référence des franchises légales (IPC/ABEX Belgique)
// Clé = "YYYY" (année), valeur = montant de la franchise légale pour cette année.
// Pour une résolution mensuelle plus fine, on pourra étendre avec "YYYY-MM" comme clé.
// Source : indices officiels publiés par le SPF Économie / Assuralia.
// ⚠️ À COMPLÉTER avec les montants exacts de votre référentiel métier.
export const FRANCHISE_LEGALE_INDEX = {
    '2020': 282.77,
    '2021': 289.48,
    '2022': 297.47,
    '2023': 322.23,
    '2024': 328.14,
    '2025': 335.87,
    '2026': 341.52,
};

/**
 * Résout le montant exact de la franchise légale à partir d'une date de sinistre (YYYY-MM-DD).
 * Retourne le montant (number) ou null si la date est hors index.
 */
export const resolveFranchiseLegale = (dateSinistreStr) => {
    try {
        const date = new Date(dateSinistreStr);
        if (isNaN(date.getTime())) return null;
        const year = String(date.getFullYear());
        // D'abord chercher par année-mois (pour une résolution mensuelle future)
        const monthKey = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (FRANCHISE_LEGALE_INDEX[monthKey]) return FRANCHISE_LEGALE_INDEX[monthKey];
        // Sinon par année
        if (FRANCHISE_LEGALE_INDEX[year]) return FRANCHISE_LEGALE_INDEX[year];
        return null;
    } catch (e) {
        console.warn('[aiHelpers] Erreur résolution franchise légale:', e);
        return null;
    }
};

// v5.5.10 - Normalise une date brute (DD/MM/YYYY, MM/YYYY, etc.) vers YYYY-MM-DD pour <input type="date">
export const normalizeDate = (raw) => {
    if (!raw || typeof raw !== 'string') return '';
    const s = raw.trim();
    
    // Déjà au bon format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    
    // DD/MM/YYYY ou DD-MM-YYYY
    let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
    
    // MM/YYYY (ex: "06/2026") → 1er du mois
    m = s.match(/^(\d{1,2})[\/\-.](\d{4})$/);
    if (m) return `${m[2]}-${m[1].padStart(2,'0')}-01`;
    
    // YYYY/MM/DD
    m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    
    // Fallback: retourner tel quel
    return s;
};

// v5.5.5 - Batching & Scalabilité : utilitaire de traitement par lots parallèles
export const processInParallelBatches = async (files, batchSize, processFunction) => {
    if (files.length <= batchSize) {
        // Pas besoin de batching, on traite directement
        return [await processFunction(files)];
    }
    const batchPromises = [];
    for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        batchPromises.push(processFunction(batch));
    }
    console.log(`[aiHelpers] 🔀 Batching: ${files.length} fichiers → ${batchPromises.length} lots de max ${batchSize}`);
    return await Promise.all(batchPromises);
};

// v5.9.3 - Smart Retry & Résilience
/**
 * Enveloppe une fonction async avec une logique de retry automatique.
 * Gère les erreurs transitoires (429 Rate Limit, 500 Server Error, timeout réseau).
 *
 * @param {() => Promise<any>} asyncFn - La fonction à tenter (sans arguments, utilisez une closure)
 * @param {number} maxRetries - Nombre de tentatives supplémentaires après l'échec initial (défaut: 1)
 * @param {number} delayMs - Délai en ms avant chaque retry, doublé à chaque tentative (défaut: 2000)
 * @returns {Promise<any>} - Le résultat de la fonction si succès
 * @throws {Error} - Relance l'erreur finale si tous les retries sont épuisés
 *
 * @example
 * const result = await withRetry(() => extractAdministrativeData(files, apiKey), 1, 2000);
 */
export const withRetry = async (asyncFn, maxRetries = 1, delayMs = 2000) => {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await asyncFn();
        } catch (err) {
            lastError = err;
            const isLastAttempt = attempt === maxRetries;
            if (isLastAttempt) break;

            // Délai exponentiel : 2s, 4s, 8s...
            const waitMs = delayMs * Math.pow(2, attempt);
            console.warn(
                `[withRetry] ⚠️ Tentative ${attempt + 1}/${maxRetries + 1} échouée — ` +
                `Retry dans ${waitMs}ms. Erreur: ${err.message || err}`
            );
            await new Promise(resolve => setTimeout(resolve, waitMs));
        }
    }
    console.error(`[withRetry] ❌ Toutes les tentatives épuisées (${maxRetries + 1}/${maxRetries + 1}). Erreur finale:`, lastError);
    throw lastError;
};

// v5.7.2 - Helper pour paralléliser la préparation (PDF->Base64, MSG->texte) des fichiers
// v5.5.5 - maxTextLength=30000 par défaut (sécurité anti-crash, un seul MSG géant ne peut plus faire exploser le contexte)
// v5.9.1 - Optimisation Hybride PDF : les PDFs textuels sont extraits en texte brut (forceVision=false par défaut)
export const buildContentArrayParallel = async (files, introductoryText, options = {}) => {
    const { maxPdfPages = 20, maxTextLength = 30000, forceVision = false } = options;
    const contentArray = [{ type: "text", text: introductoryText }];
    
    const promises = files.map(async (item) => {
        const localContent = [];
        const fileName = item.name || 'document_sans_nom';
        localContent.push({ type: "text", text: `\n\n[DÉBUT DOCUMENT : ${fileName}]\n` });
        
        if (typeof item === 'string') {
             const textToPush = maxTextLength ? item.substring(0, maxTextLength) : item;
             localContent.push({ type: "text", text: textToPush });
        } else {
            const fileNameLower = fileName.toLowerCase();
            if (fileNameLower.endsWith('.msg')) {
                try {
                    const { bodyText } = await parseMsgFile(item);
                    const textToPush = maxTextLength ? bodyText.substring(0, maxTextLength) : bodyText;
                    localContent.push({ type: "text", text: textToPush });
                } catch (e) {
                    localContent.push({ type: "text", text: "[Fichier MSG illisible]" });
                }
            } else if (item.type === 'application/pdf') {
                if (forceVision) {
                    // Mode vision forcé (ex: Agent Financier sur factures potentiellement scannées)
                    const base64Images = await pdfToBase64Images(item, maxPdfPages);
                    for (const img of base64Images) {
                        localContent.push({ type: "image_url", image_url: { url: img } });
                    }
                } else {
                    // v5.9.1 - Mode hybride : texte si digital, vision si scanné
                    const hybrid = await pdfExtractHybrid(item, maxPdfPages);
                    if (hybrid.mode === 'text') {
                        const textToPush = maxTextLength ? hybrid.text.substring(0, maxTextLength) : hybrid.text;
                        localContent.push({ type: "text", text: textToPush });
                    } else {
                        for (const img of (hybrid.images || [])) {
                            localContent.push({ type: "image_url", image_url: { url: img } });
                        }
                    }
                }
            } else if (item.type && item.type.startsWith('image/')) {
                const base64Image = await fileToBase64(item);
                localContent.push({ type: "image_url", image_url: { url: base64Image } });
            } else {
                localContent.push({ type: "text", text: "[Format non supporté pour la vision]" });
            }
        }
        localContent.push({ type: "text", text: `\n[FIN DOCUMENT : ${fileName}]\n` });
        return localContent;
    });

    const results = await Promise.all(promises);
    results.forEach(res => contentArray.push(...res));
    return contentArray;
};

// v6.3.1 - Fix Drag & Drop (DOMException: NotFoundError)
/**
 * cloneFileEagerly
 * Résout le problème des DataTransferItems (drag & drop) qui expirent dans React.
 * Lit immédiatement le fichier en mémoire vive (ArrayBuffer) et retourne une NOUVELLE 
 * instance de File, détachée du pointeur système éphémère.
 */
export const cloneFileEagerly = async (file) => {
    if (!file) return file;
    try {
        const buffer = await file.arrayBuffer();
        return new File([buffer], file.name, { type: file.type, lastModified: file.lastModified });
    } catch (e) {
        console.warn("[aiHelpers] Erreur lors du clonage de sécurité du fichier:", e);
        return file; // Fallback sur l'original si échec
    }
};

export const cloneFilesEagerly = async (files) => {
    if (!files) return [];
    const fileArray = Array.from(files);
    return await Promise.all(fileArray.map(f => cloneFileEagerly(f)));
};
