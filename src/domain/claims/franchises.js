/**
 * @typedef {Object} FranchiseOption
 * @property {string} id            Identifiant stable (clé React + référence métier).
 * @property {string} label         Libellé affiché à l'utilisateur.
 * @property {'amount'|'text'} kind  Nature : montant calculable ou clause textuelle.
 * @property {number|null} amount    Montant normalisé (null si non calculable).
 */

/** @type {ReadonlyArray<FranchiseOption>} */
export const STANDARD_FRANCHISES = Object.freeze([
  { id: 'fr_250',     label: '250.00',                   kind: 'amount', amount: 250 },
  { id: 'fr_300',     label: '300.00',                   kind: 'amount', amount: 300 },
  { id: 'fr_legale',  label: 'Franchise légale indexée', kind: 'text',   amount: null },
  { id: 'fr_sans',    label: 'Sans franchise',           kind: 'text',   amount: 0 },
  { id: 'fr_anglaise',label: 'Franchise anglaise',       kind: 'text',   amount: null },
]);

/**
 * Normalise une saisie libre vers un format standard pour fiabiliser
 * le stockage et les futurs calculs d'indemnités.
 * - "250€" / "250 euros" / "250,00" -> "250.00"
 * @param {string} raw
 * @returns {string} valeur normalisée (ne perd jamais la saisie de l'utilisateur)
 */
export function normalizeFranchiseInput(raw) {
  if (raw == null) return '';
  const trimmed = String(raw).trim();
  if (trimmed === '') return '';

  // Détection d'un montant : on extrait les chiffres et un séparateur décimal éventuel.
  const numericMatch = trimmed
    .replace(/\s/g, '')
    .replace(',', '.')
    .match(/^(\d+(?:\.\d{1,2})?)\s*(?:€|eur|euros?)?$/i);

  if (numericMatch) {
    return Number(numericMatch[1]).toFixed(2); // "250" -> "250.00"
  }
  return trimmed; // clause textuelle : on conserve tel quel
}

/**
 * Indique si une valeur correspond à un standard connu (UI : badge "non standard").
 * @param {string} value
 * @param {ReadonlyArray<FranchiseOption>} options
 */
export function isStandardFranchise(value, options = STANDARD_FRANCHISES) {
  const norm = normalizeFranchiseInput(value);
  return options.some((o) => o.label === norm || o.label === value);
}
