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
            const updatedArray = typeof updater === 'function' ? updater(prev) : updater;
            
            // Lancer la persistance en tâche de fond pour tous les éléments qui ont changé.
            // On fait simple: le store va juste ré-écrire le 1er élément car c'est toujours
            // celui qui est modifié ou ajouté dans le flux applicatif actuel.
            if (updatedArray && updatedArray.length > 0) {
                const first = updatedArray[0];
                saveFullDossier(first.id, first.name, first.date, first.data || {}).catch(e => {
                    console.error("Failed to persist dossier:", e);
                });
            }
            return updatedArray;
        });
    }, []);

    const deleteDossierGlobal = useCallback(async (id) => {
        setSavedDossiers(prev => prev.filter(d => d.id !== id));
        try {
            await removeDossier(id);
        } catch (e) {
            console.error("Failed to delete dossier:", e);
        }
    }, []);

    return {
        savedDossiers,
        setSavedDossiersGlobal,
        deleteDossierGlobal,
        isLoaded
    };
}
