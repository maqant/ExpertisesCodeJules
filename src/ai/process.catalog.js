// src/ai/process.catalog.js
import { AI_ROLES } from './ai.catalog.js';
import { DEFAULT_PROMPTS } from '../store/promptStore.js';

/**
 * Catalogue déclaratif des PROCESSUS MÉTIER.
 * Vue de documentation/UI uniquement : NE PILOTE PAS le runtime.
 * Le runtime continue d'utiliser les Rôles Globaux (ai.resolver.js).
 *
 * Chaque processus déclare :
 *  - id : identifiant stable
 *  - label : nom métier affiché
 *  - group : regroupement UI (agents d'ingestion, génération, etc.)
 *  - role : AI_ROLE dont il hérite le modèle (clé de l'interdépendance)
 *  - promptKey : clé dans DEFAULT_PROMPTS (null si pas de prompt dédié)
 *  - hint : explication métier courte
 */
export const PROCESS_CATALOG = Object.freeze([
    // --- Ingestion / Extraction ---
    { id: 'agent_admin',    label: 'Agent Administratif', group: 'Ingestion documentaire', role: AI_ROLES.EXTRACTION, promptKey: 'ADMIN',  hint: 'Lecture du contrat, garanties, conditions.' },
    { id: 'agent_social',   label: 'Agent Social',        group: 'Ingestion documentaire', role: AI_ROLES.EXTRACTION, promptKey: 'SOCIAL', hint: 'Occupants, intervenants, parties.' },
    { id: 'agent_financial',label: 'Agent Financier',     group: 'Ingestion documentaire', role: AI_ROLES.EXTRACTION, promptKey: 'FINANCIAL', hint: 'Devis, factures, montants.' },
    { id: 'extraction_dropzone', label: 'Extraction Dropzone', group: 'Ingestion documentaire', role: AI_ROLES.EXTRACTION, promptKey: null, hint: 'Extraction générique des documents déposés.' },

    // --- Synthèse / Génération ---
    { id: 'agent_narrative', label: 'Agent Récits',        group: 'Génération du rapport', role: AI_ROLES.SYNTHESIS, promptKey: 'NARRATIVE_BASE', hint: 'Analyse narrative des récits.' },
    { id: 'brio_summary',    label: 'Résumé Brio',         group: 'Génération du rapport', role: AI_ROLES.SYNTHESIS, promptKey: 'prompt_brio_prep', hint: 'Préparation du résumé Brio.' },
    { id: 'final_document',  label: 'Document final',      group: 'Génération du rapport', role: AI_ROLES.SYNTHESIS, promptKey: null, hint: 'Assemblage du rapport d\'expertise final.' },
    { id: 'ar_modal',        label: 'Accusé de Réception', group: 'Génération du rapport', role: AI_ROLES.SYNTHESIS, promptKey: 'prompt_ar_generator', hint: 'Génération de la modale AR.' },

    // --- Affinage / Reformulation ---
    { id: 'agent_router',    label: 'Agent Routeur',       group: 'Affinage & orchestration', role: AI_ROLES.REFINEMENT, promptKey: 'ROUTER', hint: 'Triage initial rapide des données.' },
    { id: 'agent_merger',    label: 'Agent Merger',        group: 'Affinage & orchestration', role: AI_ROLES.REFINEMENT, promptKey: 'MERGER', hint: 'Déduplication finale.' },
    { id: 'agent_fallback',  label: 'Agent Balai',         group: 'Affinage & orchestration', role: AI_ROLES.REFINEMENT, promptKey: 'FALLBACK', hint: 'Récupération des trous vitaux.' },
    { id: 'manual_refine',   label: 'Reformulation manuelle', group: 'Affinage & orchestration', role: AI_ROLES.REFINEMENT, promptKey: 'REFINE_REWRITE', hint: 'Reformulation à la demande de l\'utilisateur.' },
]);

/**
 * VALIDATION ANTI-ERREUR-SILENCIEUSE.
 * Lève dès le chargement si une référence est cassée.
 */
export function validateProcessCatalog() {
    const validRoles = new Set(Object.values(AI_ROLES));
    const validPromptKeys = new Set(Object.keys(DEFAULT_PROMPTS));
    const errors = [];
    const seenIds = new Set();

    for (const p of PROCESS_CATALOG) {
        if (seenIds.has(p.id)) errors.push(`Doublon d'id de processus : "${p.id}".`);
        seenIds.add(p.id);

        if (!validRoles.has(p.role)) {
            errors.push(`Processus "${p.id}" référence un rôle inexistant : "${p.role}".`);
        }
        if (p.promptKey !== null && !validPromptKeys.has(p.promptKey)) {
            errors.push(`Processus "${p.id}" référence une clé de prompt inexistante : "${p.promptKey}".`);
        }
    }

    if (errors.length > 0) {
        throw new Error(`[process.catalog] Configuration invalide :\n- ${errors.join('\n- ')}`);
    }
    return true;
}

/**
 * Map dérivée : pour chaque rôle, liste des processus qui en dépendent.
 * Sert à afficher les interdépendances dans l'UI.
 */
export function buildRoleUsageMap() {
    const map = {};
    for (const role of Object.values(AI_ROLES)) map[role] = [];
    for (const p of PROCESS_CATALOG) map[p.role].push(p);
    return Object.freeze(map);
}

/** Processus regroupés par `group` pour l'affichage. */
export function getProcessesByGroup() {
    const groups = {};
    for (const p of PROCESS_CATALOG) {
        (groups[p.group] ??= []).push(p);
    }
    return groups;
}

// Validation immédiate au chargement du module (fail-fast).
validateProcessCatalog();
