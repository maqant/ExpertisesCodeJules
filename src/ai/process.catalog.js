// src/ai/process.catalog.js
import { AI_ROLES, isValidModelId, BASE_DEFAULT_MODEL } from './ai.catalog.js';
import { DEFAULT_PROMPTS } from '../store/promptStore.js';
import { SCENARIO_REGISTRY } from './scenario.registry.js';

/**
 * Catalogue déclaratif des PROCESSUS MÉTIER.
 * Vue de documentation/UI et pilotage des configurations spécifiques.
 *
 * Chaque processus déclare :
 *  - id : identifiant stable
 *  - label : nom métier affiché
 *  - group : regroupement UI (agents d'ingestion, génération, etc.)
 *  - role : AI_ROLE dont il hérite (pour l'UI/sémantique uniquement)
 *  - defaultModel: Le modèle utilisé par défaut en dernier recours
 *  - promptKey : clé dans DEFAULT_PROMPTS (null si pas de prompt dédié)
 *  - hint : explication métier courte
 */
export const PROCESS_CATALOG = Object.freeze([
    // --- Ingestion / Extraction ---
    { id: 'agent_admin',    label: 'Agent Administratif', group: 'Ingestion documentaire', role: AI_ROLES.EXTRACTION, defaultModel: BASE_DEFAULT_MODEL, promptKey: 'ADMIN',  hint: 'Lecture du contrat, garanties, conditions.' },
    { id: 'agent_social',   label: 'Agent Social',        group: 'Ingestion documentaire', role: AI_ROLES.EXTRACTION, defaultModel: BASE_DEFAULT_MODEL, promptKey: 'SOCIAL', hint: 'Occupants, intervenants, parties.' },
    { id: 'agent_financial',label: 'Agent Financier',     group: 'Ingestion documentaire', role: AI_ROLES.EXTRACTION, defaultModel: BASE_DEFAULT_MODEL, promptKey: 'FINANCIAL', hint: 'Devis, factures, montants.' },
    { id: 'extraction_dropzone', label: 'Extraction Dropzone', group: 'Ingestion documentaire', role: AI_ROLES.EXTRACTION, defaultModel: BASE_DEFAULT_MODEL, promptKey: null, hint: 'Extraction générique des documents déposés.' },

    // --- Synthèse / Génération ---
    { id: 'agent_narrative', label: 'Agent Récits',        group: 'Génération du rapport', role: AI_ROLES.SYNTHESIS, defaultModel: BASE_DEFAULT_MODEL, promptKey: 'NARRATIVE_BASE', hint: 'Analyse narrative des récits.' },
    { id: 'brio_summary',    label: 'Résumé Brio',         group: 'Génération du rapport', role: AI_ROLES.SYNTHESIS, defaultModel: BASE_DEFAULT_MODEL, promptKey: 'prompt_brio_prep', hint: 'Préparation du résumé Brio.' },
    { id: 'final_document',  label: 'Document final',      group: 'Génération du rapport', role: AI_ROLES.SYNTHESIS, defaultModel: BASE_DEFAULT_MODEL, promptKey: null, hint: 'Assemblage du rapport d\'expertise final.' },
    { id: 'ar_modal',        label: 'Accusé de Réception', group: 'Génération du rapport', role: AI_ROLES.SYNTHESIS, defaultModel: BASE_DEFAULT_MODEL, promptKey: 'prompt_ar_generator', hint: 'Génération de la modale AR.' },

    // --- Affinage / Reformulation ---
    { id: 'agent_router',    label: 'Agent Routeur',       group: 'Affinage & orchestration', role: AI_ROLES.REFINEMENT, defaultModel: 'gpt-5.4-nano', promptKey: 'ROUTER', hint: 'Triage initial rapide des données.' },
    { id: 'agent_merger',    label: 'Agent Merger',        group: 'Affinage & orchestration', role: AI_ROLES.REFINEMENT, defaultModel: BASE_DEFAULT_MODEL, promptKey: 'MERGER', hint: 'Déduplication finale.' },
    { id: 'agent_fallback',  label: 'Agent Balai',         group: 'Affinage & orchestration', role: AI_ROLES.REFINEMENT, defaultModel: BASE_DEFAULT_MODEL, promptKey: 'FALLBACK', hint: 'Récupération des trous vitaux.' },
    { id: 'manual_refine',   label: 'Reformulation manuelle', group: 'Affinage & orchestration', role: AI_ROLES.REFINEMENT, defaultModel: BASE_DEFAULT_MODEL, promptKey: 'REFINE_REWRITE', hint: 'Reformulation à la demande de l\'utilisateur.' },
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
    const processesInScenarios = new Set();
    
    SCENARIO_REGISTRY.forEach(s => s.processIds.forEach(id => processesInScenarios.add(id)));

    for (const p of PROCESS_CATALOG) {
        if (seenIds.has(p.id)) errors.push(`Doublon d'id de processus : "${p.id}".`);
        seenIds.add(p.id);

        if (!validRoles.has(p.role)) {
            errors.push(`Processus "${p.id}" référence un rôle inexistant : "${p.role}".`);
        }
        
        if (!p.defaultModel || !isValidModelId(p.defaultModel)) {
            errors.push(`Processus "${p.id}" n'a pas de \`defaultModel\` valide.`);
        }
        
        if (p.promptKey !== null && !validPromptKeys.has(p.promptKey)) {
            errors.push(`Processus "${p.id}" référence une clé de prompt inexistante : "${p.promptKey}".`);
        }

        if (!processesInScenarios.has(p.id)) {
            errors.push(`Processus "${p.id}" n'appartient à aucun scénario. Manque de traçabilité.`);
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

/**
 * SOURCE DE VÉRITÉ UNIQUE pour résoudre le modèle effectif d'un processus.
 * Priorité : override processus > modèle du rôle (aiConfig) > modèle par défaut du processus.
 * @returns {{ modelId: string, source: 'override'|'role'|'process-default', isOverridden: boolean, role: string }}
 */
export function resolveModelForProcess(processId, aiConfig) {
    const proc = PROCESS_CATALOG.find(p => p.id === processId);
    if (!proc) throw new Error(`[resolveModelForProcess] Processus inconnu : "${processId}".`);

    const overrides = aiConfig?.processOverrides ?? {};
    const roles = aiConfig?.roles ?? {};

    const overrideModel = overrides[processId];
    if (overrideModel) {
        if (!isValidModelId(overrideModel)) {
            // Erreur explicite, jamais silencieuse
            console.error(`[resolveModelForProcess] Override invalide "${overrideModel}" pour "${processId}". Fallback rôle.`);
        } else {
            return { modelId: overrideModel, source: 'override', isOverridden: true, role: proc.role };
        }
    }

    const roleModel = roles[proc.role];
    if (roleModel && isValidModelId(roleModel)) {
        return { modelId: roleModel, source: 'role', isOverridden: false, role: proc.role };
    }

    const fallback = proc.defaultModel;
    return { modelId: fallback, source: 'process-default', isOverridden: false, role: proc.role };
}

/**
 * Carte des dépendances croisées par prompt : promptKey -> [processus partageant ce prompt].
 */
export function buildPromptUsageMap() {
    const map = {};
    for (const p of PROCESS_CATALOG) {
        if (!p.promptKey) continue;
        (map[p.promptKey] ??= []).push(p);
    }
    return Object.freeze(map);
}

// Validation immédiate au chargement du module (fail-fast).
validateProcessCatalog();
