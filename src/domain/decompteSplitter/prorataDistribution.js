import { cleanAmount } from '../../store/financeStore.js';
import { ALLOCATION_STATUS, genId, getResteAVentiler } from './allocationModel.js';

/**
 * Erreurs métier explicites — jamais d'échec silencieux.
 */
export const PRORATA_ERRORS = {
    NO_BASE: 'PRORATA_NO_BASE',           // aucune allocation de base exploitable
    NOTHING_TO_DISTRIBUTE: 'PRORATA_ZERO', // reste à ventiler nul
};

/**
 * Calcule les poids de prorata par bloc destinataire, à partir des
 * allocations existantes (hors poste cible, hors suspendues).
 *
 * @param {string} targetExpenseId - Poste à distribuer (exclu de la base)
 * @param {Array} allocations - Toutes les allocations du draft
 * @param {Array<string>|null} baseExpenseIds - Optionnel: restreint la base à certains postes (extension V2)
 * @returns {Array<{blockId: string, poidsCentimes: number}>}
 */
export const computeProrataWeights = (targetExpenseId, allocations, baseExpenseIds = null) => {
    if (Array.isArray(baseExpenseIds) && baseExpenseIds.length === 0) {
        throw Object.assign(new Error('La base de prorata sélectionnée est vide.'), { code: PRORATA_ERRORS.NO_BASE });
    }

    const byBlock = new Map();
    for (const a of allocations) {
        if (a.expenseId === targetExpenseId) continue;            // pas d'auto-référence
        if (a.status === ALLOCATION_STATUS.SUSPENDED) continue;   // cohérent avec getResteAVentiler
        if (baseExpenseIds && !baseExpenseIds.includes(a.expenseId)) continue;
        const cents = Math.round(cleanAmount(a.montant) * 100);
        byBlock.set(a.blockId, (byBlock.get(a.blockId) || 0) + cents);
    }
    return [...byBlock.entries()]
        .filter(([, cents]) => cents > 0) // un bloc à poids nul ou négatif ne reçoit rien
        .map(([blockId, poidsCentimes]) => ({ blockId, poidsCentimes }));
};

/**
 * Répartit un montant (centimes entiers, signe quelconque) selon des poids,
 * par la méthode du plus fort reste (largest remainder).
 * INVARIANT GARANTI : somme(parts) === montantCentimes, au centime exact.
 *
 * @param {number} montantCentimes - Entier (peut être négatif, ex: franchise)
 * @param {Array<{blockId: string, poidsCentimes: number}>} weights
 * @returns {Array<{blockId: string, montantCentimes: number}>}
 */
export const splitLargestRemainder = (montantCentimes, weights) => {
    const totalPoids = weights.reduce((s, w) => s + w.poidsCentimes, 0);
    if (totalPoids <= 0) {
        throw Object.assign(new Error('Base de prorata vide ou nulle'), { code: PRORATA_ERRORS.NO_BASE });
    }
    const sign = montantCentimes < 0 ? -1 : 1;
    const absTotal = Math.abs(montantCentimes);

    // Étape 1 : parts entières + parts fractionnaires
    const rows = weights.map((w, index) => {
        const exact = (absTotal * w.poidsCentimes) / totalPoids;
        const floor = Math.floor(exact);
        return { blockId: w.blockId, floor, frac: exact - floor, index };
    });

    // Étape 2 : distribuer le reliquat aux plus fortes parts fractionnaires
    let reliquat = absTotal - rows.reduce((s, r) => s + r.floor, 0);
    const order = [...rows].sort((a, b) => (b.frac - a.frac) || (a.index - b.index)); // tie-break déterministe
    for (let i = 0; i < reliquat; i++) {
        order[i % order.length].floor += 1;
    }

    return rows.map(r => ({ blockId: r.blockId, montantCentimes: sign * r.floor }));
};

/**
 * Fonction d'orchestration : construit les allocations de prorata pour un poste.
 * Ne mute rien — retourne les nouvelles allocations à insérer, ou lève une erreur typée.
 *
 * @param {object} expense - Poste à distribuer
 * @param {Array} allocations - Allocations existantes du draft
 * @param {Array<string>|null} baseExpenseIds - Extension future (V2), défaut: tous les autres postes
 * @returns {Array} Nouvelles allocations (status ASSIGNED, origin 'prorata')
 * @throws {Error} avec .code ∈ PRORATA_ERRORS
 */
export const buildProrataAllocations = (expense, allocations, baseExpenseIds = null) => {
    const resteCentimes = Math.round(getResteAVentiler(expense, allocations) * 100);
    if (resteCentimes === 0) {
        throw Object.assign(new Error('Rien à ventiler sur ce poste'), { code: PRORATA_ERRORS.NOTHING_TO_DISTRIBUTE });
    }

    const weights = computeProrataWeights(expense.id, allocations, baseExpenseIds);
    if (weights.length === 0) {
        throw Object.assign(
            new Error('Aucune répartition existante pour calculer le prorata'),
            { code: PRORATA_ERRORS.NO_BASE }
        );
    }

    const parts = splitLargestRemainder(resteCentimes, weights);

    return parts
        .filter(p => p.montantCentimes !== 0) // pas d'allocation fantôme à 0€
        .map(p => ({
            id: genId(),
            expenseId: expense.id,
            blockId: p.blockId,
            montant: (p.montantCentimes / 100).toString(),
            status: ALLOCATION_STATUS.ASSIGNED,
            origin: 'prorata', // traçabilité optionnelle
        }));
};
