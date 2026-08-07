import { cleanAmount } from '../../store/financeStore.js';
import { CLOSURE_MODE } from '../../domain/decompteSplitter/allocationModel.js';
import { parseFullName, buildSalutation, buildAllCandidates } from '../utils/contactUtils.js';
import { formatPersonName } from '../utils/formatUtils.js';
import { formatBeneficiaryInline } from '../utils/beneficiaryTitle.js';
import { getHumanLabel, resolveExpenseView } from '../../domain/decompteSplitter/labelResolver.js';

export const resolveEffectiveMailRecipient = (block, allCandidates = []) => {
    const isLinked = block.mailRecipientLinked !== false;
    const paymentRef = block.paymentRecipientRef || block.recipientRef || null;
    const paymentSnapshot = block.paymentRecipientSnapshot || block.recipientSnapshot || null;

    const ref = isLinked ? paymentRef : (block.mailRecipientRef || null);

    const liveContact = ref
        ? allCandidates.find(c => c.kind === ref.kind && c.id === ref.id) || null
        : null;

    if (liveContact) {
        return {
            displayName: liveContact.displayName,
            email: liveContact.email || null,
            civility: liveContact.civility || liveContact.civilite || null,
            firstName: liveContact.firstName || null,
            lastName: liveContact.lastName || null,
            contactType: liveContact.contactType || null,
            civilitySource: liveContact.civilitySource || null,
            resolution: liveContact.resolution || null,
            isCompany: !!liveContact.isCompany,
            resolved: true,
        };
    }

    const snapshot = isLinked ? paymentSnapshot : (block.mailRecipientSnapshot || null);
    if (snapshot) {
        return {
            displayName: snapshot.displayName,
            email: snapshot.email || null,
            civility: snapshot.civility || snapshot.civilite || null,
            firstName: snapshot.firstName || null,
            lastName: snapshot.lastName || null,
            contactType: snapshot.contactType || null,
            civilitySource: snapshot.civilitySource || null,
            resolution: snapshot.resolution || null,
            isCompany: !!snapshot.isCompany,
            resolved: true,
        };
    }

    return null;
};

export const resolveCivilitySalutation = (civility, mailName = '', recipientObj = null) => {
    const lastName = recipientObj?.lastName || null;
    const full = recipientObj?.displayName || mailName || '';

    switch (civility) {
        case 'Madame':
            return lastName ? `Bonjour Madame ${formatPersonName(lastName)},` : 'Bonjour Madame,';
        case 'ACP':
            return full
                ? `Chers Copropriétaires de la Résidence ${formatPersonName(full)},`
                : 'Chers Copropriétaires,';
        case 'Société':
            return full
                ? `Messieurs les Administrateurs de la société ${full},`
                : 'Messieurs,';
        case 'Monsieur':
            return lastName ? `Bonjour Monsieur ${formatPersonName(lastName)},` : 'Bonjour Monsieur,';
        default:
            return 'Bonjour,';
    }
};

const sanitizeLabel = (label = '') =>
    label
        .replace(/^poste\s+/i, '')
        .replace(/;\s*$/g, '')
        .trim();

