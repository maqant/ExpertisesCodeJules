// src/ai/ai.config.js
import { AI_ROLES, AI_ROLE_META, isValidModelId, AI_PROVIDERS, BASE_DEFAULT_MODEL } from './ai.catalog.js';

export const TEMPERATURE_BOUNDS = Object.freeze({ min: 0, max: 1, step: 0.05 });

// Version de migration. Tout cache antérieur déclenche la purge des modèles fantômes.
export const AI_CONFIG_VERSION = 2;

// Modèles obsolètes à purger de force vers BASE_DEFAULT_MODEL lors de la migration v2.
const GHOST_MODELS = Object.freeze(['o1-mini', 'o1-preview', 'gpt-4o']);

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

    // La purge s'exécute UNE SEULE FOIS, sur tout cache antérieur à la version courante.
    const needsGhostPurge = Number(raw.__configVersion || 0) < AI_CONFIG_VERSION;

    const temp = Number(raw?.parameters?.temperature);
    const validTemp = !isNaN(temp) ? clamp(temp, TEMPERATURE_BOUNDS.min, TEMPERATURE_BOUNDS.max) : def.parameters.temperature;

    const roles = { ...def.roles };
    if (raw.roles && typeof raw.roles === 'object') {
        for (const role of Object.values(AI_ROLES)) {
            const candidate = raw.roles[role];
            
            // 1. On exorcise les fantômes (o1-mini, o1-preview, gpt-4o) une fois pour toutes.
            if (needsGhostPurge && GHOST_MODELS.includes(candidate)) {
                roles[role] = def.roles[role]; // -> BASE_DEFAULT_MODEL (gpt-5.4)
                continue;
            }

            // 2. Sinon, on respecte le choix légitime de l'expert s'il est valide.
            roles[role] = isValidModelId(candidate) ? candidate : def.roles[role];
        }
    } else if (raw.model) {
        // Migration depuis l'ancien aiConfig { model: '...' }
        // gpt-4o (ancien défaut) et modèles fantômes -> on retombe sur la nouvelle archi.
        if (isValidModelId(raw.model) && !GHOST_MODELS.includes(raw.model)) {
            roles[AI_ROLES.EXTRACTION] = raw.model;
            roles[AI_ROLES.SYNTHESIS] = raw.model;
            roles[AI_ROLES.REFINEMENT] = raw.model;
        }
        // Sinon : fallback natif de def.roles (gpt-5.4) déjà assigné.
    }

    return {
        __configVersion: AI_CONFIG_VERSION, // scelle la migration : la purge ne se rejouera pas.
        apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : def.apiKey,
        provider: typeof raw.provider === 'string' ? raw.provider : def.provider,
        parameters: { temperature: validTemp },
        roles,
        processOverrides: raw.processOverrides && typeof raw.processOverrides === 'object' ? raw.processOverrides : {}
    };
};
