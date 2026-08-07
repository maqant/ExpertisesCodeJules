/**
 * LUNA — Résolveur déterministe d'identité pour salutation d'e-mail.
 * Exécuté UNE SEULE FOIS par nouvel upload (ingestDocument).
 * Contrat de sortie STRICT :
 * { displayName, firstName, lastName, civility, contactType, civilitySource, resolution }
 * civility ∈ { 'Madame', 'Monsieur', 'ACP', 'Société', null }
 * civilitySource ∈ { 'document_explicit', 'record', 'manual', 'none' }
 * contactType ∈ { 'person', 'company', 'acp', 'unknown' }
 * resolution ∈ { 'civility_explicit', 'structured_record', 'company', 'acp', 'name_only', 'empty' }
 */

const CIVILITY_TOKENS = new Map([
    ['MADAME', 'Madame'], ['MME', 'Madame'], ['MME.', 'Madame'],
    ['MADEMOISELLE', 'Madame'], ['MLLE', 'Madame'], ['MLLE.', 'Madame'],
    ['MONSIEUR', 'Monsieur'], ['MR', 'Monsieur'], ['MR.', 'Monsieur'], ['M.', 'Monsieur'],
]);

const COMPANY_MARKERS = ['SPRL', 'SRL', 'SA', 'SAS', 'SARL', 'ASBL', 'BV', 'NV', 'SCRL', 'SNC', 'GMBH'];
const ACP_MARKERS = ['ACP', 'COPROPRIETE', 'COPROPRIÉTÉ', 'SYNDIC', 'RESIDENCE', 'RÉSIDENCE'];

const capitalize = (s = '') =>
    s.toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (m, sep, c) => sep + c.toUpperCase());

export function resolveCandidateWithLuna(input = {}) {
    const rawName = (input.nom || input.displayName || '').trim();
    const knownCivility = input.civility || input.civilite || null;

    if (!rawName) {
        return {
            displayName: '', firstName: null, lastName: null,
            civility: null, contactType: 'unknown',
            civilitySource: 'none', resolution: 'empty',
        };
    }

    const upperTokens = rawName.toUpperCase().split(/\s+/).filter(Boolean);

    // 1. Détection entité morale (prioritaire : jamais de prénom/nom)
    if (upperTokens.some(t => ACP_MARKERS.includes(t))) {
        return {
            displayName: rawName, firstName: null, lastName: null,
            civility: 'ACP', contactType: 'acp',
            civilitySource: 'document_explicit', resolution: 'acp',
        };
    }
    if (upperTokens.some(t => COMPANY_MARKERS.includes(t))) {
        return {
            displayName: rawName, firstName: null, lastName: null,
            civility: 'Société', contactType: 'company',
            civilitySource: 'document_explicit', resolution: 'company',
        };
    }

    // 2. Détection civilité explicite en tête de chaîne
    let civility = null;
    let civilitySource = 'none';
    let nameTokens = [...upperTokens];

    if (CIVILITY_TOKENS.has(upperTokens[0])) {
        civility = CIVILITY_TOKENS.get(upperTokens[0]);
        civilitySource = 'document_explicit';
        nameTokens = upperTokens.slice(1);
    } else if (knownCivility === 'Madame' || knownCivility === 'Monsieur' || knownCivility === 'ACP' || knownCivility === 'Société') {
        civility = knownCivility;
        civilitySource = 'record';
    }

    // 3. Découpage identité : premier token = prénom, reste = nom.
    let firstName = null;
    let lastName = null;
    if (nameTokens.length === 1) {
        lastName = capitalize(nameTokens[0]);
    } else if (nameTokens.length > 1) {
        firstName = capitalize(nameTokens[0]);
        lastName = capitalize(nameTokens.slice(1).join(' '));
    }

    return {
        displayName: rawName,
        firstName,
        lastName,
        civility,                       // null si rien d'explicite — JAMAIS inféré du prénom
        contactType: 'person',
        civilitySource,
        resolution: civility ? 'civility_explicit' : 'name_only',
    };
}
