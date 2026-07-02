import { cleanAmount } from '../../store/financeStore.js';
import { CLOSURE_MODE } from '../../domain/decompteSplitter/allocationModel.js';
import { buildSalutation } from './../utils/contactUtils.js';

/**
 * Génère le corps du mail pour un destinataire spécifique.
 * 
 * @param {object} block - Le bloc destinataire
 * @param {Array} allocations - Les allocations du brouillon
 * @param {Array} expenses - Les postes financiers (source de vérité)
 * @returns {string} Le texte du mail prêt à être copié
 */
export const buildEmailTemplate = (block, allocations, expenses) => {
    if (!block) return '';

    // Nom du bénéficiaire
    const recipientName = block.recipientSnapshot?.displayName || 'Monsieur, Madame';
    const salutation = block.recipientSnapshot ? buildSalutation([{ displayName: recipientName, civility: block.recipientSnapshot.civility, nom: recipientName, email: block.recipientSnapshot.email }]) : `Bonjour ${recipientName},`;

    const ibanStr = block.ibanOverride || block.recipientSnapshot?.iban || '[IBAN MANQUANT]';

    // Trouver les allocations
    const blockAllocations = allocations.filter(a => a.blockId === block.id && a.status === 'assigned');
    
    if (blockAllocations.length === 0) return '';

    let total = 0;
    const itemsLines = [];

    blockAllocations.forEach(alloc => {
        const exp = expenses.find(e => e.id === alloc.expenseId);
        if (!exp) return;

        const val = cleanAmount(alloc.montant);
        total += val;

        const isFranchise = exp.isFranchise || exp.type === 'Franchise';
        const sign = isFranchise ? '(-)' : '(+)';
        const libelle = exp.desc || exp.type || 'Poste inconnu';
        
        // Formatage du montant
        const formatMontant = Math.abs(val).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('.', ',');
        
        itemsLines.push(`* ${sign} Poste ${libelle} : ${formatMontant} € ;`);
    });

    const totalStr = total.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('.', ',');

    // Clause de fin
    let closureText = '';
    if (block.closureMode === CLOSURE_MODE.CLOTURE) {
        closureText = '"Sauf erreur, ce paiement clôture ce dossier."';
    } else {
        closureText = '"Ce paiement constitue une avance de 80% du dommage chiffré pour le bâtiment HTVA, conformément à la loi des Assurances du 04 avril 2014 : Je me place en attente des factures pour réclamer le solde et la TVA."';
    }

    const remarqueText = block.remarque ? `\n${block.remarque}\n` : '';

    return `${salutation}

Je reviens vers vous dans ce dossier.

La compagnie nous confirme le versement de l’indemnité sur votre compte, IBAN : ${ibanStr}.

Le décompte est le suivant :
${itemsLines.join('\n')}

Total : ${totalStr} €.

${closureText}
${remarqueText}
Je reste à votre disposition.

Bien cordialement,`;
};
