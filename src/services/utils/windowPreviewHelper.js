/**
 * windowPreviewHelper.js
 * Ouverture d'aperçus de documents dans une fenêtre détachée unique.
 * - Multi-écran : positionnement sur écran secondaire via Window Management API (si disponible).
 * - Mono-écran : centrage strict avec bornage ("pare-feu" anti-fenêtre perdue).
 * - Réemploi de la fenêtre + focus() au clic suivant.
 * - Propriétaire unique du cycle de vie des Blob URLs qu'il crée.
 */

const PREVIEW_WINDOW_NAME = 'ExpertisesDocumentPreview';
const REVOKE_DELAY_MS = 5000; // protège les requêtes range du viewer PDF
const CLOSE_POLL_MS = 1500;

let activePreviewWindow = null;
let ownedObjectUrl = null;      // URL créée PAR le helper (à révoquer)
let closeWatcherId = null;
let cachedScreenDetails = null; // Window Management API

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

// ------------------------------------------------------------- Géométrie

/** Borne une fenêtre à l'intérieur d'un écran donné — le "pare-feu". */
function clampToScreen(geometry, screen) {
    const availLeft = screen.availLeft ?? 0;
    const availTop = screen.availTop ?? 0;
    const availWidth = screen.availWidth || 1280;
    const availHeight = screen.availHeight || 800;

    const width = Math.min(geometry.width, availWidth);
    const height = Math.min(geometry.height, availHeight);
    const left = Math.min(Math.max(geometry.left, availLeft), availLeft + availWidth - width);
    const top = Math.min(Math.max(geometry.top, availTop), availTop + availHeight - height);
    return { left, top, width, height };
}

/** Géométrie centrée sur l'écran courant (fallback sûr, toujours valide). */
function centeredOnCurrentScreen() {
    const s = window.screen || {};
    const availWidth = s.availWidth || window.innerWidth || 1280;
    const availHeight = s.availHeight || window.innerHeight || 800;
    const width = Math.min(1200, Math.floor(availWidth * 0.75));
    const height = Math.min(950, Math.floor(availHeight * 0.85));
    return clampToScreen({
        left: (s.availLeft ?? 0) + Math.floor((availWidth - width) / 2),
        top: (s.availTop ?? 0) + Math.floor((availHeight - height) / 2),
        width, height,
    }, s);
}

/**
 * Tente de récupérer la géométrie d'un écran secondaire (Window Management API).
 * Retourne null si mono-écran, API absente, ou permission refusée.
 * ASYNC : ne doit JAMAIS être awaité avant window.open() (perte du user gesture).
 */
async function getSecondaryScreenGeometry() {
    if (!window.screen?.isExtended || typeof window.getScreenDetails !== 'function') return null;
    try {
        cachedScreenDetails = cachedScreenDetails || await window.getScreenDetails();
        const secondary = cachedScreenDetails.screens.find(
            (s) => s !== cachedScreenDetails.currentScreen
        );
        if (!secondary) return null;
        const width = Math.min(1400, Math.floor(secondary.availWidth * 0.9));
        const height = Math.min(1000, Math.floor(secondary.availHeight * 0.9));
        return clampToScreen({
            left: secondary.availLeft + Math.floor((secondary.availWidth - width) / 2),
            top: secondary.availTop + Math.floor((secondary.availHeight - height) / 2),
            width, height,
        }, secondary);
    } catch {
        return null; // permission refusée ou API indisponible → fallback mono-écran
    }
}

// ------------------------------------------------------------- API publique

/**
 * Ouvre un document dans la fenêtre d'aperçu dédiée (réutilisée si déjà ouverte).
 * @param {Blob|File|string} target - Blob/File (recommandé : le helper gère le cycle de vie) ou URL string.
 * @param {string} title - Titre indicatif.
 * @returns {{ ok: boolean, reason?: 'invalid-target'|'popup-blocked', window?: Window }}
 */
export function openDocumentPreview(target, title = 'Aperçu Document') {
    // 1. Résolution de l'URL — synchrone
    let url = '';
    let helperOwnsUrl = false;
    if (typeof target === 'string' && target.length > 0) {
        url = target;
    } else if (target instanceof Blob) { // File hérite de Blob
        url = URL.createObjectURL(target);
        helperOwnsUrl = true;
    } else {
        console.error('[openDocumentPreview] Cible invalide :', target);
        return { ok: false, reason: 'invalid-target' };
    }

    // 2. Géométrie sûre par défaut : centrée + bornée sur l'écran courant (pare-feu)
    const geo = centeredOnCurrentScreen();
    const features =
        `popup=yes,width=${geo.width},height=${geo.height},` +
        `left=${geo.left},top=${geo.top},resizable=yes,scrollbars=yes`;

    // 3. Ouverture / réemploi — SYNCHRONE (dans le user gesture du clic)
    const previousOwnedUrl = ownedObjectUrl;
    let win = null;
    try {
        if (activePreviewWindow && !activePreviewWindow.closed) {
            activePreviewWindow.location.href = url;
            win = activePreviewWindow;
        } else {
            win = window.open(url, PREVIEW_WINDOW_NAME, features);
        }
    } catch (err) {
        console.error('[openDocumentPreview] Échec ouverture :', err);
        win = null;
    }

    if (!win) {
        // Fallback : onglet classique. Si lui aussi bloqué → erreur explicite.
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

    // 4. Focus + titre — best-effort
    try { win.focus(); } catch { /* certains OS l'ignorent : recoverPreviewWindow() en secours */ }
    try {
        win.addEventListener?.('load', () => {
            try { win.document.title = title; } catch { /* cross-origin ou PDF viewer */ }
        });
    } catch { /* fenêtre non manipulable : sans conséquence */ }

    // 5. Repositionnement ASYNCHRONE sur écran secondaire si disponible
    getSecondaryScreenGeometry().then((secondaryGeo) => {
        if (!secondaryGeo || !activePreviewWindow || activePreviewWindow.closed) return;
        try {
            activePreviewWindow.moveTo(secondaryGeo.left, secondaryGeo.top);
            activePreviewWindow.resizeTo(secondaryGeo.width, secondaryGeo.height);
            activePreviewWindow.focus();
        } catch { /* refus navigateur → la fenêtre reste centrée : acceptable */ }
    });

    return { ok: true, window: win };
}

/**
 * PARE-FEU : ramène la fenêtre d'aperçu au centre de l'écran courant.
 * @returns {boolean} true si une fenêtre a été récupérée.
 */
export function recoverPreviewWindow() {
    if (!activePreviewWindow || activePreviewWindow.closed) return false;
    const geo = centeredOnCurrentScreen();
    try {
        activePreviewWindow.moveTo(geo.left, geo.top);
        activePreviewWindow.resizeTo(geo.width, geo.height);
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
