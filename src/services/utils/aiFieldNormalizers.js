// v1.0.0 - Frontière de validation des sorties IA
/**
 * aiFieldNormalizers.js
 * Garantit que les champs texte issus des réponses IA sont des strings
 * exploitables par l'UI et le pipeline (protection React error #31).
 * Toute non-conformité est loggée : ZÉRO erreur silencieuse.
 */

/** Labels métier pour reconstruire un texte lisible depuis un objet IA égaré. */
const KNOWN_FIELD_LABELS = {
    origine: 'Origine',
    localisation: 'Localisation',
    consequences: 'Conséquences',
    reparations: 'Réparations préconisées',
};

/** Ordre de restitution métier (les clés inconnues passent après, dans l'ordre reçu). */
const KNOWN_FIELD_ORDER = ['origine', 'localisation', 'consequences', 'reparations'];

const capitalize = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Normalise une valeur IA en string sûre.
 * @param {*} value - Valeur brute issue du JSON IA.
 * @param {object} options
 * @param {string} options.componentId - Identifiant de l'agent appelant (traçabilité logs).
 * @param {string} options.fieldName - Nom du champ normalisé (traçabilité logs).
 * @returns {string} Chaîne normalisée (vide si valeur inexploitable).
 */
export const normalizeAiTextField = (value, { componentId = 'unknown', fieldName = 'field' } = {}) => {
    // Cas nominal
    if (typeof value === 'string') return value.trim();

    // Absence légitime (règle d'exhaustivité : null autorisé)
    if (value === null || value === undefined) return '';

    if (typeof value === 'number' || typeof value === 'boolean') {
        console.warn(`[${componentId}] ⚠️ Champ "${fieldName}" de type ${typeof value}, converti en string.`);
        return String(value);
    }

    if (Array.isArray(value)) {
        console.warn(`[${componentId}] ⚠️ Champ "${fieldName}" reçu en tableau (${value.length} éléments), aplati en texte.`);
        return value
            .map((item) => normalizeAiTextField(item, { componentId, fieldName }))
            .filter(Boolean)
            .join('\n\n');
    }

    if (typeof value === 'object') {
        console.warn(
            `[${componentId}] ⚠️ Champ "${fieldName}" reçu en objet (clés: ${Object.keys(value).join(', ')}). ` +
            `Aplatissement en texte structuré. Le prompt de l'agent doit être vérifié.`
        );
        const entries = Object.entries(value).filter(([, v]) => v !== null && v !== undefined && v !== '');
        // Tri : clés métier connues d'abord, dans l'ordre défini
        entries.sort(([a], [b]) => {
            const ia = KNOWN_FIELD_ORDER.indexOf(a.toLowerCase());
            const ib = KNOWN_FIELD_ORDER.indexOf(b.toLowerCase());
            return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib);
        });
        const paragraphs = entries
            .map(([key, v]) => {
                const label = KNOWN_FIELD_LABELS[key.toLowerCase()] || capitalize(key.replace(/_/g, ' '));
                const text = normalizeAiTextField(v, { componentId, fieldName: `${fieldName}.${key}` });
                return text ? `${label} : ${text}` : '';
            })
            .filter(Boolean);

        if (paragraphs.length === 0) {
            console.error(`[${componentId}] ❌ Champ "${fieldName}" : objet reçu inexploitable, renvoi chaîne vide.`);
            return '';
        }
        return paragraphs.join('\n\n');
    }

    console.error(`[${componentId}] ❌ Champ "${fieldName}" de type inattendu (${typeof value}), renvoi chaîne vide.`);
    return '';
};
