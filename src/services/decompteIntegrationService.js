import { useFinanceStore } from '../store/financeStore.js';

/**
 * Traduit l'état du Splitter en actions sur le store global (financeStore).
 * Calcule quels frais (expenses) créer et le paiement global à injecter.
 */
export function integrateToDossier(state) {
    const store = useFinanceStore.getState();
    const { expenses, blocks, allocations, detectedMeta } = state;

    // 1. Déduire les expenses à créer
    // Pour simplifier l'intégration, on crée chaque "allocation" comme une dépense séparée
    // assignée au `compteDe` (occupant)
    
    let addedExpensesCount = 0;
    
    allocations.forEach(alloc => {
        // Retrouver le bloc destinataire
        const block = blocks.find(b => b.id === alloc.blockId);
        if (!block) return;
        
        // Retrouver la dépense originale
        const originalExpense = expenses.find(e => e.id === alloc.expenseId);
        if (!originalExpense) return;

        // Montant ventilé
        const montantStr = alloc.amount;

        // Création de la dépense dans le store
        store.addExpense({
            desc: originalExpense.desc,
            montantReclame: montantStr,
            montantValide: montantStr,
            typeMontant: 'HTVA',
            compteDe: block.occupantId || null, // L'ID de l'occupant s'il a été mappé dans le UI
            prestataire: block.intervenantId ? "Intervenant existant" : null,
            source: 'ingestion_hub',
            factureRecue: true, // Si c'est un décompte/paiement, la facture est reçue/traitée
            isProcessed: true
        });
        
        addedExpensesCount++;
    });

    // 2. Création du Paiement global (si applicable)
    // On somme les montants validés. 
    // ATTENTION: Vu qu'on a gardé les montants en string formatées ("1.234,56"), 
    // on doit faire une conversion simple pour faire la somme.
    let totalCents = 0;
    allocations.forEach(alloc => {
        const cleaned = alloc.amount.replace(/\s|\u00A0|€/g, '').replace(',', '.');
        totalCents += Math.round(Number(cleaned) * 100);
    });

    const totalEuroStr = (totalCents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let paymentAdded = false;
    if (totalCents > 0) {
        store.addPaiement({
            dateRecept: detectedMeta?.dateISO || new Date().toISOString().split('T')[0],
            montantTotal: Number(totalCents / 100),
            source: 'ingestion_hub',
            beneficiaire: detectedMeta?.beneficiaire?.nom || 'Inconnu',
            reference: detectedMeta?.reference || '',
            communication: 'Paiement décompte',
            ventilations: allocations // On garde une trace des ventilations
        });
        paymentAdded = true;
    }

    return { addedExpensesCount, paymentAdded, totalEuroStr };
}
