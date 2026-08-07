// ============================================================================
// src/domain/decompteSplitter/labelResolver.js
// Projection calculée du libellé d'un poste de décompte.
// Préséance stricte : descManuelle > canonique(frais lié) > descOriginale.
// Fonctions pures, zéro dépendance React. Aucune mutation de la source.
// ============================================================================
import { buildSuggestedLabel } from './dossierExpenseMatcher.js';

export const LABEL_SOURCE = {
    ORIGINAL: 'original',   // libellé brut du décompte
    LINKED: 'linked',       // format canonique "Prestataire — Référence — Montant"
    MANUAL: 'manual',       // renommage humain inline ✏️
};

/**
 * Construit un index Map(id → frais) pour résolution O(1).
 */
export const indexDossierExpenses = (dossierExpenses = []) =>
    new Map(dossierExpenses.map(d => [d.id, d]));

/**
 * Fusionne un poste brut avec son overlay de décisions (override) et
 * résout le libellé d'affichage selon la hiérarchie canonique.
 */
export const resolveExpenseView = (expense, override = {}, dossierIndex = new Map()) => {
    const descOriginale = expense.descOriginale ?? expense.desc ?? '';

    // Le lien : l'override prime ; `null` explicite = déliaison volontaire.
    const linkedId = ('linkedDossierExpenseId' in override)
        ? override.linkedDossierExpenseId
        : (expense.linkedDossierExpenseId ?? null);

    const linkedDossierExpense = linkedId ? (dossierIndex.get(linkedId) ?? null) : null;

    let desc, labelSource;
    if (override.descManuelle?.trim()) {
        desc = override.descManuelle.trim();
        labelSource = LABEL_SOURCE.MANUAL;
    } else if (linkedDossierExpense) {
        desc = buildSuggestedLabel(linkedDossierExpense);   // ← canonique "Prestataire — Référence — Montant"
        labelSource = LABEL_SOURCE.LINKED;
    } else {
        desc = descOriginale;
        labelSource = LABEL_SOURCE.ORIGINAL;
    }

    return {
        ...expense,
        desc,
        descOriginale,
        linkedDossierExpenseId: linkedDossierExpense ? linkedId : null,
        linkedDossierExpense,
        labelSource,
        isDirty: labelSource !== LABEL_SOURCE.ORIGINAL || !!linkedDossierExpense,
    };
};

const FINANCE_ACRONYMS = new Set([
    'TVA', 'HTVA', 'TVAC', 'TTC', 'HT', 'RC', 'ACP',
    'SA', 'SRL', 'SPRL', 'ASBL', 'SCRL', 'RDC', 'PVE', 'PV', 'ING', 'IBAN', 'BIC'
]);

const ACCENT_DICTIONARY = {
    'BATIMENT': 'bâtiment', 'BATIMENTS': 'bâtiments',
    'ELECTRICITE': 'électricité', 'ELECTRIQUE': 'électrique', 'ELECTRIQUES': 'électriques',
    'ELECTROMENAGER': 'électroménager',
    'DEGAT': 'dégât', 'DEGATS': 'dégâts',
    'ETUDE': 'étude', 'ETUDES': 'études',
    'ETANCHEITE': 'étanchéité',
    'DEBLAIEMENT': 'déblaiement', 'DEBLAIS': 'déblais',
    'DEMOLITION': 'démolition', 'DEMOLITIONS': 'démolitions',
    'CHOMAGE': 'chômage',
    'PREJUDICE': 'préjudice', 'PREJUDICES': 'préjudices',
    'DEPLACEMENT': 'déplacement', 'DEPLACEMENTS': 'déplacements',
    'VETUSTE': 'vétusté',
    'RECUPERATION': 'récupération', 'RECUPERABLE': 'récupérable',
    'INDEMNITE': 'indemnité', 'INDEMNITES': 'indemnités',
    'HONORAIRE': 'honoraire', 'HONORAIRES': 'honoraires',
    'A': 'à',
};

const humanizeToken = (token) => {
    const bare = token.replace(/[.,;:()]/g, '');
    if (FINANCE_ACRONYMS.has(bare)) return token;
    const accented = ACCENT_DICTIONARY[bare];
    if (accented) return token.replace(bare, accented);
    return token.toLocaleLowerCase('fr-FR');
};

const isRawUppercaseLabel = (label) => {
    const letters = label.replace(/[^a-zA-ZÀ-ÿ]/g, '');
    if (!letters) return false;
    return letters === letters.toLocaleUpperCase('fr-FR');
};

/**
 * Formate un libellé financier brut en titre français propre.
 * Ex: "BATIMENT" -> "Bâtiment", "FRAIS DE RECHERCHES" -> "Frais de recherches"
 */
export const formatExpenseLabel = (rawLabel = '') => {
    const source = String(rawLabel).trim();
    if (!source || !isRawUppercaseLabel(source)) return source;

    const tokens = source.split(/\s+/).map(humanizeToken);

    const firstIdx = tokens.findIndex(t => !FINANCE_ACRONYMS.has(t.replace(/[.,;:()]/g, '')));
    if (firstIdx !== -1) {
        const t = tokens[firstIdx];
        tokens[firstIdx] = t.charAt(0).toLocaleUpperCase('fr-FR') + t.slice(1);
    }

    return tokens.join(' ');
};

/**
 * Libellé d'affichage garanti non-vide pour l'UI.
 * Contrat unique : toute l'UI DOIT passer par cette fonction.
 */
export const getDisplayLabel = (resolvedView, rawExpense = {}) => {
    const label = resolvedView?.desc?.trim()
        || rawExpense.desc?.trim()
        || rawExpense.type;

    if (import.meta.env.DEV && !label) {
        console.warn('[labelResolver] Poste sans libellé résolvable:', rawExpense.id);
    }

    return formatExpenseLabel(label || 'Poste sans libellé');
};

export const getHumanLabel = (resolvedView, rawExpense = {}) =>
    getDisplayLabel(resolvedView, rawExpense);

/**
 * Résout la liste complète (utilitaire pour le panier et le matcher).
 */
export const resolveAllExpenseViews = (expenses = [], overrides = {}, dossierExpenses = []) => {
    const index = indexDossierExpenses(dossierExpenses);
    return expenses.map(e => resolveExpenseView(e, overrides[e.id], index));
};
