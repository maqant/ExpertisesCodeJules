import { getTabId } from './tabIdentity.js';

const HEARTBEAT_INTERVAL = 5000;
const STALE_THRESHOLD = 15000;

function getLockKey(dossierId) {
    return `expertise_dossier_lock_${dossierId}`;
}

/**
 * Lit le verrou actuel. Ne lève pas d'exception.
 * @param {string} dossierId
 * @returns {{tabId: string, openedAt: number, lastSeenAt: number} | null}
 */
export function readLock(dossierId) {
    try {
        const raw = localStorage.getItem(getLockKey(dossierId));
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        // En cas d'erreur de parsing ou quota, on log et on retourne null.
        console.warn(`[tabLock] Failed to read lock for ${dossierId}`, e);
        return null;
    }
}

/**
 * Vérifie si un verrou est obsolète.
 * @param {{lastSeenAt: number}} lockInfo
 * @returns {boolean}
 */
export function isLockStale(lockInfo) {
    if (!lockInfo || !lockInfo.lastSeenAt) return true;
    return Date.now() - lockInfo.lastSeenAt > STALE_THRESHOLD;
}

/**
 * Tente d'acquérir le verrou pour ce dossier.
 * Utilise une stratégie "pragmatique" (lire, écrire, relire) pour mitiger les race conditions.
 * @param {string} dossierId
 * @returns {Promise<boolean>} true si acquis, false sinon
 */
export async function acquireLock(dossierId) {
    const currentTabId = getTabId();
    const lockKey = getLockKey(dossierId);

    // 1. Lire
    const existingLock = readLock(dossierId);
    if (existingLock && existingLock.tabId !== currentTabId && !isLockStale(existingLock)) {
        return false; // Déjà verrouillé par quelqu'un d'autre et actif
    }

    // Petit jitter pour désynchroniser
    await new Promise(r => setTimeout(r, Math.random() * 50));

    // 2. Écrire
    const newLock = {
        tabId: currentTabId,
        openedAt: existingLock && existingLock.tabId === currentTabId ? existingLock.openedAt : Date.now(),
        lastSeenAt: Date.now()
    };

    try {
        localStorage.setItem(lockKey, JSON.stringify(newLock));
    } catch (e) {
        console.warn(`[tabLock] Failed to write lock for ${dossierId}`, e);
        // localStorage dégradé : on autorise l'édition pour ne pas bloquer le travail.
        return true; 
    }

    // 3. Relire immédiatement pour vérifier l'acquisition
    const checkLock = readLock(dossierId);
    if (checkLock && checkLock.tabId !== currentTabId) {
        return false; // Perdu la course
    }

    return true;
}

/**
 * Rafraîchit le timestamp du verrou s'il nous appartient.
 * @param {string} dossierId
 */
export function refreshLock(dossierId) {
    const currentTabId = getTabId();
    const lockKey = getLockKey(dossierId);
    
    const existingLock = readLock(dossierId);
    if (existingLock && existingLock.tabId === currentTabId) {
        try {
            existingLock.lastSeenAt = Date.now();
            localStorage.setItem(lockKey, JSON.stringify(existingLock));
        } catch (e) {
            console.warn(`[tabLock] Failed to refresh lock for ${dossierId}`, e);
        }
    }
}

/**
 * Libère le verrou s'il nous appartient.
 * @param {string} dossierId
 */
export function releaseLock(dossierId) {
    const currentTabId = getTabId();
    const existingLock = readLock(dossierId);
    
    if (existingLock && existingLock.tabId === currentTabId) {
        try {
            localStorage.removeItem(getLockKey(dossierId));
        } catch (e) {
            console.warn(`[tabLock] Failed to release lock for ${dossierId}`, e);
        }
    }
}

/**
 * Lance le heartbeat.
 * @param {string} dossierId
 * @returns {Function} fonction de nettoyage (clear)
 */
export function startHeartbeat(dossierId) {
    const intervalId = setInterval(() => {
        refreshLock(dossierId);
    }, HEARTBEAT_INTERVAL);

    // Retourne le nettoyeur
    return () => {
        clearInterval(intervalId);
        releaseLock(dossierId);
    };
}
