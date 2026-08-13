/**
 * windowPreviewHelper.js
 * Ouverture d'aperçus de documents dans une fenêtre détachée unique.
 * Positionnement volontairement délégué au navigateur : aucune coordonnée
 * left/top n'est spécifiée afin que Chrome restaure nativement la position
 * de la fenêtre nommée (multi-écrans) choisie par l'utilisateur.
 */

const PREVIEW_WINDOW_NAME = 'ExpertisesDocumentPreview';
const PREVIEW_FEATURES = 'popup=yes,width=1100,height=900,resizable=yes';
const REVOKE_DELAY_MS = 5000; // protège les requêtes range du viewer PDF
const CLOSE_POLL_MS = 1500;

let activePreviewWindow = null;
let ownedObjectUrl = null;      // URL créée PAR le helper (à révoquer)
let closeWatcherId = null;

// ---------------------------------------------------------------- Nettoyage

function revokeOwnedUrl(url) {
    if (!url) return;
    try { URL.revokeObjectURL(url); } catch { /* déjà révoquée : sans effet */ }
}

function startCloseWatcher() {
    if (closeWatcherId) return;
    closeWatcherId = setInterval(() => {
        if (!activePreviewWindow || activePreviewWindow.closed) {
            revokeOwnedUrl(ownedObjectUrl);
            ownedObjectUrl = null;
            activePreviewWindow = null;
            clearInterval(closeWatcherId);
            closeWatcherId = null;
        }
    }, CLOSE_POLL_MS);
}

// Nettoyage final si l'application principale se ferme
if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
        revokeOwnedUrl(ownedObjectUrl);
        ownedObjectUrl = null;
    });
}

// ------------------------------------------------------------- API publique

/**
 * Ouvre un document dans la fenêtre d'aperçu dédiée (réutilisée si déjà ouverte).
 * Chrome et l'OS conservent nativement l'emplacement de la fenêtre nommée choisi par l'utilisateur.
 * @param {Blob|File|string} target - Blob/File ou URL string.
 * @param {string} title - Titre indicatif (best-effort).
 * @returns {{ ok: boolean, reason?: 'invalid-target'|'popup-blocked', window?: Window }}
 */
import { sniffFormat, mimeFromName, IMAGE_FORMATS } from './imageFormatSniffer.js';

export function openDocumentPreview(target, title = 'Aperçu Document') {
    // 1. Résolution de l'URL — synchrone
    let url = '';
    let helperOwnsUrl = false;
    if (typeof target === 'string' && target.length > 0) {
        url = target;
    } else if (target instanceof Blob) { // File hérite de Blob
        url = URL.createObjectURL(target);
        helperOwnsUrl = true;
    } else if (target && target.file instanceof Blob) {
        url = URL.createObjectURL(target.file);
        helperOwnsUrl = true;
    } else if (target && target.content && (target.content instanceof Uint8Array || target.content instanceof ArrayBuffer || Array.isArray(target.content))) {
        const u8 = target.content instanceof Uint8Array ? target.content
            : new Uint8Array(target.content instanceof ArrayBuffer ? target.content : Uint8Array.from(target.content));
        const sniffed = sniffFormat(u8);
        const mime = (sniffed !== IMAGE_FORMATS.UNKNOWN ? sniffed.mime : null)
            || target.type || target.mimeType
            || mimeFromName(target.name || target.fileName || title || '')
            || 'application/octet-stream';
        const blob = new Blob([u8], { type: mime });
        url = URL.createObjectURL(blob);
        helperOwnsUrl = true;
    } else {
        console.error('[openDocumentPreview] Cible invalide :', target);
        return { ok: false, reason: 'invalid-target' };
    }

    const previousOwnedUrl = ownedObjectUrl;
    let win = null;
    try {
        if (activePreviewWindow && !activePreviewWindow.closed) {
            activePreviewWindow.location.href = url;
            win = activePreviewWindow;
        } else {
            win = window.open(url, PREVIEW_WINDOW_NAME, PREVIEW_FEATURES);
        }
    } catch (err) {
        console.error('[openDocumentPreview] Échec ouverture :', err);
        win = null;
    }

    if (!win) {
        // Fallback : onglet classique
        win = window.open(url, '_blank');
        if (!win) {
            if (helperOwnsUrl) revokeOwnedUrl(url);
            console.error('[openDocumentPreview] Pop-up bloquée par le navigateur.');
            return { ok: false, reason: 'popup-blocked' };
        }
    }

    activePreviewWindow = win;
    ownedObjectUrl = helperOwnsUrl ? url : null;
    startCloseWatcher();

    // Révoquer l'ANCIENNE URL après remplacement (délai : protège le viewer PDF)
    if (previousOwnedUrl && previousOwnedUrl !== url) {
        setTimeout(() => revokeOwnedUrl(previousOwnedUrl), REVOKE_DELAY_MS);
    }

    // Focus + titre — best-effort
    try { win.focus(); } catch { /* ignore */ }
    try {
        win.addEventListener?.('load', () => {
            try { win.document.title = title; } catch { /* cross-origin ou PDF viewer */ }
        });
    } catch { /* sans conséquence */ }

    return { ok: true, window: win };
}

/**
 * Ramène la fenêtre d'aperçu au premier plan si elle est ouverte.
 * @returns {boolean} true si une fenêtre active a été ramenée au premier plan.
 */
export function recoverPreviewWindow() {
    if (!activePreviewWindow || activePreviewWindow.closed) return false;
    try {
        activePreviewWindow.focus();
        return true;
    } catch (err) {
        console.error('[recoverPreviewWindow] Échec :', err);
        return false;
    }
}

/** Indique si une fenêtre d'aperçu est actuellement ouverte. */
export function hasActivePreviewWindow() {
    return Boolean(activePreviewWindow && !activePreviewWindow.closed);
}
