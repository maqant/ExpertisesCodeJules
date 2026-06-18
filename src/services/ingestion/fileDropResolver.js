/**
 * fileDropResolver — Service d'ingestion bas niveau du Smart Bridge.
 *
 * Responsabilité unique : transformer un DragEvent en une liste plate et fiable
 * de File, en gérant fichiers ET arborescences de dossiers complètes.
 *
 * Aucune dépendance React. Testable unitairement. Réutilisable par tous les
 * futurs modules d'ingestion (pendant / post sinistre).
 */

const FULL_PATH_KEY = 'fullPath';

/**
 * Attache le chemin complet à un File de façon sûre, lisible et debuggable.
 * On utilise une propriété enumerable pour la visibilité, mais reconfigurable
 * pour éviter tout TypeError sur re-définition (clones successifs).
 */
export function setFullPath(file, fullPath) {
    if (!fullPath) return file;
    try {
        Object.defineProperty(file, FULL_PATH_KEY, {
            value: fullPath,
            enumerable: true,
            configurable: true,
            writable: true,
        });
    } catch {
        // Dernier recours : assignation directe (certains File polyfills).
        try { file[FULL_PATH_KEY] = fullPath; } catch { /* noop */ }
    }
    return file;
}

export function getFullPath(file) {
    return file?.[FULL_PATH_KEY] ?? file?.name ?? null;
}

/** Wrapping promisifié défensif des callbacks FileSystem API. */
const readFileFromEntry = (entry) =>
    new Promise((resolve, reject) => entry.file(resolve, reject));

/**
 * CRITIQUE : readEntries() ne renvoie qu'un LOT (~100 entrées) par appel.
 * Il faut le rappeler jusqu'à obtenir un tableau vide pour tout récupérer.
 */
const readAllDirectoryEntries = async (dirReader) => {
    const allEntries = [];
    let batch;
    do {
        batch = await new Promise((resolve, reject) =>
            dirReader.readEntries(resolve, reject)
        );
        allEntries.push(...batch);
    } while (batch.length > 0);
    return allEntries;
};

/**
 * Résout récursivement une FileSystemEntry en liste plate de File.
 * Tolérance aux pannes : une entrée illisible est ignorée (et signalée via
 * onError) sans faire échouer l'ingestion globale du dossier.
 */
const resolveEntry = async (entry, onError) => {
    try {
        if (entry.isFile) {
            const file = await readFileFromEntry(entry);
            setFullPath(file, entry.fullPath);
            return [file];
        }
        if (entry.isDirectory) {
            const dirReader = entry.createReader();
            const subEntries = await readAllDirectoryEntries(dirReader);
            const nested = await Promise.all(
                subEntries.map((sub) => resolveEntry(sub, onError))
            );
            return nested.flat();
        }
    } catch (err) {
        onError?.({ entry: entry?.fullPath ?? entry?.name, error: err });
    }
    return [];
};

/**
 * Point d'entrée du service.
 *
 * @param {DragEvent} dragEvent
 * @param {(info:{entry:string,error:Error})=>void} [onError]
 * @returns {Promise<File[]>}
 */
export async function resolveDroppedFiles(dragEvent, onError) {
    const { dataTransfer } = dragEvent;
    if (!dataTransfer) return [];

    // ÉTAPE 1 — SYNCHRONE : on capture entries et fichiers AVANT tout await.
    // Le DataTransferItemList est invalidé par le navigateur dès le 1er await.
    const entries = [];
    const flatFiles = []; // fallback si webkitGetAsEntry indisponible

    if (dataTransfer.items && dataTransfer.items.length > 0) {
        for (let i = 0; i < dataTransfer.items.length; i++) {
            const item = dataTransfer.items[i];
            if (item.kind !== 'file') continue;
            const entry = item.webkitGetAsEntry?.() ?? null;
            if (entry) {
                entries.push(entry);
            } else {
                const f = item.getAsFile();
                if (f) flatFiles.push(f);
            }
        }
    } else if (dataTransfer.files?.length > 0) {
        flatFiles.push(...Array.from(dataTransfer.files));
    }

    // ÉTAPE 2 — ASYNCHRONE : la liste DOM est désormais gelée, on peut awaiter.
    const resolvedFromEntries = (
        await Promise.all(entries.map((e) => resolveEntry(e, onError)))
    ).flat();

    return [...resolvedFromEntries, ...flatFiles];
}
