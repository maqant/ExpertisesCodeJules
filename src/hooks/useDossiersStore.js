import { useState, useEffect, useCallback } from 'react';
import { readIndex, readData, saveFullDossier, removeDossier } from '../services/storage/dossierStorage';
import { migrateV1ToV2 } from '../services/storage/migration';
import { notifyDossierUpdated, subscribeToDossierUpdates } from '../services/utils/tabSync';

export function useDossiersStore() {
    const [savedDossiers, setSavedDossiers] = useState([]);
    const [isLoaded, setIsLoaded] = useState(false);

    const loadAll = useCallback(async (mounted = true) => {
        try {
            await migrateV1ToV2();
            const index = await readIndex();
            
            const fullDossiers = await Promise.all(index.map(async (doc) => {
                try {
                    const data = await readData(doc.id);
                    return { ...doc, data };
                } catch (e) {
                    return { ...doc, data: {} };
                }
            }));

            if (mounted) {
                setSavedDossiers(fullDossiers);
                setIsLoaded(true);
            }
        } catch (err) {
            console.error("Failed to load dossiers store:", err);
            if (mounted) setIsLoaded(true);
        }
    }, []);

    useEffect(() => {
        let mounted = true;
        loadAll(mounted);
        
        const unsubscribe = subscribeToDossierUpdates(() => {
            if (mounted) loadAll(mounted);
        });

        return () => { 
            mounted = false; 
            unsubscribe();
        };
    }, [loadAll]);

    const setSavedDossiersGlobal = useCallback((updater) => {
        setSavedDossiers(prev => {
            return typeof updater === 'function' ? updater(prev) : updater;
        });
    }, []);

    const persistDossier = useCallback(async (dossier, expectedVersion = 0, force = false) => {
        if (!dossier || !dossier.id) return;
        try {
            const { version, updatedAt } = await saveFullDossier(dossier.id, dossier.name, dossier.date, dossier.data || {}, expectedVersion, force);
            notifyDossierUpdated(dossier.id, version, updatedAt);
            return { version, updatedAt };
        } catch (e) {
            console.error("Failed to persist dossier:", e);
            throw e; // Laisse l'appelant gérer l'erreur (pour l'alerter)
        }
    }, []);

    const deleteDossierGlobal = useCallback(async (id) => {
        setSavedDossiers(prev => prev.filter(d => d.id !== id));
        try {
            await removeDossier(id);
        } catch (e) {
            console.error("Failed to delete dossier:", e);
            throw e;
        }
    }, []);

    return {
        savedDossiers,
        setSavedDossiersGlobal,
        persistDossier,
        deleteDossierGlobal,
        isLoaded
    };
}
