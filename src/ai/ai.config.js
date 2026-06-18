// src/ai/ai.config.js
import { AI_ROLES, AI_ROLE_META, isValidModelId, AI_PROVIDERS, BASE_DEFAULT_MODEL } from './ai.catalog.js';

export const TEMPERATURE_BOUNDS = Object.freeze({ min: 0, max: 1, step: 0.05 });

// Version de migration. Tout cache antérieur déclenche la re-validation
// des modèles : tout ID absent du catalogue courant retombe sur BASE_DEFAULT_MODEL.
export const AI_CONFIG_VERSION = 3;

export const buildDefaultAiConfig = () => ({
    __configVersion: AI_CONFIG_VERSION,
    apiKey: '',
    provider: AI_PROVIDERS.OPENAI,
    parameters: { temperature: 0.1 },
    roles: {
        [AI_ROLES.EXTRACTION]: BASE_DEFAULT_MODEL,
        [AI_ROLES.SYNTHESIS]: BASE_DEFAULT_MODEL,
        [AI_ROLES.REFINEMENT]: BASE_DEFAULT_MODEL,
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

    return {
        __configVersion: AI_CONFIG_VERSION,
        apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : def.apiKey,
        provider: typeof raw.provider === 'string' ? raw.provider : def.provider,
        parameters: { temperature: validTemp },
        roles,
        processOverrides: raw.processOverrides && typeof raw.processOverrides === 'object'
            ? raw.processOverrides
            : {}
    };
};
