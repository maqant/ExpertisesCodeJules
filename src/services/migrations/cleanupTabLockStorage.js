/**
 * Migration one-shot : purge des clés localStorage liées à l'ancien
 * système de verrouillage multi-onglets (tabLock), supprimé.
 *
 * À appeler UNE FOIS au démarrage de l'application (point d'entrée),
 * AVANT tout chargement de dossier.
 *
 * Idempotent : peut être appelé à chaque démarrage sans effet de bord.
 */

const MIGRATION_FLAG = 'expertises:migration:tabLockRemoved:v1';

const LOCK_KEY_PATTERNS = [
  /^expertise_dossier_lock_/
];

function matchesLockPattern(key) {
  return LOCK_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * @returns {{ migrated: boolean, removedKeys: string[] }}
 */
export function cleanupTabLockStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { migrated: false, removedKeys: [] };
  }

  try {
    if (localStorage.getItem(MIGRATION_FLAG) === 'done') {
      return { migrated: false, removedKeys: [] };
    }

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && matchesLockPattern(key)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(MIGRATION_FLAG, 'done');

    if (keysToRemove.length > 0) {
      console.info(
        `[migration] tabLock supprimé : ${keysToRemove.length} clé(s) orpheline(s) purgée(s).`,
        keysToRemove,
      );
    }

    return { migrated: true, removedKeys: keysToRemove };
  } catch (err) {
    console.error('[migration] Échec purge tabLock (non bloquant) :', err);
    return { migrated: false, removedKeys: [] };
  }
}
