// ============================================================================
// src/domain/decompteSplitter/blockRecipientModel.js
// Modèle de dissociation Destinataire de PAIEMENT (ING) vs Destinataire d'E-MAIL.
// Couche Domaine pure : aucune dépendance UI, aucune dépendance store.
// ============================================================================

/**
 * Crée la portion "destinataires" d'un nouveau bloc.
 * Par défaut, le destinataire mail est LIÉ au destinataire de paiement
 * (mailRecipientLinked = true) : la saisie rapide reste en un seul geste.
 */
export function createBlockRecipientState() {
    return {
        paymentRecipientRef: null,
        paymentRecipientSnapshot: null,
        mailRecipientRef: null,
        mailRecipientSnapshot: null,
        mailRecipientLinked: true
    };
}

/**
 * Migration non-destructive d'un bloc legacy (recipientRef / recipientSnapshot)
 * vers le modèle dissocié. Idempotente : un bloc déjà migré ressort inchangé.
 */
export function migrateBlockRecipients(block) {
    if (!block) return block;

    const alreadyMigrated =
        Object.prototype.hasOwnProperty.call(block, 'paymentRecipientRef') &&
        Object.prototype.hasOwnProperty.call(block, 'mailRecipientLinked');
    if (alreadyMigrated) return block;

    const paymentRecipientRef = block.paymentRecipientRef ?? block.recipientRef ?? null;
    const paymentRecipientSnapshot = block.paymentRecipientSnapshot ?? block.recipientSnapshot ?? null;

    const hasExplicitMail = block.mailRecipientRef != null;
    const mailRecipientRef = hasExplicitMail ? block.mailRecipientRef : paymentRecipientRef;
    const mailRecipientSnapshot = hasExplicitMail
        ? (block.mailRecipientSnapshot ?? null)
        : paymentRecipientSnapshot;

    return {
        ...block,
        paymentRecipientRef,
        paymentRecipientSnapshot,
        mailRecipientRef,
        mailRecipientSnapshot,
        mailRecipientLinked: !hasExplicitMail,
        remarqueOriginal: block.remarqueOriginal ?? null,
        // Champs legacy maintenus en miroir
        recipientRef: paymentRecipientRef,
        recipientSnapshot: paymentRecipientSnapshot
    };
}

/** Migration d'un draft complet (utilisée par INIT_DRAFT et à l'hydratation). */
export function migrateDraftRecipients(draft) {
    if (!draft || !Array.isArray(draft.blocks)) return draft;
    return { ...draft, blocks: draft.blocks.map(migrateBlockRecipients) };
}

/**
 * Résolution CANONIQUE des refs effectives d'un bloc.
 */
export function getEffectiveRefs(block) {
    if (!block) return { paymentRef: null, mailRef: null, linked: true };
    const paymentRef = block.paymentRecipientRef ?? block.recipientRef ?? null;
    const linked = block.mailRecipientLinked !== false;
    const mailRef = linked ? paymentRef : (block.mailRecipientRef ?? null);
    return { paymentRef, mailRef, linked };
}
