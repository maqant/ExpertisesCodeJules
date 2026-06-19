import localforage from 'localforage';
import { StorageError, StorageErrorCode, isQuotaError } from './storageErrors';

const INDEX_KEY = 'dossiers_index_v2';
const DATA_PREFIX = 'dossier_data_';

const dataStore = localforage.createInstance({
  name: 'ExpertisesCodeJules',
  storeName: 'dossiers',
});

function readIndexFromLocalStorage() {
  const raw = localStorage.getItem(INDEX_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function readIndex() {
  const fromLS = readIndexFromLocalStorage();
  if (fromLS) return fromLS;
  const fromIDB = await dataStore.getItem(INDEX_KEY);
  return Array.isArray(fromIDB) ? fromIDB : [];
}

export async function writeIndex(index) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(index));
  } catch (err) {
    if (!isQuotaError(err)) {
      throw new StorageError(StorageErrorCode.WRITE_FAILED, 'Échec écriture index dossiers.', { cause: err });
    }
    console.warn('[dossierStorage] Index localStorage saturé, fallback IndexedDB seul.');
    localStorage.removeItem(INDEX_KEY);
  }
  await dataStore.setItem(INDEX_KEY, index);
}

export async function readData(id) {
  try {
    const data = await dataStore.getItem(DATA_PREFIX + id);
    if (!data) throw new StorageError(StorageErrorCode.NOT_FOUND, `Dossier data not found: ${id}`);
    return data;
  } catch (err) {
    if (err instanceof StorageError) throw err;
    throw new StorageError(StorageErrorCode.READ_FAILED, 'Échec lecture des données du dossier.', { cause: err, dossierId: id });
  }
}

export async function writeData(id, data) {
  try {
    await dataStore.setItem(DATA_PREFIX + id, data);
  } catch (err) {
    if (isQuotaError(err)) {
      throw new StorageError(StorageErrorCode.QUOTA_EXCEEDED, 'Espace de stockage du navigateur saturé.', { cause: err, dossierId: id });
    }
    throw new StorageError(StorageErrorCode.WRITE_FAILED, 'Échec écriture des données du dossier.', { cause: err, dossierId: id });
  }
}

let writeChain = Promise.resolve();
function withLock(task) {
  const run = writeChain.then(task, task); // exécute même si la précédente a rejeté
  // On garde la chaîne "propre" pour ne pas propager les rejets aux suivants.
  writeChain = run.then(() => undefined, () => undefined);
  return run;
}

export async function removeDossier(id) {
  return withLock(async () => {
    try {
      await dataStore.removeItem(DATA_PREFIX + id);
      const index = await readIndex();
      const updatedIndex = index.filter(d => d.id !== id);
      await writeIndex(updatedIndex);
    } catch (err) {
      throw new StorageError(StorageErrorCode.WRITE_FAILED, 'Échec suppression du dossier.', { cause: err, dossierId: id });
    }
  });
}

export async function saveFullDossier(id, name, date, data) {
  return withLock(async () => {
    // Ordre sûr: on écrit les données D'ABORD, pour que l'index ne pointe pas vers le vide
    await writeData(id, data);
    
    const index = await readIndex();
    const existingIdx = index.findIndex(d => d.id === id);
    if (existingIdx >= 0) {
        index[existingIdx] = { id, name, date };
    } else {
        index.unshift({ id, name, date });
    }
    await writeIndex(index);
    return index;
  });
}
