import { cleanAmount } from '../../store/financeStore.js';

export const ALLOCATION_STATUS = { ASSIGNED: 'assigned', SPLIT: 'split', SUSPENDED: 'suspended' };
export const CLOSURE_MODE = { CLOTURE: 'cloture', ATTENTE: 'attente' };

export const genId = () => crypto.randomUUID();

/**
 * Calcul du reste à ventiler pour un poste.
 * @param {object} expense - Le poste financier
 * @param {Array} allocations - Toutes les allocations du draft
 * @returns {number}
 */
export const getResteAVentiler = (expense, allocations) => {
    const cible = cleanAmount(expense.montantValide || expense.montantReclame);
    const alloue = allocations
        .filter(a => a.expenseId === expense.id && a.status !== ALLOCATION_STATUS.SUSPENDED)
        .reduce((s, a) => s + cleanAmount(a.montant), 0);
    // Arrondi 2 décimales
    return Math.round((cible - alloue) * 100) / 100;
};

/**
 * Vérifie la validité globale du draft avant export.
 * Invariant : Aucun poste avec un "reste" (non-nul) qui ne soit pas suspendu.
 * Invariant : Tous les blocs doivent avoir soit un destinataire soit des données override.
 * @param {Array} expenses 
 * @param {object} draft 
 * @returns {object} { isValid: boolean, errors: Array }
 */
export const validateDraft = (expenses, draft) => {
    const errors = [];
    
    // Vérification des postes financiers
    expenses.forEach(exp => {
        const reste = getResteAVentiler(exp, draft.allocations);
        const isSuspended = draft.allocations.some(
            a => a.expenseId === exp.id && a.status === ALLOCATION_STATUS.SUSPENDED
        );
        
        if (Math.abs(reste) > 0.001 && !isSuspended) {
            errors.push({ 
                type: 'UNBALANCED_EXPENSE', 
                expenseId: exp.id, 
                reste,
                message: `Le poste doit être entièrement ventilé ou mis en suspens (Reste: ${reste}€)`
            });
        }
    });

    // Vérification des blocs
    draft.blocks.forEach(b => {
        if (!b.recipientId && !b.recipientSnapshot?.displayName) {
            errors.push({
                type: 'INVALID_BLOCK',
                blockId: b.id,
                message: `Bloc sans destinataire ni saisie manuelle.`
            });
        }
    });

    return {
        isValid: errors.length === 0,
        errors
    };
};
