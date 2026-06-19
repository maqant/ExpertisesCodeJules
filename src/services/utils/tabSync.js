const CHANNEL_NAME = 'expertises_dossier_sync_v1';
let channel = null;

export function initTabSync() {
    if (typeof window !== 'undefined' && window.BroadcastChannel && !channel) {
        channel = new BroadcastChannel(CHANNEL_NAME);
    }
}

export function notifyDossierUpdated(id, version, updatedAt) {
    if (!channel) initTabSync();
    if (channel) {
        channel.postMessage({
            type: 'DOSSIER_UPDATED',
            payload: { id, version, updatedAt }
        });
    }
}

export function subscribeToDossierUpdates(callback) {
    if (!channel) initTabSync();
    if (!channel) return () => {};

    const handleMessage = (event) => {
        if (event.data && event.data.type === 'DOSSIER_UPDATED') {
            callback(event.data.payload);
        }
    };

    channel.addEventListener('message', handleMessage);

    return () => {
        channel.removeEventListener('message', handleMessage);
    };
}
