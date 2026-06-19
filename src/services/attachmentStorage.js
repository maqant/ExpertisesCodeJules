import localforage from 'localforage';

/**
 * Unique point de contact avec IndexedDB pour les pièces jointes.
 * Garantit qu'aucun blob n'est laissé orphelin et que les erreurs
 * de persistance ne sont jamais avalées silencieusement.
 */

/**
 * Supprime un blob de manière robuste.
 * @param {string|null|undefined} dbKey
 * @returns {Promise<{ ok: boolean, error?: Error }>}
 */
export async function removeBlob(dbKey) {
  if (!dbKey) {
    // Pas de clé = rien à purger côté stockage. Ce n'est pas une erreur.
    return { ok: true };
  }
  try {
    await localforage.removeItem(dbKey);
    return { ok: true };
  } catch (error) {
    console.error(`[attachmentStorage] Échec suppression "${dbKey}"`, error);
    return { ok: false, error };
  }
}

/**
 * Supprime un lot de blobs. N'échoue pas en cascade :
 * tente toutes les suppressions et agrège les erreurs.
 * @param {Array<string|null|undefined>} dbKeys
 * @returns {Promise<{ ok: boolean, failedKeys: string[] }>}
 */
export async function removeBlobs(dbKeys = []) {
  const results = await Promise.allSettled(
    dbKeys.filter(Boolean).map((k) => removeBlob(k).then((r) => ({ k, ...r })))
  );
  const failedKeys = results
    .filter((r) => r.status === 'fulfilled' && !r.value.ok)
    .map((r) => r.value.k);
  return { ok: failedKeys.length === 0, failedKeys };
}
