import { useFinanceStore } from '../store/financeStore.js';

/**
 * Traduit l'état du Splitter en actions sur le store global (financeStore).
 * Calcule quels frais (expenses) créer à partir des allocations ventilées.
 */
export function integrateToDossier(state) {
    const store = useFinanceStore.getState();
    const { extractedExpenses, blocks, allocations, detectedMeta } = state;

    if (!allocations || !Array.isArray(allocations)) {
        throw new Error('Aucune ventilation trouvée dans l\'état du gestionnaire.');
    }

    let addedExpensesCount = 0;
    
    allocations.forEach(alloc => {
        // Retrouver le bloc destinataire
        const block = blocks?.find(b => b.id === alloc.blockId);
        if (!block) return;
        
        // Retrouver la dépense originale
        const originalExpense = extractedExpenses?.find(e => e.id === alloc.expenseId);
        if (!originalExpense) return;

        // Montant ventilé (le champ dans le reducer s'appelle "montant")
        const montantStr = alloc.montant || '0,00';

        // Création de la dépense dans le store
        store.addExpense({
            desc: originalExpense.desc || originalExpense.type || 'Poste importé',
            montantReclame: montantStr,
            montantValide: montantStr,
            typeMontant: 'HTVA',
            compteDe: block.occupantId || null,
            prestataire: block.intervenantId ? "Intervenant existant" : null,
            source: 'ingestion_hub',
            factureRecue: true,
            isProcessed: true
        });
        
        addedExpensesCount++;
    });

    // 2. Calcul du total pour le résumé
    let totalCents = 0;
    allocations.forEach(alloc => {
        const raw = alloc.montant || '0';
        const cleaned = raw.replace(/\s|\u00A0|€/g, '').replace(',', '.');
        const val = Number(cleaned);
        if (!isNaN(val)) totalCents += Math.round(val * 100);
    });

    const totalEuroStr = (totalCents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Note: Le store ne possède pas de méthode addPaiement pour le moment.
    // Le paiement est géré manuellement via le Suivi des Règlements.
    const paymentAdded = false;

    return { addedExpensesCount, paymentAdded, totalEuroStr };
}
