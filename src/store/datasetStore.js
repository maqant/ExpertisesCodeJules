import { create } from 'zustand';
import localforage from 'localforage';

// Initialize a specific localforage instance for the dataset
const datasetStorage = localforage.createInstance({
    name: 'expertises-code-jules',
    storeName: 'golden_dataset'
});

export const useDatasetStore = create((set, get) => ({
    records: [],
    isLoaded: false,

    loadRecords: async () => {
        try {
            const data = await datasetStorage.getItem('records');
            set({ records: data || [], isLoaded: true });
        } catch (e) {
            console.error('[datasetStore] Erreur lors du chargement du dataset', e);
            set({ records: [], isLoaded: true });
        }
    },

    addRecord: async (record) => {
        try {
            const currentRecords = get().records;
            const newRecords = [...currentRecords, { ...record, id: crypto.randomUUID(), timestamp: new Date().toISOString() }];
            set({ records: newRecords });
            await datasetStorage.setItem('records', newRecords);
        } catch (e) {
            console.error('[datasetStore] Erreur lors de la sauvegarde du record', e);
        }
    },

    clearRecords: async () => {
        try {
            set({ records: [] });
            await datasetStorage.removeItem('records');
        } catch (e) {
            console.error('[datasetStore] Erreur lors de la suppression du dataset', e);
        }
    },

    exportAsJSON: () => {
        const records = get().records;
        if (records.length === 0) return;
        const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        a.download = `golden_dataset_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}));
