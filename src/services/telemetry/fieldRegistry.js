/**
 * fieldRegistry.js
 * SOURCE DE VÉRITÉ UNIQUE du sens métier des champs du rapport.
 *
 * Chaque champ de formData est décrit ici : à quelle section métier il
 * appartient, sa criticité, et la catégorie d'erreur associée.
 */

export const SECTIONS = Object.freeze({
    ADMIN: 'admin',
    SOCIAL: 'social',
    FINANCIAL: 'financial',
    NARRATIVE: 'narrative',
    UNKNOWN: 'unknown',
});

export const CRITICALITY = Object.freeze({
    CRITICAL: 'critical',
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low',
});

export const ERROR_CATEGORIES = Object.freeze({
    ADMIN: 'adminErr',
    SOCIAL: 'socialErr',
    FINANCIAL: 'financialErr',
    NARRATIVE: 'narrativeErr',
    OTHER: 'otherErr',
});

export const FIELD_REGISTRY = Object.freeze({
    // --- ADMINISTRATIF ---
    dateSinistre:             { section: SECTIONS.ADMIN, criticality: CRITICALITY.CRITICAL, category: ERROR_CATEGORIES.ADMIN, label: 'Date du sinistre' },
    dateDeclaration:          { section: SECTIONS.ADMIN, criticality: CRITICALITY.CRITICAL, category: ERROR_CATEGORIES.ADMIN, label: 'Date de déclaration' },
    franchise:                { section: SECTIONS.ADMIN, criticality: CRITICALITY.CRITICAL, category: ERROR_CATEGORIES.ADMIN, label: 'Franchise' },
    numSinistreCie:           { section: SECTIONS.ADMIN, criticality: CRITICALITY.CRITICAL, category: ERROR_CATEGORIES.ADMIN, label: 'N° sinistre compagnie' },
    numPolice:                { section: SECTIONS.ADMIN, criticality: CRITICALITY.CRITICAL, category: ERROR_CATEGORIES.ADMIN, label: 'N° police' },
    nomCie:                   { section: SECTIONS.ADMIN, criticality: CRITICALITY.CRITICAL, category: ERROR_CATEGORIES.ADMIN, label: 'Compagnie' },
    nomContrat:               { section: SECTIONS.ADMIN, criticality: CRITICALITY.HIGH,     category: ERROR_CATEGORIES.ADMIN, label: 'Nom du contrat' },
    declarant:                { section: SECTIONS.ADMIN, criticality: CRITICALITY.CRITICAL, category: ERROR_CATEGORIES.SOCIAL, label: 'Déclarant' },
    dateExp:                  { section: SECTIONS.ADMIN, criticality: CRITICALITY.HIGH,     category: ERROR_CATEGORIES.ADMIN, label: 'Date exp.' },
    heureExp:                 { section: SECTIONS.ADMIN, criticality: CRITICALITY.MEDIUM,   category: ERROR_CATEGORIES.ADMIN, label: 'Heure exp.' },
    nomResidence:             { section: SECTIONS.ADMIN, criticality: CRITICALITY.MEDIUM,   category: ERROR_CATEGORIES.ADMIN, label: 'Nom Résidence' },
    adresse:                  { section: SECTIONS.ADMIN, criticality: CRITICALITY.HIGH,     category: ERROR_CATEGORIES.ADMIN, label: 'Adresse' },
    expertInfos:              { section: SECTIONS.ADMIN, criticality: CRITICALITY.LOW,      category: ERROR_CATEGORIES.ADMIN, label: 'ExpertInfos' },
    numConditionsGenerales:   { section: SECTIONS.ADMIN, criticality: CRITICALITY.MEDIUM,   category: ERROR_CATEGORIES.ADMIN, label: 'N° CG' },
    numeroPVPolice:           { section: SECTIONS.ADMIN, criticality: CRITICALITY.MEDIUM,   category: ERROR_CATEGORIES.ADMIN, label: 'PV Police' },
    pertesIndirectes:         { section: SECTIONS.ADMIN, criticality: CRITICALITY.HIGH,     category: ERROR_CATEGORIES.ADMIN, label: 'PI (%)' },
    filenameCP:               { section: SECTIONS.ADMIN, criticality: CRITICALITY.HIGH,     category: ERROR_CATEGORIES.ADMIN, label: 'Fichier CP' },
    filenameCG:               { section: SECTIONS.ADMIN, criticality: CRITICALITY.HIGH,     category: ERROR_CATEGORIES.ADMIN, label: 'Fichier CG' },

    // --- NARRATIF ---
    cause:                    { section: SECTIONS.NARRATIVE, criticality: CRITICALITY.CRITICAL, category: ERROR_CATEGORIES.NARRATIVE, label: 'Cause' },
    divers:                   { section: SECTIONS.NARRATIVE, criticality: CRITICALITY.MEDIUM,   category: ERROR_CATEGORIES.NARRATIVE, label: 'Divers' },
    compteRendu:              { section: SECTIONS.NARRATIVE, criticality: CRITICALITY.MEDIUM,   category: ERROR_CATEGORIES.NARRATIVE, label: 'Compte rendu' }
});

export const getFieldMeta = (fieldName) => {
    return FIELD_REGISTRY[fieldName] || {
        section: SECTIONS.UNKNOWN,
        criticality: CRITICALITY.LOW,
        category: ERROR_CATEGORIES.OTHER,
        label: fieldName
    };
};
