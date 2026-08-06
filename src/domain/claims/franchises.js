/**
 * @typedef {Object} FranchiseOption
 * @property {string} id            Identifiant stable (clé React + référence métier).
 * @property {string} label         Libellé affiché à l'utilisateur.
 * @property {'amount'|'text'} kind  Nature : montant calculable ou clause textuelle.
 * @property {number|null} amount    Montant normalisé (null si non calculable).
 */

export const BUILTIN_CHRONOLOGICAL_FRANCHISES = [
  "Avril 2026 - 333,39 €", "Mars 2026 - 333,01 €", "Février 2026 - 331,21 €", "Janvier 2026 - 329,77 €", "Décembre 2025 - 329,55 €", 
  "Novembre 2025 - 327,71 €", "Octobre 2025 - 326,52 €", "Septembre 2025 - 327,49 €", "Août 2025 - 327,52 €", "Juillet 2025 - 325,93 €", 
  "Juin 2025 - 324,79 €", "Mai 2025 - 325,30 €", "Avril 2025 - 328,01 €", "Mars 2025 - 328,26 €", "Février 2025 - 327,60 €", 
  "Janvier 2025 - 323,13 €", "Décembre 2024 - 321,84 €", "Novembre 2024 - 321,30 €", "Octobre 2024 - 319,76 €", "Septembre 2024 - 321,36 €", 
  "Août 2024 - 321,36 €", "Juillet 2024 - 319,09 €", "Juin 2024 - 318,38 €", "Mai 2024 - 317,22 €", "Avril 2024 - 318,75 €", 
  "Mars 2024 - 317,00 €", "Février 2024 - 314,75 €", "Janvier 2024 - 313,22 €", "Décembre 2023 - 311,88 €", "Novembre 2023 - 311,34 €", 
  "Octobre 2023 - 310,27 €", "Septembre 2023 - 312,43 €", "Août 2023 - 310,05 €", "Juillet 2023 - 307,57 €", "Juin 2023 - 308,02 €", 
  "Mai 2023 - 306,86 €", "Avril 2023 - 308,92 €", "Mars 2023 - 307,17 €", "Février 2023 - 309,33 €", "Janvier 2023 - 309,04 €", 
  "Décembre 2022 - 309,53 €", "Novembre 2022 - 310,23 €", "Octobre 2022 - 303,04 €", "Septembre 2022 - 300,16 €", "Août 2022 - 297,75 €", 
  "Juillet 2022 - 295,30 €", "Juin 2022 - 292,80 €", "Mai 2022 - 290,58 €", "Avril 2022 - 289,61 €", "Mars 2022 - 288,11 €", 
  "Février 2022 - 286,30 €", "Janvier 2022 - 280,05 €"
];

export const PINNED_FRANCHISE_OPTIONS = Object.freeze([
  { id: 'fr_sans',     label: 'Sans franchise',           kind: 'text',   amount: 0 },
  { id: 'fr_legale',   label: 'Franchise légale indexée', kind: 'text',   amount: null },
  { id: 'fr_anglaise', label: 'Franchise anglaise',       kind: 'text',   amount: null },
]);

export const TRAILING_FRANCHISE_OPTIONS = Object.freeze([
  { id: 'fr_250',     label: '250.00',                   kind: 'amount', amount: 250 },
  { id: 'fr_300',     label: '300.00',                   kind: 'amount', amount: 300 },
]);

const FRENCH_MONTHS = Object.freeze({
  'janvier': 1, 'fevrier': 2, 'mars': 3, 'avril': 4, 'mai': 5, 'juin': 6,
  'juillet': 7, 'aout': 8, 'septembre': 9, 'octobre': 10, 'novembre': 11, 'decembre': 12,
});

const normalizeToken = (str) =>
  String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/**
 * Extrait un score chronologique d'un libellé "Mois AAAA - montant".
 * @returns {{ score: number, dated: true } | { dated: false }}
 */
export function parseFranchiseChronology(label) {
  const match = /^([A-Za-zÀ-ÿ]+)\s+(\d{4})\b/.exec(String(label).trim());
  if (!match) return { dated: false };
  const month = FRENCH_MONTHS[normalizeToken(match[1])];
  const year = Number(match[2]);
  if (!month || !Number.isFinite(year)) return { dated: false };
  return { dated: true, score: year * 100 + month };
}

/**
 * Tri chronologique décroissant (plus récent en premier).
 */
export function sortFranchisesChronologically(labels) {
  const dated = [];
  const undated = [];
  labels.forEach((label, index) => {
    const chrono = parseFranchiseChronology(label);
    if (chrono.dated) dated.push({ label, score: chrono.score, index });
    else undated.push({ label, index });
  });
  dated.sort((a, b) => (b.score - a.score) || (a.index - b.index));
  return [...dated.map(d => d.label), ...undated.map(u => u.label)];
}

/**
 * Source de vérité unique pour TOUTES les surfaces (Paramètres + Modales).
 * Fusionne builtins + franchises utilisateur, déduplique, trie chronologiquement décroissant.
 */
export function buildUnifiedFranchisesOptions(userFranchises = []) {
  const safeUser = Array.isArray(userFranchises)
    ? userFranchises.filter(f => typeof f === 'string' && f.trim() !== '')
    : [];

  const seen = new Set();
  const merged = [];
  for (const label of [...safeUser, ...BUILTIN_CHRONOLOGICAL_FRANCHISES]) {
    const key = normalizeToken(label).replace(/\s+/g, ' ');
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(label.trim());
  }

  const sorted = sortFranchisesChronologically(merged);

  return [
    ...PINNED_FRANCHISE_OPTIONS,
    ...sorted.map((label, idx) => ({ id: `dyn_${idx}`, label, kind: 'text', amount: null })),
    ...TRAILING_FRANCHISE_OPTIONS,
  ];
}

export const IMMUTABLE_CHRONOLOGICAL_FRANCHISES = Object.freeze(buildUnifiedFranchisesOptions([]));
export const STANDARD_FRANCHISES = IMMUTABLE_CHRONOLOGICAL_FRANCHISES;

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
