// src/ai/ai.config.js
import { AI_ROLES, AI_ROLE_META, isValidModelId, AI_PROVIDERS, BASE_DEFAULT_MODEL, DEFAULT_ROLE_MODELS } from './ai.catalog.js';

/**
 * Source de vérité unique pour la clé API.
 * Priorité : Vercel Environment Variable (VITE_OPENAI_API_KEY).
 * Le optional chaining protège les contextes non-Vite (tests Node).
 */
export const resolveEnvApiKey = () =>
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_OPENAI_API_KEY) || '';

export const TEMPERATURE_BOUNDS = Object.freeze({ min: 0, max: 1, step: 0.05 });

// v5 : clé API résolue exclusivement via Vercel ENV (VITE_OPENAI_API_KEY).
// Suppression du panneau Laboratoire IA — plus aucune saisie manuelle.
export const AI_CONFIG_VERSION = 5;

export const buildDefaultAiConfig = () => ({
    __configVersion: AI_CONFIG_VERSION,
    apiKey: resolveEnvApiKey(),
    provider: AI_PROVIDERS.OPENAI,
    parameters: { temperature: 0.1 },
    roles: {
        [AI_ROLES.EXTRACTION]: DEFAULT_ROLE_MODELS[AI_ROLES.EXTRACTION],
        [AI_ROLES.SYNTHESIS]: DEFAULT_ROLE_MODELS[AI_ROLES.SYNTHESIS],
        [AI_ROLES.REFINEMENT]: DEFAULT_ROLE_MODELS[AI_ROLES.REFINEMENT],
    },
});

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export const sanitizeAiConfig = (raw) => {
    const def = buildDefaultAiConfig();
    if (!raw || typeof raw !== 'object') return def;

    const temp = Number(raw?.parameters?.temperature);
    const validTemp = !isNaN(temp)
        ? clamp(temp, TEMPERATURE_BOUNDS.min, TEMPERATURE_BOUNDS.max)
        : def.parameters.temperature;

    const roles = { ...def.roles };

    if (raw.roles && typeof raw.roles === 'object') {
        for (const role of Object.values(AI_ROLES)) {
            const candidate = raw.roles[role];
            roles[role] = isValidModelId(candidate) ? candidate : def.roles[role];
        }
    } else if (raw.model) {
        if (isValidModelId(raw.model)) {
            roles[AI_ROLES.EXTRACTION] = raw.model;
            roles[AI_ROLES.SYNTHESIS] = raw.model;
            roles[AI_ROLES.REFINEMENT] = raw.model;
        }
    }

    let sanitizedOverrides = {};
    if (raw.processOverrides && typeof raw.processOverrides === 'object') {
        for (const [procId, modelId] of Object.entries(raw.processOverrides)) {
            if (isValidModelId(modelId)) {
                sanitizedOverrides[procId] = modelId;
            } else {
                console.warn(`[ai.config] Purge de l'override obsolète pour ${procId}: modèle "${modelId}" inconnu.`);
            }
        }
    }

    return {
        __configVersion: AI_CONFIG_VERSION,
        // G1 : la variable d'environnement Vercel prime TOUJOURS sur toute valeur persistée
        apiKey: resolveEnvApiKey() || (typeof raw.apiKey === 'string' ? raw.apiKey.trim() : ''),
        provider: typeof raw.provider === 'string' ? raw.provider : def.provider,
        parameters: { temperature: validTemp },
        roles,
        processOverrides: sanitizedOverrides
    };
};
