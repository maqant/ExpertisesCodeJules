import { cleanAmount } from '../../store/financeStore.js';
import { CLOSURE_MODE } from '../../domain/decompteSplitter/allocationModel.js';
import { parseFullName, buildAllCandidates } from '../utils/contactUtils.js';
import { formatPersonName } from '../utils/formatUtils.js';
import { formatBeneficiaryInline, detectImplicitCivility } from '../utils/beneficiaryTitle.js';
import { getHumanLabel, resolveExpenseView } from '../../domain/decompteSplitter/labelResolver.js';

/* ------------------------------------------------------------------ */
/* Résolution du destinataire                                          */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Extraction robuste du nom de famille                                */
/* ------------------------------------------------------------------ */

const CIVILITY_PREFIX_REGEX = /^\s*(madame|mme\.?|monsieur|mr\.?|m\.|mlle\.?|mademoiselle|dr\.?|maitre|maître|me\.?)\s+/i;

/**
 * Supprime les éventuels préfixes de civilité d'un nom complet.
 * Ex. : "Madame Christine Bontia" -> "Christine Bontia".
 */
const stripCivilityPrefix = (fullName = '') => {
    let cleaned = (fullName || '').trim();
    let previous;
    do {
        previous = cleaned;
        cleaned = cleaned.replace(CIVILITY_PREFIX_REGEX, '');
    } while (cleaned !== previous);
    return cleaned;
};

/**
 * Extrait le nom de famille avec stratégie en cascade :
 * 1. Champ structuré `lastName` du contact résolu.
 * 2. Analyse via parseFullName sur le displayName nettoyé.
 * 3. Heuristique : dernier mot si plusieurs, sinon la chaîne entière.
 */
const extractLastName = (recipientObj = null, mailName = '') => {
    if (recipientObj?.lastName?.trim()) {
        return recipientObj.lastName.trim();
    }

    const rawName = recipientObj?.displayName || mailName || '';
    const cleaned = stripCivilityPrefix(rawName);
    if (!cleaned) return null;

    try {
        const parsed = parseFullName(cleaned);
        if (parsed?.lastName?.trim()) return parsed.lastName.trim();
    } catch {
        // parseFullName indisponible ou nom atypique
    }

    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length === 0) return null;
    return words.length === 1 ? words[0] : words[words.length - 1];
};

/**
 * Nettoie le nom d'une ACP pour la formule "de la Résidence X"
 * afin d'éviter "de la Résidence RESIDENCE DU SAULE".
 */
const stripResidencePrefix = (name = '') =>
    (name || '').replace(/^\s*(RESIDENCE|RÉSIDENCE|COPROPRIETE|COPROPRIÉTÉ|ACP)\s+/i, '').trim();

/* ------------------------------------------------------------------ */
/* Salutation                                                          */
/* ------------------------------------------------------------------ */

/**
 * Résout la salutation d'e-mail avec dégradation gracieuse.
 * Hiérarchie de résolution de la civilité :
 *   1. civility (donnée portée par le destinataire — SSOT)
 *   2. fallbackCivility (choix explicite du toggle UI ex: 'Monsieur')
 *   3. default : salutation avec nom complet si disponible, sinon "Bonjour,"
 */
export const resolveCivilitySalutation = (
    civility,
    mailName = '',
    recipientObj = null,
    fallbackCivility = null
) => {
    const full = recipientObj?.displayName || mailName || '';
    const effectiveCivility = civility || fallbackCivility;

    switch (effectiveCivility) {
        case 'Madame': {
            const lastName = extractLastName(recipientObj, mailName);
            return lastName
                ? `Bonjour Madame ${formatPersonName(lastName)},`
                : 'Bonjour Madame,';
        }
        case 'Monsieur': {
            const lastName = extractLastName(recipientObj, mailName);
            return lastName
                ? `Bonjour Monsieur ${formatPersonName(lastName)},`
                : 'Bonjour Monsieur,';
        }
        case 'ACP': {
            const residenceName = stripResidencePrefix(full);
            return residenceName
                ? `Chers Copropriétaires de la Résidence ${formatPersonName(residenceName)},`
                : 'Chers Copropriétaires,';
        }
        case 'Société':
            return full
                ? `Messieurs les Administrateurs de la société ${full},`
                : 'Messieurs,';
        default: {
            const cleanedName = stripCivilityPrefix(full);
            return cleanedName
                ? `Bonjour ${formatPersonName(cleanedName)},`
                : 'Bonjour,';
        }
    }
};

