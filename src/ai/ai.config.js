// src/ai/ai.config.js
import { AI_ROLES, AI_ROLE_META, isValidModelId, AI_PROVIDERS, BASE_DEFAULT_MODEL } from './ai.catalog.js';

export const TEMPERATURE_BOUNDS = Object.freeze({ min: 0, max: 1, step: 0.05 });

export const buildDefaultAiConfig = () => ({
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
    const validTemp = !isNaN(temp) ? clamp(temp, TEMPERATURE_BOUNDS.min, TEMPERATURE_BOUNDS.max) : def.parameters.temperature;

    const roles = { ...def.roles };
    if (raw.roles && typeof raw.roles === 'object') {
        for (const role of Object.values(AI_ROLES)) {
            const candidate = raw.roles[role];
            roles[role] = isValidModelId(candidate) ? candidate : def.roles[role];
        }
    } else if (raw.model) {
        // Migration depuis l'ancien aiConfig { model: '...' }
        // Si l'utilisateur avait l'ancien modèle par défaut (gpt-4o), on l'ignore
        // pour laisser place à la nouvelle architecture (gpt-5.4, gpt-5.5, nano).
        // S'il avait mis un modèle ultra spécifique (ex: o1-preview), on le garde.
        if (isValidModelId(raw.model) && raw.model !== 'gpt-4o') {
            roles[AI_ROLES.EXTRACTION] = raw.model;
            roles[AI_ROLES.SYNTHESIS] = raw.model;
            roles[AI_ROLES.REFINEMENT] = raw.model;
        }
        // Sinon, on laisse le fallback natif de def.roles (déjà assigné ci-dessus).
    }

    return {
        apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : def.apiKey,
        provider: typeof raw.provider === 'string' ? raw.provider : def.provider,
        parameters: { temperature: validTemp },
        roles,
        processOverrides: raw.processOverrides && typeof raw.processOverrides === 'object' ? raw.processOverrides : {}
    };
};
