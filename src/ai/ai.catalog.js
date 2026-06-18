// src/ai/ai.catalog.js

export const AI_PROVIDERS = Object.freeze({
    OPENAI: 'openai',
});

export const MODEL_CATALOG = Object.freeze({
    'gpt-5.5': {
        id: 'gpt-5.5',
        apiModel: 'gpt-5.5-2026-04-23',
        label: 'GPT-5.5 (Deep Thinking)',
        provider: AI_PROVIDERS.OPENAI,
        group: 'GPT-5',
        capabilities: { supportsTemperature: true, supportsJsonSchema: true, defaultMaxTokens: 16384 },
    },
    'gpt-5.4': {
        id: 'gpt-5.4',
        apiModel: 'gpt-5.4-2026-03-05',
        label: 'GPT-5.4 (Standard)',
        provider: AI_PROVIDERS.OPENAI,
        group: 'GPT-5',
        capabilities: { supportsTemperature: true, supportsJsonSchema: true, defaultMaxTokens: 8192 },
    },
    'gpt-5.4-nano': {
        id: 'gpt-5.4-nano',
        apiModel: 'gpt-5.4-nano-2026-03-17',
        label: 'GPT-5.4-nano (Ultra Rapide)',
        provider: AI_PROVIDERS.OPENAI,
        group: 'GPT-5',
        capabilities: { supportsTemperature: true, supportsJsonSchema: true, defaultMaxTokens: 4096 },
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
