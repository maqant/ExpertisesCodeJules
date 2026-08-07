/**
 * Formatage de la DÉSIGNATION d'un bénéficiaire de paiement.
 *
 * ⚠️ Distinct de la SALUTATION d'en-tête de mail (resolveCivilitySalutation).
 * - Inline : groupe nominal en milieu de phrase ("sur le compte de …").
 * - Label  : étiquette autonome (export bancaire ING, récapitulatifs).
 *
 * Règle absolue : jamais de civilité inventée. Civilité inconnue → nom brut.
 */

export const ACP_INLINE_LABEL = 'la copropriété';
export const ACP_EXPORT_LABEL = 'ACP';
export const COMPANY_INLINE_LABEL = 'la société';
export const COMPANY_EXPORT_LABEL = 'Société';

/**
 * Désignation en milieu de phrase.
 * @returns {string|null} null si aucun nom exploitable (le fallback est décidé par l'appelant).
 */
export const formatBeneficiaryInline = (civility, displayName = '') => {
    const name = (displayName || '').trim();
    if (!name) return null;
    switch (civility) {
        case 'Madame': return `Madame ${name}`;
        case 'Monsieur': return `Monsieur ${name}`;
        case 'ACP': return `${ACP_INLINE_LABEL} ${name}`;
        case 'Société': return `${COMPANY_INLINE_LABEL} ${name}`;
        default: return name;
    }
};

/**
 * Étiquette autonome (export ING, colonnes tableur).
 * @returns {string} '' si aucun nom exploitable.
 */
export const formatBeneficiaryLabel = (civility, displayName = '') => {
    const name = (displayName || '').trim();
    if (!name) return '';
    switch (civility) {
        case 'Madame': return `Madame ${name}`;
        case 'Monsieur': return `Monsieur ${name}`;
        case 'ACP': return `${ACP_EXPORT_LABEL} ${name}`;
        case 'Société': return `${COMPANY_EXPORT_LABEL} ${name}`;
        default: return name;
    }
};
