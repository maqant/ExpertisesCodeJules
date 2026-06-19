import { getTabId } from './tabIdentity.js';

const CHANNEL_NAME = 'expertises_dossier_sync_v1';
let channel = null;

export function initTabSync() {
    if (typeof window !== 'undefined' && window.BroadcastChannel && !channel) {
        channel = new BroadcastChannel(CHANNEL_NAME);
        // eslint-disable-next-line no-console
        console.info('[tabSync] init — tabId courant:', getTabId());
    }
}

/**
 * Notifie les autres onglets qu'un dossier a été sauvegardé.
 * @param {string} id
 * @param {number|string} version
 * @param {string} updatedAt
 */
export function notifyDossierUpdated(id, version, updatedAt) {
    if (!channel) initTabSync();
    if (!channel) return;
    channel.postMessage({
        type: 'DOSSIER_UPDATED',
        payload: { id, version, updatedAt },
        sourceTabId: getTabId(), // toujours présent à l'émission
    });
}

/**
 * Souscrit aux notifications de mise à jour de dossier.
 * Le callback reçoit ({ payload, sourceTabId, isOwnEcho }).
 * - isOwnEcho === true  => message émis par CET onglet (à ignorer côté métier).
 *   NB: BroadcastChannel ne renvoie normalement pas ses propres messages,
 *   ce flag est une défense en profondeur.
 */
export function subscribeToDossierUpdates(callback) {
    if (!channel) initTabSync();
    if (!channel) return () => {};

    const handleMessage = (event) => {
        if (event.data && event.data.type === 'DOSSIER_UPDATED') {
            const { payload, sourceTabId } = event.data;
            const isOwnEcho = sourceTabId === getTabId();
            callback({ payload, sourceTabId, isOwnEcho });
        }
    };

    channel.addEventListener('message', handleMessage);

    return () => {
        channel.removeEventListener('message', handleMessage);
    };
}
