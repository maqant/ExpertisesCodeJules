/**
 * Formatage de la DÉSIGNATION d'un bénéficiaire de paiement.
 *
 * ⚠️ Distinct de la SALUTATION d'en-tête de mail (resolveCivilitySalutation).
 * - Inline : groupe nominal en milieu de phrase ("sur le compte de …").
 * - Label  : étiquette autonome (export bancaire ING, récapitulatifs).
 *
 * Règle absolue : jamais de civilité inventée. Civilité inconnue → nom brut,
 * SAUF déduction déterministe ACP/Société d'après le nom de structure.
 */

export const ACP_INLINE_LABEL = 'la copropriété';
export const ACP_EXPORT_LABEL = 'ACP';
export const COMPANY_INLINE_LABEL = 'la société';
export const COMPANY_EXPORT_LABEL = 'Société';

const normalizeForDetection = (value = '') =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();

const ACP_NAME_PATTERN = /\b(RESIDENCE|RÉSIDENCE|COPROPRIETE|COPROPRIÉTÉ|COPROPRIETAIRES|COPROPRIÉTAIRES|ACP|SYNDICAT\s+DES\s+COPROPRIETAIRES|SYNDICAT\s+DES\s+COPROPRIÉTAIRES|IMMEUBLE)\b/;
const COMPANY_NAME_PATTERN = /\b(SPRL|SRL|SARL|SAS|SASU|SA|SCI|SC|ASBL|BVBA|NV|GMBH|LTD|EURL)\b/;

/**
 * Déduit une civilité implicite à partir du nom d'un bénéficiaire
 * lorsqu'aucune civilité explicite n'est renseignée.
 * @returns {'ACP'|'Société'|null}
 */
export const detectImplicitCivility = (displayName = '') => {
    const normalized = normalizeForDetection(displayName);
    if (!normalized) return null;
    if (ACP_NAME_PATTERN.test(normalized)) return 'ACP';
    if (COMPANY_NAME_PATTERN.test(normalized)) return 'Société';
    return null;
};

/**
 * Résout la civilité effective : explicite si fournie, sinon implicite via le nom.
 */
export const resolveEffectiveCivility = (civility, displayName = '') => {
    if (civility && civility !== 'none') return civility;
    return detectImplicitCivility(displayName);
};

/**
 * Désignation en milieu de phrase.
 * Ex. : "la copropriété RESIDENCE DU SAULE", "Madame Bontia".
 * Ne double jamais le préfixe si le nom le contient déjà.
 */
export const formatBeneficiaryInline = (civility, displayName = '') => {
    const name = (displayName || '').trim();
    if (!name) return null;

    const effectiveCivility = resolveEffectiveCivility(civility, name);
    const normalized = normalizeForDetection(name);

    switch (effectiveCivility) {
        case 'Madame': return `Madame ${name}`;
        case 'Monsieur': return `Monsieur ${name}`;
        case 'ACP':
            return normalized.startsWith('COPROPRIETE') || normalized.startsWith('L\'ACP') || normalized.startsWith('LA COPROPRIETE')
                ? name
                : `${ACP_INLINE_LABEL} ${name}`;
        case 'Société':
            return normalized.startsWith('SOCIETE') || normalized.startsWith('LA SOCIETE')
                ? name
                : `${COMPANY_INLINE_LABEL} ${name}`;
        default: return name;
    }
};

/**
 * Étiquette autonome (export ING, colonnes tableur).
 */
export const formatBeneficiaryLabel = (civility, displayName = '') => {
    const name = (displayName || '').trim();
    if (!name) return '';

    const effectiveCivility = resolveEffectiveCivility(civility, name);

    switch (effectiveCivility) {
        case 'Madame': return `Madame ${name}`;
        case 'Monsieur': return `Monsieur ${name}`;
        case 'ACP': return `${ACP_EXPORT_LABEL} ${name}`;
        case 'Société': return `${COMPANY_EXPORT_LABEL} ${name}`;
        default: return name;
    }
};
