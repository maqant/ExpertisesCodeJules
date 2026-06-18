import localforage from 'localforage';

/**
 * fileDropResolver — Service d'unification documentaire.
 *
 * Résout le jeu documentaire complet à envoyer à l'IA d'ingestion globale.
 * Fonction métier pure (en dehors des dépendances UI).
 *
 * @param {Object} params
 * @param {File[]} params.droppedFiles   Fichiers glissés dans le Smart Bridge.
 * @param {Object} params.attachedFiles  Map du ExpertiseContext (clé -> {name, dbKey, type, ...}[]).
 * @param {string[]} params.contractualKeys  Clés à toujours inclure si présentes.
 * @returns {Promise<{
 *   files: File[],                 // union dédupliquée, prête pour processGlobalIngestion
 *   provenance: Array<{ source: 'dropped'|'context', key?: string, name: string }>,
 *   includedContractualKeys: string[],
 *   missingContractualKeys: string[]
 * }>}
 */
export async function resolveIngestionDocumentSet({
    droppedFiles = [],
    attachedFiles = {},
    contractualKeys = ['doc_cond_part', 'doc_cond_gen'],
}) {
    const finalFiles = [];
    const provenance = [];
    const includedContractualKeys = [];
    const missingContractualKeys = [];

    // On index les fichiers glissés pour déduplication rapide
    const droppedFileNames = new Set();
    
    for (const f of droppedFiles) {
        if (!f || !f.name) continue;
        finalFiles.push(f);
        droppedFileNames.add(f.name.toLowerCase());
        provenance.push({ source: 'dropped', name: f.name });
    }

    for (const key of contractualKeys) {
        const docs = attachedFiles[key];
        if (docs && docs.length > 0) {
            includedContractualKeys.push(key);
            for (const docInfo of docs) {
                // Déduplication : si un fichier avec le même nom a été glissé, on l'ignore.
                if (droppedFileNames.has(docInfo.name.toLowerCase())) {
                    continue;
                }
                
                // Reconstruire l'objet File depuis localforage
                try {
                    const arrayBuffer = await localforage.getItem(docInfo.dbKey);
                    if (arrayBuffer) {
                        const file = new File([arrayBuffer], docInfo.name, { type: docInfo.type });
                        // Ajouter le flag pour identifier la source contextuelle si besoin
                        Object.defineProperty(file, '__isContextFile', { value: true, enumerable: true });
                        finalFiles.push(file);
                        provenance.push({ source: 'context', key, name: docInfo.name });
                    }
                } catch (e) {
                    console.warn(`[resolveIngestionDocumentSet] Impossible de lire le fichier contextuel ${docInfo.name}`, e);
                }
            }
        } else {
            missingContractualKeys.push(key);
        }
    }

    return {
        files: finalFiles,
        provenance,
        includedContractualKeys,
        missingContractualKeys
    };
}
