// src/ai/scenario.registry.js

/**
 * SOURCE DE VÉRITÉ de la cartographie des déclencheurs IA.
 * Ce registre permet d'expliquer à l'utilisateur (via le Laboratoire IA) 
 * à quel moment de son parcours (Scénario) chaque processus IA est appelé.
 */

export const SCENARIO_REGISTRY = Object.freeze([
    {
        id: 'smart_bridge_drop',
        label: 'Dépôt dans le Smart Bridge',
        source: 'Dropzone Principale',
        description: 'Ingestion massive de documents déstructurés et extraction multi-agents.',
        processIds: [
            'agent_router', 
            'agent_admin', 
            'agent_social', 
            'agent_narrative', 
            'agent_financial', 
            'agent_fallback', 
            'agent_merger'
        ]
    },
    {
        id: 'brio_summary_request',
        label: 'Résumé Brio',
        source: 'Onglet Brio',
        description: 'Préparation et synthèse du résumé Brio à partir des données ingérées.',
        processIds: ['brio_summary']
    },
    {
        id: 'ar_generation',
        label: 'Génération Accusé de Réception',
        source: 'Bouton Générer AR',
        description: 'Génération du courrier d’accusé de réception pour le client.',
        processIds: ['ar_modal']
    },
    {
        id: 'final_report',
        label: 'Génération Document Final',
        source: 'Création du rapport',
        description: 'Assemblage du rapport d’expertise final et de ses annexes.',
        processIds: ['final_document']
    },
    {
        id: 'manual_reformulation',
        label: 'Reformulation Manuelle',
        source: 'Bouton Magique (Texte)',
        description: 'Reformulation d’un segment de texte à la demande de l’utilisateur.',
        processIds: ['manual_refine']
    },
    {
        id: 'dropzone_direct',
        label: 'Extraction Rapide (Dropzone)',
        source: 'Zones de dépôt annexes',
        description: 'Extraction isolée d\'un document glissé hors du flux principal.',
        processIds: ['extraction_dropzone']
    },
    {
        id: 'magic_drop_financial',
        label: 'Dépôt Frais Financiers / Devis',
        source: 'Dropzone Frais Financiers',
        description: 'Extraction isolée et intelligente d\'un devis ou d\'une facture rattaché à une dépense financière.',
        processIds: ['agent_financial']
    },
    {
        id: 'magic_drop_cause',
        label: 'Dépôt Rapports de Recherche',
        source: 'Dropzone Rapports de Recherche',
        description: 'Extraction narrative d\'un rapport de recherche de cause (handleCauseMagicDrop) via l\'agent récit.',
        processIds: ['agent_narrative']
    }
]);

// --- Index dérivés (calculés) pour affichage ---

/** Map<processId, Scenario[]> : quels scénarios utilisent un process donné. */
export const PROCESS_TO_SCENARIOS = Object.freeze(
    SCENARIO_REGISTRY.reduce((acc, scenario) => {
        scenario.processIds.forEach((pid) => {
            if (!acc[pid]) acc[pid] = [];
            acc[pid].push(scenario);
        });
        return acc;
    }, {})
);
