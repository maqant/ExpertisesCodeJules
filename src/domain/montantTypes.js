/**
 * Source de vérité unique pour les types de montant.
 * Toute valeur issue de l'IA DOIT passer par normalizeTypeMontant()
 * avant calcul ou affichage. Zéro erreur silencieuse : toute
 * normalisation non triviale est loguée.
 */

export const TYPE_MONTANT = Object.freeze({
  HTVA: 'HTVA',
  TVAC: 'TVAC',
  FORFAIT: 'Forfait',
});

export const TYPE_MONTANT_VALUES = Object.freeze(
  Object.values(TYPE_MONTANT)
);

const ALIASES = Object.freeze({
  // -> TVAC : un montant "TVA"/"TTC" sur justificatif = montant toutes taxes
  'TVA': TYPE_MONTANT.TVAC,
  'TTC': TYPE_MONTANT.TVAC,
  'T.T.C.': TYPE_MONTANT.TVAC,
  'TVAC': TYPE_MONTANT.TVAC,
  // -> HTVA
  'HT': TYPE_MONTANT.HTVA,
  'H.T.': TYPE_MONTANT.HTVA,
  'HTVA': TYPE_MONTANT.HTVA,
  'H.T.V.A.': TYPE_MONTANT.HTVA,
  'HORS TVA': TYPE_MONTANT.HTVA,
  // -> Forfait
  'FORFAIT': TYPE_MONTANT.FORFAIT,
  'FORFAITAIRE': TYPE_MONTANT.FORFAIT,
});

/** Dédoublonnage : chaque anomalie distincte est loguée une seule fois par session. */
const _warnedMessages = new Set();
function warnOnce(message) {
  if (_warnedMessages.has(message)) return;
  _warnedMessages.add(message);
  console.warn(message);
}

/**
 * Normalise un typeMontant quelconque (IA, historique, saisie)
 * vers une valeur canonique. Fallback conservateur : HTVA.
 * @param {unknown} raw
 * @param {{ silent?: boolean, context?: string }} [opts]
 * @returns {'HTVA'|'TVAC'|'Forfait'}
 */
export function normalizeTypeMontant(raw, opts = {}) {
  if (raw == null || raw === '') {
    if (!opts.silent) {
      warnOnce(
        `[montantTypes] typeMontant absent${opts.context ? ` (${opts.context})` : ''} → fallback HTVA`
      );
    }
    return TYPE_MONTANT.HTVA;
  }
  const key = String(raw).trim().toUpperCase();
  const canonical = ALIASES[key];
  if (canonical) {
    if (canonical !== raw && !opts.silent) {
      warnOnce(
        `[montantTypes] typeMontant "${raw}" normalisé en "${canonical}"${opts.context ? ` (${opts.context})` : ''}`
      );
    }
    return canonical;
  }
  if (!opts.silent) {
    warnOnce(
      `[montantTypes] typeMontant inconnu "${raw}"${opts.context ? ` (${opts.context})` : ''} → fallback HTVA`
    );
  }
  return TYPE_MONTANT.HTVA;
}

/**
 * Parse un montant potentiellement sale ("1 234,56 €", null…)
 * en nombre fiable. Retourne 0 si inexploitable (jamais NaN).
 * @param {unknown} raw
 * @returns {number}
 */
export function parseMontant(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0;
  if (raw == null) return 0;
  const cleaned = String(raw)
    .replace(/[€\s\u00A0]/g, '')
    .replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Crée un accumulateur de totaux initialisé (anti-NaN garanti).
 * @returns {{ HTVA: number, TVAC: number, Forfait: number, totalGlobal: number }}
 */
export function createTotauxAccumulator() {
  return { HTVA: 0, TVAC: 0, Forfait: 0, totalGlobal: 0 };
}

/**
 * Accumule un frais dans un accumulateur créé par createTotauxAccumulator.
 * Mutation contrôlée, jamais de NaN.
 * @param {ReturnType<typeof createTotauxAccumulator>} acc
 * @param {unknown} rawTypeMontant
 * @param {unknown} rawMontant
 * @param {{ context?: string, silent?: boolean } | string} [opts]
 *        Objet d'options. Rétrocompatibilité : une string est interprétée comme context.
 */
export function accumulateFrais(acc, rawTypeMontant, rawMontant, opts = {}) {
  const options = typeof opts === 'string' ? { context: opts } : opts;
  const type = normalizeTypeMontant(rawTypeMontant, options);
  const val = parseMontant(rawMontant);
  acc[type] += val;
  acc.totalGlobal += val;
  return acc;
}
