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

    return lines.join('\n') + '\n';
};
