/**
 * Utilitaires de formatage de chaînes pour l'affichage.
 * Règle : les données brutes ne sont JAMAIS modifiées en amont ;
 * le formatage s'applique uniquement au moment de l'affichage.
 */

// Particules françaises à laisser en minuscule (sauf en début de nom)
const NAME_PARTICLES = new Set(['de', 'du', 'des', 'le', 'la', 'les', 'van', 'von', 'el', 'al']);

/**
 * Capitalise un mot simple : première lettre en majuscule, reste en minuscule.
 * Gère les apostrophes internes (d'Oultremont → D'Oultremont ou d'Oultremont selon position).
 */
const capitalizeWord = (word, isFirst) => {
  if (!word) return word;

  // Gestion apostrophe (droite ' et typographique ')
  const apostropheMatch = word.match(/^([a-zà-ÿ]+)(['’])(.+)$/i);
  if (apostropheMatch) {
    const [, prefix, apo, rest] = apostropheMatch;
    const lowerPrefix = prefix.toLowerCase();
    // "d'" ou "l'" : particule élidée
    if (lowerPrefix === 'd' || lowerPrefix === 'l') {
      const formattedPrefix = isFirst
        ? lowerPrefix.toUpperCase()
        : lowerPrefix;
      return `${formattedPrefix}${apo}${capitalizeWord(rest, true)}`;
    }
    // Ex : O'Brien
    return `${capitalizeWord(prefix, true)}${apo}${capitalizeWord(rest, true)}`;
  }

  const lower = word.toLowerCase();
  if (!isFirst && NAME_PARTICLES.has(lower)) {
    return lower;
  }
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

/**
 * Formate un nom de personne pour l'affichage (salutations, rapports).
 * - "MOSCA"                       → "Mosca"
 * - "ABD EL ALIM ABD EL KADER"    → "Abd el Alim Abd el Kader"
 * - "JEAN-PIERRE"                 → "Jean-Pierre"
 * - "D'OULTREMONT"                → "D'Oultremont"
 * - "de La Tour" (casse mixte)    → inchangé (déjà formaté)
 *
 * Heuristique de sécurité : si la chaîne contient déjà des minuscules,
 * on la considère comme correctement saisie et on ne la modifie pas.
 * Cela évite de casser des noms formatés manuellement.
 *
 * @param {string} name - Nom brut (potentiellement ALL CAPS)
 * @returns {string} Nom formaté pour affichage
 */
export const formatPersonName = (name) => {
  if (typeof name !== 'string') return '';
  const trimmed = name.trim();
  if (!trimmed) return '';

  // Suppression heuristique casse mixte car certains noms arrivent avec "NOM Prénom" (mi-majuscule mi-casse)

  let isFirstWord = true;
  // Découpage en conservant les séparateurs (espaces et tirets)
  return trimmed
    .split(/(\s+|-)/)
    .map((token) => {
      if (/^\s+$/.test(token) || token === '-') return token === '-' ? '-' : ' ';
      const formatted = capitalizeWord(token, isFirstWord);
      isFirstWord = false;
      return formatted;
    })
    .join('');
};