export const buildEmailDetails = (block, allocations, expenses, piiData = {}) => {
    if (!block) return null;

    const allCandidates = buildAllCandidates({
        occupants: piiData.occupants || [],
        intervenants: piiData.prestataires || [],
        localContacts: piiData.localContacts || []
    });

    const mailRecipient = resolveEffectiveMailRecipient(block, allCandidates);
    const paymentSnapshot = block.paymentRecipientSnapshot || block.recipientSnapshot;

    const recipientCivility = (mailRecipient?.civility && mailRecipient?.civilitySource !== 'none')
        ? mailRecipient.civility
        : null;
    const mailCivility = block.mailCivility || recipientCivility || null;
    const mailName = mailRecipient?.displayName || block.mailRecipientSnapshot?.displayName || '';

    const salutation = mailCivility
        ? resolveCivilitySalutation(mailCivility, mailName, mailRecipient)
        : 'Bonjour,';

    let rawIban = block.ibanOverride || paymentSnapshot?.iban;
    let ibanStr = '[IBAN MANQUANT]';
    if (rawIban) {
        const cleanIban = rawIban.replace(/\s+/g, '');
        ibanStr = cleanIban.match(/.{1,4}/g)?.join(' ') || cleanIban;
    }

    let paymentSentence = `La compagnie nous confirme le versement de l’indemnité sur votre compte, IBAN : ${ibanStr}.`;
    if (block.mailRecipientLinked === false) {
        const payCiv = block.paymentCivility;
        const payName = paymentSnapshot?.displayName || block.paymentRecipientNom || '';
        const inlineTitle = formatBeneficiaryInline(payCiv, payName);
        const designation = inlineTitle ? inlineTitle : 'du bénéficiaire désigné';
        paymentSentence = `La compagnie nous confirme le versement de l’indemnité sur le compte de ${designation}, IBAN : ${ibanStr}.`;
    }

    const blockAllocations = allocations.filter(a => a.blockId === block.id && a.status === 'assigned');
    if (blockAllocations.length === 0) return null;

    let total = 0;
    const items = [];

    blockAllocations.forEach(alloc => {
        const exp = expenses.find(e => e.id === alloc.expenseId);
        if (!exp) return;

        const val = cleanAmount(alloc.montant);
        total += val;

        const isFranchise = val < 0 || (exp.desc || '').toLowerCase().includes('franchise') || (exp.type || '').toLowerCase().includes('franchise') || exp.isFranchise;
        const sign = isFranchise ? '(-)' : '(+)';
        const rawLabel = getHumanLabel(resolveExpenseView(exp), exp);
        const label = sanitizeLabel(rawLabel);
        const formatMontant = Math.abs(val).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        items.push({
            sign,
            label,
            amountStr: `${formatMontant} €`,
            fullText: `${sign} ${label} : ${formatMontant} €`
        });
    });

    const totalStr = `${total.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

    let advanceSentence = '';
    let invoiceSentence = '';

    if (block.closureMode === CLOSURE_MODE.CLOTURE) {
        advanceSentence = 'Sauf erreur, ce paiement clôture ce dossier.';
    } else {
        advanceSentence = "Ce paiement constitue une avance sur l'indemnité.";
        if (block.advanceType === 'tva_only') {
            invoiceSentence = "Nous restons dans l'attente des factures afin de solliciter le versement de la TVA.";
        } else {
            invoiceSentence = "Nous restons dans l'attente des factures afin de solliciter le versement du solde et de la TVA.";
        }
    }

    const remarqueText = block.remarque?.trim() || '';

    return {
        salutation,
        paymentSentence,
        items,
        totalStr,
        advanceSentence,
        invoiceSentence,
        remarqueText
    };
};

export const buildEmailHtml = (block, allocations, expenses, piiData = {}) => {
    const details = buildEmailDetails(block, allocations, expenses, piiData);
    if (!details) return '';

    const itemsHtml = details.items
        .map(i => `<p style="margin: 0 0 6px 24px;">\u2022 ${i.sign} ${i.label} : ${i.amountStr}</p>`)
        .join('\n');

    const invoiceHtml = details.invoiceSentence
        ? `<p style="margin: 0 0 16px 0;">${details.invoiceSentence}</p>`
        : '';

    const remarqueHtml = details.remarqueText
        ? `<p style="margin: 0 0 16px 0;">${details.remarqueText}</p>`
        : '';

    return `<div style="font-family: Arial, sans-serif; font-size: 14px; color: #1e293b; line-height: 1.5;">
<p style="margin: 0 0 16px 0;">${details.salutation}</p>
<p style="margin: 0 0 16px 0;">Je reviens vers vous dans ce dossier.</p>
<p style="margin: 0 0 16px 0;">${details.paymentSentence}</p>
<p style="margin: 0 0 8px 0;">Le décompte est le suivant :</p>
${itemsHtml}
<p style="margin: 16px 0 16px 0;"><strong>Total : ${details.totalStr}</strong></p>
<p style="margin: 0 0 ${details.invoiceSentence ? '16px' : '16px'};">${details.advanceSentence}</p>
${invoiceHtml}
${remarqueHtml}
<p style="margin: 0 0 16px 0;">Je reste à votre disposition.</p>
<p style="margin: 0;">Bien cordialement,</p>
</div>`;
};

export const buildEmailTemplate = (block, allocations, expenses, piiData = {}) => {
    const details = buildEmailDetails(block, allocations, expenses, piiData);
    if (!details) return '';

    const itemsText = details.items.map(i => `\u2022 ${i.fullText}`).join('\n');
    const invoiceBlock = details.invoiceSentence ? `\n\n${details.invoiceSentence}` : '';
    const remarqueBlock = details.remarqueText ? `\n\n${details.remarqueText}` : '';

    return `${details.salutation}

Je reviens vers vous dans ce dossier.

${details.paymentSentence}

Le décompte est le suivant :
${itemsText}

Total : ${details.totalStr}

${details.advanceSentence}${invoiceBlock}${remarqueBlock}

Je reste à votre disposition.

Bien cordialement,`;
};
