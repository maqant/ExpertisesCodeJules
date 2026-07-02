import { cleanAmount } from '../../store/financeStore.js';
import { CLOSURE_MODE } from '../../domain/decompteSplitter/allocationModel.js';

/**
 * Nettoie une chaîne de caractères pour être sûre dans un TSV.
 * Remplace les tabulations et sauts de ligne par des espaces.
 */
const sanitizeTsvCell = (text) => {
    if (!text) return '';
    return String(text)
        .replace(/[\t\n\r]+/g, ' ')
        .trim();
};

/**
 * Formate un montant en string "FR" pour Excel (ex: 480,50)
 */
const formatAmountForExcel = (amountStr) => {
    const num = cleanAmount(amountStr);
    return num.toLocaleString('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: false // pas de séparateur de milliers pour éviter les bugs Excel si mal configuré
    }).replace('.', ',');
};

/**
 * Génère le contenu TSV pour copier dans Excel.
 * Format des colonnes : Date | Destinataire | Bénéficiaire Compte | IBAN | Libellé Poste | Montant | Statut Dossier
 * 
 * @param {object} draft - Le draft de ventilation
 * @param {Array} expenses - Les postes financiers d'origine
 * @param {string} currentDate - Date formatée (ex: 02/07/2026)
 * @returns {string} Le contenu TSV
 */
export const buildTsvExport = (draft, expenses, currentDate) => {
    const lines = [];
    // En-têtes (optionnel, mais pratique pour le collage Excel)
    lines.push(['Date', 'Destinataire', 'Bénéficiaire Compte', 'IBAN', 'Libellé Poste', 'Montant', 'Statut Dossier'].join('\t'));

    draft.blocks.forEach(block => {
        // Uniquement les blocs valides
        if (!block.recipientId && !block.recipientSnapshot?.displayName) return;

        const destinataire = sanitizeTsvCell(block.recipientSnapshot?.displayName || 'Inconnu');
        const beneficiaire = sanitizeTsvCell(block.recipientSnapshot?.displayName || 'Inconnu'); // par défaut = destinataire
        const iban = sanitizeTsvCell(block.ibanOverride || block.recipientSnapshot?.iban || '');
        const statut = block.closureMode === CLOSURE_MODE.CLOTURE ? 'Clôture' : 'Avance';

        // Trouver toutes les allocations de ce bloc
        const blockAllocations = draft.allocations.filter(a => a.blockId === block.id && a.status === 'assigned');

        blockAllocations.forEach(alloc => {
            const exp = expenses.find(e => e.id === alloc.expenseId);
            if (!exp) return;

            const libelle = sanitizeTsvCell(exp.desc || exp.type || 'Poste inconnu');
            const montantFormatte = formatAmountForExcel(alloc.montant);

            const row = [
                currentDate,
                destinataire,
                beneficiaire,
                iban,
                libelle,
                montantFormatte,
                statut
            ];
            
            lines.push(row.join('\t'));
        });
    });

    return lines.join('\n');
};

/**
 * Génère le contenu TSV spécifiquement pour la macro "ING Excel to SEPA".
 * Colonnes attendues par ING (de gauche à droite en commençant là où l'utilisateur colle) :
 * 1. Montant (obligatoire)
 * 2. IBAN du bénéficiaire (obligatoire)
 * 3. Nom du bénéficiaire (obligatoire)
 * 4. Référence End-to-end (optionnel) - on le laisse vide
 * 5. Communication (Remittance) (optionnel) - on met le libellé du poste
 * 
 * L'utilisateur se positionnera sur la première cellule jaune "Montant" et fera Ctrl+V.
 */
export const buildINGTsvExport = (draft, expenses, dossierName = '', targetBlockId = null, allCandidates = []) => {
    const lines = [];

    draft.blocks.forEach(block => {
        if (targetBlockId && block.id !== targetBlockId) return;
        if (!block.recipientRef && !block.recipientSnapshot?.displayName) return;

        const snapshot = block.recipientSnapshot || resolveRecipientSnapshot(block.recipientRef, allCandidates) || {};
        const beneficiaire = sanitizeTsvCell(snapshot.displayName || 'Inconnu');
        const iban = sanitizeTsvCell(block.ibanOverride || snapshot.iban || '');

        const blockAllocations = draft.allocations.filter(a => a.blockId === block.id && a.status === 'assigned');
        if (blockAllocations.length === 0) return;

        // On somme toutes les allocations pour ce destinataire
        const totalAmount = blockAllocations.reduce((sum, alloc) => sum + cleanAmount(alloc.montant), 0);
        const montantFormatte = formatAmountForExcel(totalAmount);
        
        // La communication est soit la valeur éditée par l'utilisateur, soit le nom du dossier par défaut
        const communication = sanitizeTsvCell(block.referenceCommunication !== undefined ? block.referenceCommunication : dossierName);

        const row = [
            montantFormatte, // Col B: Montant (total du paiement)
            iban,            // Col C: IBAN
            beneficiaire,    // Col D: Nom
            '',              // Col E: Référence End-to-end (vide)
            communication    // Col F: Communication
        ];
        
        lines.push(row.join('\t'));
    });

    // Pas de ligne d'en-tête ni de saut de ligne final pour éviter de déborder sur les cellules verrouillées d'ING
    return lines.join('\n');
};
