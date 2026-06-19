/**
 * @module textSanitizer
 * @description Frontière de sanitisation pour TOUTES les données textuelles
 * déstructurées entrantes (mails, .msg, .rtf, copier-coller).
 *
 * Responsabilité unique : transformer un texte potentiellement corrompu
 * (mojibake, encodage mixte, caractères de contrôle) en texte UTF-8 propre,
 * de manière DÉTERMINISTE et TESTABLE. Aucune dépendance UI.
 *
 * Contrainte projet : fiabilité totale → correction exacte, pas de devinette.
 */

/**
 * Signatures caractéristiques du mojibake UTF-8 lu comme Windows-1252.
 * Si ces séquences sont présentes, le texte est presque certainement corrompu.
 * @type {RegExp}
 */
const MOJIBAKE_SIGNATURE = /[ÃÂâ][\u0080-\u00BF\u2013\u2014\u20AC\u2122œ]|Ã©|Ã¨|Ã |Ã§|Ã´|Ã®|Ã»|Ã¼|Ã«|â€/;

/**
 * Détecte la présence probable de mojibake.
 * @param {string} text
 * @returns {boolean}
 */
export function hasMojibake(text) {
  if (typeof text !== 'string' || text.length === 0) return false;
  return MOJIBAKE_SIGNATURE.test(text);
}

/**
 * Corrige le mojibake UTF-8/Windows-1252 par ré-encodage exact.
 *
 * Algorithme :
 *  texte mal décodé -> reconstruction des octets CP1252 -> re-décodage UTF-8.
 *
 * Garde-fou : la correction n'est appliquée que si (a) une signature est
 * détectée ET (b) le résultat est un UTF-8 valide ne contenant plus la
 * signature. Sinon on retourne le texte original intact (fail-safe).
 *
 * @param {string} text
 * @returns {string} texte corrigé, ou texte original si correction non sûre
 */
export function fixMojibake(text) {
  if (typeof text !== 'string' || text.length === 0) return text ?? '';
  if (!hasMojibake(text)) return text;

  try {
    // 1. Reconstruire la séquence d'octets : chaque char (code 0-255) = 1 octet.
    //    Si un code point dépasse 255, le texte n'est pas du pur mojibake CP1252
    //    -> on abandonne pour ne pas corrompre.
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      const code = text.charCodeAt(i);
      if (code > 0xff) {
        return text; // Caractère hors plage octet -> non corrigeable proprement
      }
      bytes[i] = code;
    }

    // 2. Re-décoder en UTF-8 strict (fatal: true lève si octets invalides).
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);

    // 3. Validation : la correction doit avoir éliminé la signature.
    if (hasMojibake(decoded)) {
      return text; // Correction inefficace -> on n'aggrave pas
    }

    return decoded;
  } catch {
    // TextDecoder fatal a levé -> les octets ne formaient pas un UTF-8 valide.
    // Le texte n'était pas du mojibake UTF-8 standard -> on ne touche à rien.
    return text;
  }
}

/**
 * Normalisation Unicode et nettoyage des artefacts non sémantiques.
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  if (typeof text !== 'string') return '';
  return text
    .normalize('NFC')                       // Composition canonique (é précomposé)
    .replace(/\u00A0/g, ' ')                // Espace insécable -> espace normal
    .replace(/[\u200B-\u200D\uFEFF]/g, '')  // Zero-width + BOM
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); // Ctrl chars (garde \n \r \t)
}

/**
 * Pipeline complet de sanitisation d'ingestion.
 * Point d'entrée UNIQUE à appeler sur toute donnée textuelle entrante.
 *
 * @param {string} rawText
 * @returns {string}
 */
export function sanitizeIngestedText(rawText) {
  if (typeof rawText !== 'string') return '';
  const deMojibaked = fixMojibake(rawText);
  return normalizeText(deMojibaked);
}
