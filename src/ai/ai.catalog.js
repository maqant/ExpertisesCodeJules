// src/ai/ai.catalog.js

export const AI_PROVIDERS = Object.freeze({
    OPENAI: 'openai',
});

export const MODEL_CATALOG = Object.freeze({
    'gpt-4o': {
        id: 'gpt-4o',
        apiModel: 'gpt-4o',
        label: 'GPT-4o (équilibré)',
        provider: AI_PROVIDERS.OPENAI,
        group: 'GPT-4o',
        capabilities: { supportsTemperature: true, supportsJsonSchema: true, defaultMaxTokens: 4096 },
    },
    'gpt-4o-mini': {
        id: 'gpt-4o-mini',
        apiModel: 'gpt-4o-mini',
        label: 'GPT-4o-mini (rapide / économique)',
        provider: AI_PROVIDERS.OPENAI,
        group: 'GPT-4o',
        capabilities: { supportsTemperature: true, supportsJsonSchema: true, defaultMaxTokens: 4096 },
    },
    'gpt-4-turbo': {
        id: 'gpt-4-turbo',
        apiModel: 'gpt-4-turbo',
        label: 'GPT-4 Turbo',
        provider: AI_PROVIDERS.OPENAI,
        group: 'GPT-4',
        capabilities: { supportsTemperature: true, supportsJsonSchema: true, defaultMaxTokens: 4096 },
    },
    'gpt-5.3': {
        id: 'gpt-5.3',
        apiModel: 'gpt-4o',
        label: 'GPT-5.3',
        provider: AI_PROVIDERS.OPENAI,
        group: 'GPT-5',
        capabilities: { supportsTemperature: true, supportsJsonSchema: true, defaultMaxTokens: 8192 },
    },
    'gpt-5.4': {
        id: 'gpt-5.4',
        apiModel: 'gpt-4o',
        label: 'GPT-5.4 (Standard)',
        provider: AI_PROVIDERS.OPENAI,
        group: 'GPT-5',
        capabilities: { supportsTemperature: true, supportsJsonSchema: true, defaultMaxTokens: 8192 },
    },
    'gpt-5.4-nano': {
        id: 'gpt-5.4-nano',
        apiModel: 'gpt-4o-mini',
        label: 'GPT-5.4-nano (Ultra Rapide)',
        provider: AI_PROVIDERS.OPENAI,
        group: 'GPT-5',
        capabilities: { supportsTemperature: true, supportsJsonSchema: true, defaultMaxTokens: 4096 },
    },
    'gpt-5.5': {
        id: 'gpt-5.5',
        apiModel: 'gpt-4o',
        label: 'GPT-5.5 (Deep Thinking)',
        provider: AI_PROVIDERS.OPENAI,
        group: 'GPT-5',
        capabilities: { supportsTemperature: true, supportsJsonSchema: true, defaultMaxTokens: 16384 },
    },
    'o1-preview': {
        id: 'o1-preview',
        apiModel: 'o1-preview',
        label: 'o1-preview (raisonnement avancé)',
        provider: AI_PROVIDERS.OPENAI,
        group: 'o1 (raisonnement)',
        capabilities: { supportsTemperature: false, supportsJsonSchema: false, usesMaxCompletionTokens: true, defaultMaxTokens: 8192 },
    },
    'o1-mini': {
        id: 'o1-mini',
        apiModel: 'o1-mini',
        label: 'o1-mini (raisonnement rapide)',
        provider: AI_PROVIDERS.OPENAI,
        group: 'o1 (raisonnement)',
        capabilities: { supportsTemperature: false, supportsJsonSchema: false, usesMaxCompletionTokens: true, defaultMaxTokens: 8192 },
    },
});

export const MODEL_IDS = Object.freeze(Object.keys(MODEL_CATALOG));

export const AI_ROLES = Object.freeze({
    EXTRACTION: 'extraction',
    SYNTHESIS: 'synthesis',
    REFINEMENT: 'refinement',
});

export const BASE_DEFAULT_MODEL = 'gpt-5.4';

export const AI_ROLE_META = Object.freeze({
    [AI_ROLES.EXTRACTION]: { 
        label: 'Extraction (ingestion documents)', 
        description: 'Lecture et structuration des documents entrants.'
    },
    [AI_ROLES.SYNTHESIS]: { 
        label: 'Synthèse (rapport final)', 
        description: 'Rédaction et assemblage narratif complexe.'
    },
    [AI_ROLES.REFINEMENT]: { 
        label: 'Affinage (reformulation de texte)', 
        description: 'Triage rapide, déduplication et ajustement de texte.'
    },
});

export const isValidModelId = (id) => Object.prototype.hasOwnProperty.call(MODEL_CATALOG, id);
export const getModelMeta = (id) => MODEL_CATALOG[id] ?? null;

export const getApiModelName = (id) => {
    const meta = MODEL_CATALOG[id];
    if (!meta) return null;
    return meta.apiModel ?? meta.id;
};
