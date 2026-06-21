// src/services/storage/referenceStorage.js
import { STORAGE_KEYS } from './storageKeys';

/**
 * Lecture localStorage tolérante aux pannes.
 * Ne crash JAMAIS le boot : retourne le fallback si parsing impossible.
 */
export function safeRead(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[referenceStorage] Lecture corrompue pour "${key}". Fallback appliqué.`, err);
    return fallback;
  }
}

export function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[referenceStorage] Écriture impossible pour "${key}".`, err);
    return false;
  }
}

export { STORAGE_KEYS };
