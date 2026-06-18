// src/ai/ai.config.js
import { AI_ROLES, AI_ROLE_META, isValidModelId, AI_PROVIDERS } from './ai.catalog.js';

export const TEMPERATURE_BOUNDS = Object.freeze({ min: 0, max: 1, step: 0.05 });

export const buildDefaultAiConfig = () => ({
    apiKey: '',
    provider: AI_PROVIDERS.OPENAI,
    parameters: { temperature: 0.1 },
    roles: {
        [AI_ROLES.EXTRACTION]: AI_ROLE_META[AI_ROLES.EXTRACTION].defaultModel,
        [AI_ROLES.SYNTHESIS]: AI_ROLE_META[AI_ROLES.SYNTHESIS].defaultModel,
        [AI_ROLES.REFINEMENT]: AI_ROLE_META[AI_ROLES.REFINEMENT].defaultModel,
    },
});

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export const sanitizeAiConfig = (raw) => {
    const def = buildDefaultAiConfig();
    if (!raw || typeof raw !== 'object') return def;

    const temp = Number(raw?.parameters?.temperature);
    const validTemp = !isNaN(temp) ? clamp(temp, TEMPERATURE_BOUNDS.min, TEMPERATURE_BOUNDS.max) : def.parameters.temperature;

    const roles = { ...def.roles };
    if (raw.roles && typeof raw.roles === 'object') {
        for (const role of Object.values(AI_ROLES)) {
            const candidate = raw.roles[role];
            roles[role] = isValidModelId(candidate) ? candidate : def.roles[role];
        }
    } else if (raw.model) {
        // Migration depuis l'ancien aiConfig { model: '...' }
        const migratedModel = isValidModelId(raw.model) ? raw.model : 'gpt-4o';
        roles[AI_ROLES.EXTRACTION] = migratedModel;
        roles[AI_ROLES.SYNTHESIS] = migratedModel;
        roles[AI_ROLES.REFINEMENT] = migratedModel;
    }

    return {
        apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : def.apiKey,
        provider: typeof raw.provider === 'string' ? raw.provider : def.provider,
        parameters: { temperature: validTemp },
        roles
    };
};
