/**
 * Politique de fusion par champ — source unique de vérité métier.
 * Un champ "cumulatif" est un champ narratif que l'agent IA enrichit
 * par accumulation (prompt NARRATIVE_ACCUMULATION) plutôt que par remplacement.
 * Toute évolution de cette liste doit rester alignée avec les agents narratifs.
 */

/** Champs dont la valeur IA est une fusion cumulative de l'existant + nouveau document. */
export const ACCUMULATIVE_FIELDS = Object.freeze(['cause', 'divers']);

/**
 * Ratio de sécurité anti-perte : si la valeur IA est plus courte que
 * (longueur existante × ratio), l'accumulation est suspecte (perte probable
 * de contenu humain) et le champ est rétrogradé en CONFLICT.
 */
export const ACCUMULATION_MIN_LENGTH_RATIO = 0.9;

export const isAccumulativeField = (key) => ACCUMULATIVE_FIELDS.includes(key);
