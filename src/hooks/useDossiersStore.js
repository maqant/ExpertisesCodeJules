import { useState, useEffect, useCallback } from 'react';
import { readIndex, readData, saveFullDossier, removeDossier } from '../services/storage/dossierStorage';
import { migrateV1ToV2 } from '../services/storage/migration';

export function useDossiersStore() {
    const [savedDossiers, setSavedDossiers] = useState([]);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        let mounted = true;
        const init = async () => {
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
                console.error("Failed to initialize dossiers store:", err);
                if (mounted) setIsLoaded(true);
            }
        };
        init();
        return () => { mounted = false; };
    }, []);

    const setSavedDossiersGlobal = useCallback((updater) => {
        setSavedDossiers(prev => {
            return typeof updater === 'function' ? updater(prev) : updater;
        });
    }, []);

    const persistDossier = useCallback(async (dossier) => {
        if (!dossier || !dossier.id) return;
        try {
            await saveFullDossier(dossier.id, dossier.name, dossier.date, dossier.data || {});
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
