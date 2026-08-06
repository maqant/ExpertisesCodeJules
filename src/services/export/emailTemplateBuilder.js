import { cleanAmount } from '../../store/financeStore.js';
import { CLOSURE_MODE } from '../../domain/decompteSplitter/allocationModel.js';
import { buildSalutation, buildAllCandidates } from '../utils/contactUtils.js';

/**
 * Résolution ÉTANCHE du destinataire e-mail effectif.
 * Règle absolue : si le canal mail est DISSOCIÉ (mailRecipientLinked === false),
 * on n'utilise JAMAIS les données du destinataire de paiement pour la salutation.
 */
export const resolveEffectiveMailRecipient = (block, allCandidates = []) => {
    const isLinked = block.mailRecipientLinked !== false;
    const paymentRef = block.paymentRecipientRef || block.recipientRef || null;
    const paymentSnapshot = block.paymentRecipientSnapshot || block.recipientSnapshot || null;

    const ref = isLinked ? paymentRef : (block.mailRecipientRef || null);

    // 1. Contact vivant (source de vérité prioritaire — reflète les éditions récentes)
    const liveContact = ref
        ? allCandidates.find(c => c.kind === ref.kind && c.id === ref.id) || null
        : null;

    if (liveContact) {
        return {
            displayName: liveContact.displayName,
            email: liveContact.email || null,
            isCompany: !!liveContact.isCompany,
            resolved: true,
        };
    }

    // 2. Snapshot figé du canal correspondant — SANS contamination croisée
    const snapshot = isLinked ? paymentSnapshot : (block.mailRecipientSnapshot || null);
    if (snapshot) {
        return {
            displayName: snapshot.displayName,
            email: snapshot.email || null,
            isCompany: !!snapshot.isCompany,
            resolved: true,
        };
    }

    return null;
};

/**
 * Génère le corps du mail pour un destinataire spécifique.
 * 
 * @param {object} block - Le bloc destinataire
 * @param {Array} allocations - Les allocations du brouillon
 * @param {Array} expenses - Les postes financiers (source de vérité)
 * @param {object} [piiData] - Données PII (occupants, intervenants, localContacts)
 * @returns {string} Le texte du mail prêt à être copié
 */
export const resolveCivilitySalutation = (civility, displayName = '') => {
    const cleanName = (displayName || '').trim();
    switch (civility) {
        case 'Madame':
            return cleanName ? `Bonjour Madame ${cleanName},` : `Bonjour Madame,`;
        case 'ACP':
            return cleanName ? `Chers Copropriétaires de la Résidence ${cleanName},` : `Chers Copropriétaires,`;
        case 'Société':
            return cleanName ? `Messieurs les Administrateurs de la société ${cleanName},` : `Messieurs,`;
        case 'Monsieur':
        default:
            return cleanName ? `Bonjour Monsieur ${cleanName},` : `Bonjour Monsieur,`;
    }
};

export const buildEmailTemplate = (block, allocations, expenses, piiData = {}) => {
    if (!block) return '';

    const allCandidates = buildAllCandidates({
        occupants: piiData.occupants || [],
        intervenants: piiData.prestataires || [],
        localContacts: piiData.localContacts || []
    });

    const mailRecipient = resolveEffectiveMailRecipient(block, allCandidates);
    const paymentSnapshot = block.paymentRecipientSnapshot || block.recipientSnapshot;

    const mailCivility = block.mailCivility || 'Monsieur';
    const mailName = mailRecipient?.displayName || block.mailRecipientSnapshot?.displayName || '';

    const salutation = mailCivility
        ? resolveCivilitySalutation(mailCivility, mailName)
        : (mailRecipient ? buildSalutation([mailRecipient]) : `Bonjour Madame, Monsieur,`);

    let rawIban = block.ibanOverride || paymentSnapshot?.iban;
    let ibanStr = '[IBAN MANQUANT]';
    if (rawIban) {
        const cleanIban = rawIban.replace(/\s+/g, '');
        ibanStr = cleanIban.match(/.{1,4}/g)?.join(' ') || cleanIban;
    }

    // Phrase d'attribution bancaire (adaptée selon la séparation du destinataire mail VS bénéficiaire paiement)
    let paymentSentence = `La compagnie nous confirme le versement de l’indemnité sur votre compte, IBAN : ${ibanStr}.`;
    if (block.mailRecipientLinked === false) {
        const payCiv = block.paymentCivility || 'Monsieur';
        const payName = paymentSnapshot?.displayName || block.paymentRecipientNom || 'le bénéficiaire désigné';
        const payTitle = resolveCivilitySalutation(payCiv, payName).replace(/,$/, '');
        paymentSentence = `La compagnie nous confirme le versement de l’indemnité sur le compte IBAN ${ibanStr} au bénéfice de ${payTitle}.`;
    }

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

        const isFranchise = val < 0 || (exp.desc || '').toLowerCase().includes('franchise') || (exp.type || '').toLowerCase().includes('franchise') || exp.isFranchise;
        const sign = isFranchise ? '(-)' : '(+)';
        const libelle = exp.desc || exp.type || 'Poste inconnu';
        
        const formatMontant = Math.abs(val).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('.', ',');
        
        itemsLines.push(`${sign} Poste ${libelle} : ${formatMontant} € ;`);
    });

    const totalStr = total.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace('.', ',');

    let closureText = '';
    if (block.closureMode === CLOSURE_MODE.CLOTURE) {
        closureText = 'Sauf erreur, ce paiement clôture ce dossier.';
    } else {
        closureText = 'Ce paiement constitue une avance de 80% du dommage chiffré pour le bâtiment HTVA, conformément à la loi des Assurances du 04 avril 2014 : Je me place en attente des factures pour réclamer le solde et la TVA.';
    }

    const remarqueText = block.remarque ? `\n${block.remarque}\n` : '';

    return `${salutation}

Je reviens vers vous dans ce dossier.

${paymentSentence}

Le décompte est le suivant :
${itemsLines.join('\n')}

Total : ${totalStr} €.

${closureText}
${remarqueText}
Je reste à votre disposition.

Bien cordialement,`;
};
