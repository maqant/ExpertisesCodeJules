// v1.0.0 - Parseur JSON IA robuste & fail-loud
/**
 * aiJsonParser.js — Utilitaire transverse de parsing des réponses LLM.
 *
 * PRINCIPE : tolérant aux scories de formatage (markdown, préambules),
 * mais JAMAIS silencieux. En cas d'échec définitif, lève une erreur typée
 * enrichie (AiJsonParseError) avec un extrait tronqué du contenu fautif
 * pour diagnostic, sans logguer l'intégralité (données sinistre sensibles).
 *
 * À utiliser dans TOUS les agents au lieu de JSON.parse(...) brut.
 */

export class AiJsonParseError extends Error {
    constructor(message, { componentId, snippet, cause } = {}) {
        super(message);
        this.name = 'AiJsonParseError';
        this.componentId = componentId || 'unknown';
        this.snippet = snippet;
        this.cause = cause;
    }
}

const MAX_SNIPPET = 280;

const safeSnippet = (str) =>
    typeof str === 'string'
        ? str.slice(0, MAX_SNIPPET) + (str.length > MAX_SNIPPET ? '…[tronqué]' : '')
        : String(str);

const stripMarkdownFences = (raw) => {
    let s = raw.replace(/^\uFEFF/, '').trim();
    // Fence d'ouverture ```json ou ``` (avec ou sans saut de ligne)
    s = s.replace(/^```(?:json|JSON)?[ \t]*\r?\n?/, '');
    // Fence de fermeture
    s = s.replace(/\r?\n?```[ \t]*$/, '');
    return s.trim();
};

const extractBalancedJson = (s) => {
    const startIdx = (() => {
        const obj = s.indexOf('{');
        const arr = s.indexOf('[');
        if (obj === -1) return arr;
        if (arr === -1) return obj;
        return Math.min(obj, arr);
    })();
    if (startIdx === -1) return null;

    const open = s[startIdx];
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = startIdx; i < s.length; i++) {
        const ch = s[i];
        if (escaped) { escaped = false; continue; }
        if (ch === '\\') { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === open) depth++;
        else if (ch === close) {
            depth--;
            if (depth === 0) return s.slice(startIdx, i + 1);
        }
    }
    return null;
};

export const parseAiJson = (rawContent, { componentId } = {}) => {
    if (!rawContent || typeof rawContent !== 'string') {
        throw new AiJsonParseError("Le contenu brut est vide ou n'est pas une chaîne.", { componentId });
    }

    // 1. Parse direct
    try {
        return JSON.parse(rawContent);
    } catch (err1) {}

    // 2. Nettoyage Markdown
    const stripped = stripMarkdownFences(rawContent);
    try {
        return JSON.parse(stripped);
    } catch (err2) {}

    // 3. Extraction du premier bloc équilibré
    const extracted = extractBalancedJson(stripped);
    if (extracted) {
        try {
            return JSON.parse(extracted);
        } catch (err3) {
            throw new AiJsonParseError("Extraction de bloc équilibré réussie mais contenu JSON invalide.", {
                componentId,
                snippet: safeSnippet(extracted),
                cause: err3
            });
        }
    }

    // 4. Échec définitif fail-loud
    throw new AiJsonParseError("Impossible de parser la réponse LLM en JSON.", {
        componentId,
        snippet: safeSnippet(rawContent)
    });
};
