/**
 * Service de résolution et normalisation des dates de sinistre.
 *
 * RÈGLE MÉTIER ABSOLUE (Bureau Péchard) :
 * - On n'invente JAMAIS une date.
 * - Une date critique sortant de l'IA est une donnée NON FIABLE tant qu'elle
 *   n'a pas été validée par cette couche.
 * - Le format de sortie canonique est STRICTEMENT "DD/MM/YYYY".
 *
 * Stratégie de fallback (priorité décroissante) :
 *   1. Date du sinistre extraite par l'IA (si réellement valide).
 *   2. Date de déclaration (si fournie et valide).
 *   3. Date du jour (filet de sécurité ultime, garantit zéro champ bloquant).
 *
 * @module services/dates/dateResolver
 */

/** Tokens interdits renvoyés par l'IA pour une date inconnue. */
const INVALID_DATE_TOKENS = ['confirmer', 'determiner', 'déterminer', 'inconnu', 'nc', 'n/a'];

/**
 * Parse une chaîne de date tolérante (DD/MM/YY, DD/MM/YYYY, DD-MM-YYYY...).
 * @param {unknown} raw
 * @returns {Date|null} Date valide ou null si non parsable / impossible.
 */
function parseFlexibleDate(raw) {
    if (typeof raw !== 'string') return null;

    const cleaned = raw.trim();
    if (!cleaned) return null;

    const lower = cleaned.toLowerCase();
    if (INVALID_DATE_TOKENS.some((token) => lower.includes(token))) return null;

    // Format attendu : DD/MM/YYYY ou DD/MM/YY (séparateurs / . -)
    const match = cleaned.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);
    if (!match) return null;

    let [, dayStr, monthStr, yearStr] = match;
    const day = Number(dayStr);
    const month = Number(monthStr);
    let year = Number(yearStr);

    // Normalisation année 2 chiffres -> 4 chiffres (pivot 2000).
    if (yearStr.length === 2) {
        year += 2000;
    }

    // Validation stricte : la date doit RÉELLEMENT exister (refuse 31/02, 45/13...).
    const date = new Date(year, month - 1, day);
    const isReal =
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day;

    return isReal ? date : null;
}

/**
 * Formate une Date en chaîne canonique DD/MM/YYYY.
 * @param {Date} date
 * @returns {string}
 */
function formatCanonical(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear());
    return `${day}/${month}/${year}`;
}

/**
 * Résout la date de sinistre fiable selon la stratégie de fallback métier.
 *
 * @param {object} params
 * @param {unknown} params.aiDate          - Date brute renvoyée par l'IA.
 * @param {unknown} [params.declarationDate] - Date de déclaration (formData).
 * @param {Date}    [params.now]           - Injectable pour la testabilité.
 * @returns {{ date: string, source: 'sinistre'|'declaration'|'fallback_today' }}
 */
export function resolveSinistreDate({ aiDate, declarationDate, now = new Date() }) {
    const fromAi = parseFlexibleDate(aiDate);
    if (fromAi) {
        return { date: formatCanonical(fromAi), source: 'sinistre' };
    }

    const fromDeclaration = parseFlexibleDate(declarationDate);
    if (fromDeclaration) {
        return { date: formatCanonical(fromDeclaration), source: 'declaration' };
    }

    return { date: formatCanonical(now), source: 'fallback_today' };
}
