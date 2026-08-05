/**
 * windowPreviewHelper.js
 * Ouverture d'aperçus de documents dans une fenêtre détachée unique.
 * - Multi-écran : placement SYNCHRONE direct sur l'écran adjacent dès window.open
 *   (les coordonnées left/top sont calculées AVANT l'ouverture, dans le user gesture).
 * - Mémorisation : la dernière position choisie par l'utilisateur est persistée
 *   (localStorage) et réutilisée en priorité aux ouvertures suivantes.
 * - Mono-écran : centrage strict avec bornage ("pare-feu" anti-fenêtre perdue).
 * - Réemploi de la fenêtre + focus() au clic suivant.
 * - Propriétaire unique du cycle de vie des Blob URLs qu'il crée.
 */

const PREVIEW_WINDOW_NAME = 'ExpertisesDocumentPreview';
const REVOKE_DELAY_MS = 5000;
const CLOSE_POLL_MS = 1500;
const GEO_STORAGE_KEY = 'ExpertisesPreviewWindowGeometry.v1';
const SCREEN_MARGIN = 30;      // marge de sécurité au-delà de la frontière d'écran
const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;
const MAX_COORD = 20000;       // plausibilité : au-delà, géométrie considérée corrompue

let activePreviewWindow = null;
let ownedObjectUrl = null;
let closeWatcherId = null;
let cachedScreenDetails = null;

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
            return;
        }
        // Mémorisation continue de la position réelle (déplacements manuels inclus)
        captureCurrentGeometry();
    }, CLOSE_POLL_MS);
}

if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', () => {
        captureCurrentGeometry();
        revokeOwnedUrl(ownedObjectUrl);
        ownedObjectUrl = null;
    });
}

// -------------------------------------------------- Persistance de géométrie

function isValidGeometry(g) {
    return Boolean(g)
        && [g.left, g.top, g.width, g.height].every(Number.isFinite)
        && g.width >= MIN_WIDTH && g.height >= MIN_HEIGHT
        && Math.abs(g.left) <= MAX_COORD && Math.abs(g.top) <= MAX_COORD;
}

function loadStoredGeometry() {
    try {
        const raw = localStorage.getItem(GEO_STORAGE_KEY);
        if (!raw) return null;
        const g = JSON.parse(raw);
        return isValidGeometry(g) ? g : null;
    } catch {
        return null; // JSON corrompu ou storage indisponible → heuristique par défaut
    }
}

function saveGeometry(g) {
    if (!isValidGeometry(g)) return;
    try { localStorage.setItem(GEO_STORAGE_KEY, JSON.stringify(g)); } catch { /* quota/privé */ }
}

function clearStoredGeometry() {
    try { localStorage.removeItem(GEO_STORAGE_KEY); } catch { /* sans effet */ }
}

/** Lit la position réelle de la fenêtre d'aperçu et la persiste. */
function captureCurrentGeometry() {
    if (!activePreviewWindow || activePreviewWindow.closed) return;
    try {
        saveGeometry({
            left: activePreviewWindow.screenX,
            top: activePreviewWindow.screenY,
            width: activePreviewWindow.outerWidth,
            height: activePreviewWindow.outerHeight,
        });
    } catch { /* fenêtre non manipulable (rare) : on garde la dernière valeur connue */ }
}

// ------------------------------------------------------------- Géométrie

/** Borne une fenêtre à l'intérieur d'un écran donné — pare-feu MONO-ÉCRAN uniquement. */
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
 * SYNCHRONE : géométrie sur l'écran adjacent à droite de l'écran courant.
 * Hypothèse : écran adjacent de taille comparable.
 * Retourne null si le bureau n'est pas étendu (mono-écran ou API absente).
 * IMPORTANT : ne JAMAIS passer ce résultat dans clampToScreen() — le clamp
 * ramènerait la fenêtre sur l'écran courant.
 */
