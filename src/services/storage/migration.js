import { saveFullDossier } from './dossierStorage';
import { StorageError, StorageErrorCode } from './storageErrors';

const V1_KEY = 'expertise_dossiers_v1';
const MIGRATION_FLAG = 'dossiers_migrated_v2';

export async function migrateV1ToV2() {
    if (localStorage.getItem(MIGRATION_FLAG) === 'true') {
        return; // Already migrated
    }

    const v1DataStr = localStorage.getItem(V1_KEY);
    if (!v1DataStr) {
        localStorage.setItem(MIGRATION_FLAG, 'true');
        return; // No v1 data to migrate
    }

    try {
        const v1Data = JSON.parse(v1DataStr);
        if (!Array.isArray(v1Data)) {
            throw new Error('Data is not an array');
        }

        console.log(`[Migration] Début de la migration de ${v1Data.length} dossiers vers IndexedDB...`);

        // Migrate from bottom to top so that we unshift into index to maintain original order
        for (let i = v1Data.length - 1; i >= 0; i--) {
            const doc = v1Data[i];
            await saveFullDossier(doc.id, doc.name, doc.date, doc.data);
        }

        localStorage.setItem(MIGRATION_FLAG, 'true');
        console.log(`[Migration] Migration terminée avec succès.`);
    } catch (err) {
        console.error('[Migration] Échec de la migration :', err);
        throw new StorageError(StorageErrorCode.MIGRATION_FAILED, 'Échec lors de la migration des anciens dossiers.', { cause: err });
    }
}