/* ------------------------------------------------------------------ */
/* Construction des détails du décompte                                */
/* ------------------------------------------------------------------ */

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
    const mailName = mailRecipient?.displayName || block.mailRecipientSnapshot?.displayName || '';

    // Civilité effective : explicite (bloc, puis contact), sinon implicite déduite du nom.
    const mailCivility = block.mailCivility
        || recipientCivility
        || detectImplicitCivility(mailName)
        || null;

    const salutation = resolveCivilitySalutation(mailCivility, mailName, mailRecipient, block.mailCivility || 'Monsieur');

    let rawIban = block.ibanOverride || paymentSnapshot?.iban;
    let ibanStr = '[IBAN MANQUANT]';
    if (rawIban) {
        const cleanIban = rawIban.replace(/\s+/g, '');
        ibanStr = cleanIban.match(/.{1,4}/g)?.join(' ') || cleanIban;
    }

    let paymentSentence = `La compagnie nous confirme le versement de l’indemnité sur votre compte, IBAN : ${ibanStr}.`;
    if (block.mailRecipientLinked === false) {
        const payCiv = block.paymentCivility || paymentSnapshot?.civility || paymentSnapshot?.civilite;
        const payName = paymentSnapshot?.displayName || block.paymentRecipientNom || '';
        const inlineTitle = formatBeneficiaryInline(payCiv, payName);
        const designation = inlineTitle || 'du bénéficiaire désigné';
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

        const isFranchise = val < 0
            || (exp.desc || '').toLowerCase().includes('franchise')
            || (exp.type || '').toLowerCase().includes('franchise')
            || exp.isFranchise;
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
        invoiceSentence = block.advanceType === 'tva_only'
            ? "Nous restons dans l'attente des factures afin de solliciter le versement de la TVA."
            : "Nous restons dans l'attente des factures afin de solliciter le versement du solde et de la TVA.";
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

/* ------------------------------------------------------------------ */
/* Gabarits HTML & Texte                                               */
/* ------------------------------------------------------------------ */

const P_STYLE = 'margin: 0 0 14px 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1e293b; line-height: 1.6;';
const ITEM_STYLE = 'margin: 0 0 6px 24px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1e293b; line-height: 1.6;';

export const buildEmailHtml = (block, allocations, expenses, piiData = {}) => {
    const details = buildEmailDetails(block, allocations, expenses, piiData);
    if (!details) return '';

    const itemsHtml = details.items
        .map(i => `<p style="${ITEM_STYLE}">\u2022&nbsp; ${i.sign} ${i.label}&nbsp;: <strong>${i.amountStr}</strong></p>`)
        .join('\n');

    const invoiceHtml = details.invoiceSentence
        ? `<p style="${P_STYLE}">${details.invoiceSentence}</p>`
        : '';

    const remarqueHtml = details.remarqueText
        ? `<p style="${P_STYLE}">${details.remarqueText}</p>`
        : '';

    return `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1e293b; line-height: 1.6;">
<p style="${P_STYLE}">${details.salutation}</p>
<p style="${P_STYLE}">Je reviens vers vous dans ce dossier.</p>
<p style="${P_STYLE}">${details.paymentSentence}</p>
<p style="margin: 0 0 8px 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1e293b; font-weight: bold;">Le décompte est le suivant :</p>
${itemsHtml}
<p style="margin: 16px 0 16px 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1e293b;"><strong>Total : ${details.totalStr}</strong></p>
<p style="${P_STYLE}">${details.advanceSentence}</p>
${invoiceHtml}
${remarqueHtml}
<p style="${P_STYLE}">Je reste à votre disposition.</p>
<p style="margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1e293b;">Bien cordialement,</p>
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
