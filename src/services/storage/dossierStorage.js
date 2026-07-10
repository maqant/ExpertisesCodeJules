import localforage from 'localforage';
import { StorageError, StorageErrorCode, isQuotaError } from './storageErrors';

// Flag de diagnostic — passer à false une fois le bug identifié.
const DEBUG_STORAGE = true;
function dlog(...args) {
  if (DEBUG_STORAGE) console.log('[dossierStorage]', ...args);
}

export class ConflictError extends Error {
  constructor(currentVersion, attemptedVersion, currentUpdatedAt) {
    super('CONFLICT: stored version is newer than the one being saved');
    this.name = 'ConflictError';
    this.currentVersion = currentVersion;
    this.attemptedVersion = attemptedVersion;
    this.currentUpdatedAt = currentUpdatedAt;
  }
}

const withTimeout = (promise, ms, name) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`[Storage Timeout] ${name} a bloqué après ${ms}ms`)), ms))
  ]);
};

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
  try {
    const fromIDB = await withTimeout(dataStore.getItem(INDEX_KEY), 5000, 'readIndex');
    return Array.isArray(fromIDB) ? fromIDB : [];
  } catch (err) {
    console.error("[dossierStorage] readIndex timeout/error:", err);
    return [];
  }
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
  try {
    await withTimeout(dataStore.setItem(INDEX_KEY, index), 5000, 'writeIndex');
  } catch (err) {
    console.error("[dossierStorage] writeIndex timeout/error:", err);
    throw err;
  }
}

export async function readData(id) {
  try {
    const data = await withTimeout(dataStore.getItem(DATA_PREFIX + id), 10000, 'readData');
    if (!data) throw new StorageError(StorageErrorCode.NOT_FOUND, `Dossier data not found: ${id}`);
    return data;
  } catch (err) {
    if (err instanceof StorageError) throw err;
    throw new StorageError(StorageErrorCode.READ_FAILED, 'Échec lecture des données du dossier.', { cause: err, dossierId: id });
  }
}

export async function writeData(id, data) {
  try {
    await withTimeout(dataStore.setItem(DATA_PREFIX + id, data), 15000, 'writeData');
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

export async function saveFullDossier(id, name, date, data, expectedVersion = 0, force = false) {
  dlog(`saveFullDossier START | id: ${id}, expectedVersion: ${expectedVersion}, force: ${force}`);
  return withLock(async () => {
    dlog(`withLock Acquired | id: ${id}`);
    const index = await readIndex();
    const existingIdx = index.findIndex(d => d.id === id);
    const currentVersion = existingIdx >= 0 ? (index[existingIdx].version || 0) : 0;
    dlog(`Index Read | existingIdx: ${existingIdx}, currentVersion: ${currentVersion}`);

    if (!force && currentVersion > (expectedVersion || 0)) {
      dlog(`CONFLICT DETECTED | current: ${currentVersion} > expected: ${expectedVersion}`);
      throw new ConflictError(currentVersion, expectedVersion, index[existingIdx]?.updatedAt);
    }

    const newVersion = currentVersion + 1;
    const updatedAt = Date.now();

    // Ordre sûr: on écrit les données D'ABORD, pour que l'index ne pointe pas vers le vide
    dlog(`Writing Data...`);
    await writeData(id, data);
    dlog(`Data Written`);
    
    if (existingIdx >= 0) {
        index[existingIdx] = { id, name, date, version: newVersion, updatedAt };
    } else {
        index.unshift({ id, name, date, version: newVersion, updatedAt });
    }
    dlog(`Writing Index...`);
    await writeIndex(index);
    dlog(`Index Written | newVersion: ${newVersion}`);
    return { version: newVersion, updatedAt };
  });
}
