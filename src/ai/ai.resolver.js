// src/ai/ai.resolver.js
import { getModelMeta, AI_ROLES } from './ai.catalog.js';
import { resolveModelForProcess } from './process.catalog.js';

/**
 * Construit le payload pour l'API d'OpenAI, en l'adaptant selon les capacités
 * du modèle choisi pour le processus spécifié.
 * 
 * @param {Object} config - aiConfig (sanitized) complet.
 * @param {string} processId - L'identifiant du processus métier (ex: 'agent_admin')
 * @param {Array} messages - Les messages (system/user). Note: o1 ne supporte 'system' qu'avec de récents ajustements, on gardera 'system' pour l'instant ou on le convertira en 'user' si besoin futur.
 * @param {Object} options - Options contextuelles (ex: forceJsonResponse, maxTokensOverride).
 * @returns {Object} Le payload prêt à être envoyé à l'API OpenAI.
 */
export const buildAiPayload = (config, processId, messages, options = {}) => {
    const { modelId, role: resolvedRole } = resolveModelForProcess(processId, config);
    const meta = getModelMeta(modelId);
    if (!meta) throw new Error(`Modèle non trouvé pour le processus ${processId} (rôle ${resolvedRole}): ${modelId}`);

    const payload = {
        model: modelId,
        messages: [...messages],
    };

    // Pour la famille o1, OpenAI demande souvent d'utiliser uniquement 'user' et 'assistant' (pas 'system').
    // On convertit automatiquement le rôle 'system' en 'user' si on est sur o1.
    if (!meta.capabilities.supportsTemperature) { // o1 family
        payload.messages = payload.messages.map(msg => {
            if (msg.role === 'system') {
                return { ...msg, role: 'user' };
            }
            return msg;
        });
    }

    if (meta.capabilities.supportsTemperature) {
        payload.temperature = options.temperature ?? config.parameters.temperature;
    }

    if (meta.capabilities.supportsJsonSchema && options.forceJsonResponse) {
        payload.response_format = { type: "json_object" };
    }

    // Le max_tokens pour o1 est en fait max_completion_tokens (depuis de récentes MAJ d'OpenAI), mais restons sur max_tokens standard si compatible.
    // OpenAI a introduit `max_completion_tokens` pour o1.
    const maxTokens = options.maxTokensOverride || meta.capabilities.defaultMaxTokens;
    if (meta.capabilities.usesMaxCompletionTokens) {
        payload.max_completion_tokens = maxTokens;
    } else {
        payload.max_tokens = maxTokens;
    }

    return payload;
};