function adjacentScreenGeometrySync() {
    const s = window.screen || {};
    if (s.isExtended !== true) return null;

    const sLeft = s.availLeft ?? 0;
    const sTop = s.availTop ?? 0;
    const sWidth = s.availWidth || 1280;
    const sHeight = s.availHeight || 800;

    const width = Math.min(1400, Math.floor(sWidth * 0.9));
    const height = Math.min(1000, Math.floor(sHeight * 0.9));
    return {
        left: sLeft + sWidth + SCREEN_MARGIN, // premier pixel au-delà de la frontière droite
        top: sTop + Math.max(0, Math.floor((sHeight - height) / 2)),
        width, height,
    };
}

/**
 * Géométrie initiale pour window.open — 100% SYNCHRONE.
 * Priorité : 1) position mémorisée par l'utilisateur, 2) écran adjacent, 3) centrage borné.
 * @returns {{ geo: object, source: 'stored'|'adjacent'|'centered' }}
 */
function initialGeometry() {
    const stored = loadStoredGeometry();
    if (stored) return { geo: stored, source: 'stored' };
    const adjacent = adjacentScreenGeometrySync();
    if (adjacent) return { geo: adjacent, source: 'adjacent' };
    return { geo: centeredOnCurrentScreen(), source: 'centered' };
}

/**
 * ASYNC : géométrie exacte d'un écran secondaire (Window Management API).
 * Sert uniquement de RAFFINEMENT. Null si indisponible.
 * Ne doit JAMAIS être awaité avant window.open() (perte du user gesture).
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
        return null; // permission refusée ou API indisponible → placement synchrone conservé
    }
}

// ------------------------------------------------------------- API publique

/**
 * Ouvre un document dans la fenêtre d'aperçu dédiée (réutilisée si déjà ouverte).
 * @param {Blob|File|string} target
 * @param {string} title
 * @returns {{ ok: boolean, reason?: 'invalid-target'|'popup-blocked', window?: Window }}
 */
export function openDocumentPreview(target, title = 'Aperçu Document') {
    // 1. Résolution de l'URL — synchrone
    let url = '';
    let helperOwnsUrl = false;
    if (typeof target === 'string' && target.length > 0) {
        url = target;
    } else if (target instanceof Blob) {
        url = URL.createObjectURL(target);
        helperOwnsUrl = true;
    } else {
        console.error('[openDocumentPreview] Cible invalide :', target);
        return { ok: false, reason: 'invalid-target' };
    }

    // 2. Géométrie SYNCHRONE : mémorisée > écran adjacent > centrage pare-feu.
    //    Les coordonnées sont dans les windowFeatures → la fenêtre NAÎT au bon endroit.
    const { geo } = initialGeometry();
    const features =
        `popup=yes,width=${geo.width},height=${geo.height},` +
        `left=${geo.left},top=${geo.top},resizable=yes,scrollbars=yes`;

    // 3. Ouverture / réemploi — SYNCHRONE (dans le user gesture du clic)
    const previousOwnedUrl = ownedObjectUrl;
    const isReuse = Boolean(activePreviewWindow && !activePreviewWindow.closed);
    let win = null;
    try {
        if (isReuse) {
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

    // 5. Raffinement ASYNCHRONE si la position n'était pas déjà mémorisée
    if (!loadStoredGeometry()) {
        getSecondaryScreenGeometry().then((secondaryGeo) => {
            if (!secondaryGeo || !activePreviewWindow || activePreviewWindow.closed) return;
            try {
                activePreviewWindow.moveTo(secondaryGeo.left, secondaryGeo.top);
                activePreviewWindow.resizeTo(secondaryGeo.width, secondaryGeo.height);
                activePreviewWindow.focus();
            } catch { /* refus navigateur → la position synchrone est conservée */ }
        });
    }

    return { ok: true, window: win };
}

/**
 * PARE-FEU : efface la géométrie mémorisée et ramène la fenêtre au centre de l'écran courant.
 * @returns {boolean} true si une fenêtre a été récupérée.
 */
export function recoverPreviewWindow() {
    clearStoredGeometry();
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
