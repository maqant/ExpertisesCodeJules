// src/services/utils/logSanitizer.js
// Assainissement des arguments de log avant injection dans le state UI.
// Règle d'architecture : aucun payload binaire/Base64 ne traverse la frontière logging → React.

const MAX_STRING_LENGTH = 500;      // par valeur string
const MAX_MESSAGE_LENGTH = 2000;    // plafond dur du message final
const MAX_DEPTH = 3;
const DATA_URL_REGEX = /data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]{50,}/gi;

const humanSize = (n) => n > 1048576 ? `${(n / 1048576).toFixed(1)} Mo` : `${Math.round(n / 1024)} Ko`;

const sanitizeString = (str) => {
    if (typeof str !== 'string') return String(str || '');
    // Remplacement sémantique des Data URLs (jamais de troncature muette).
    let clean = str.replace(DATA_URL_REGEX, (m) => {
        const mime = m.slice(5, m.indexOf(';'));
        return `[${mime} base64 ~${humanSize(m.length)}]`;
    });
    if (clean.length > MAX_STRING_LENGTH) {
        clean = `${clean.slice(0, MAX_STRING_LENGTH)}… [tronqué, ${humanSize(str.length)} au total]`;
    }
    return clean;
};

const sanitizeValue = (value, depth = 0) => {
    if (value == null) return value;
    if (typeof value === 'string') return sanitizeString(value);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (value instanceof Error) return `${value.name}: ${sanitizeString(value.message)}`;
    if (typeof File !== 'undefined' && value instanceof File)
        return `[File "${value.name}" ${humanSize(value.size)}]`;
    if (typeof Blob !== 'undefined' && value instanceof Blob)
        return `[Blob ${value.type || 'binaire'} ${humanSize(value.size)}]`;
    if (value instanceof ArrayBuffer || (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(value)))
        return `[Binaire ${humanSize(value.byteLength ?? value.length)}]`;
    if (depth >= MAX_DEPTH) return '[objet profond tronqué]';
    if (Array.isArray(value)) {
        const head = value.slice(0, 10).map(v => sanitizeValue(v, depth + 1));
        return value.length > 10 ? [...head, `… +${value.length - 10} éléments`] : head;
    }
    if (typeof value === 'object') {
        const out = {};
        for (const key of Object.keys(value).slice(0, 20)) {
            out[key] = sanitizeValue(value[key], depth + 1);
        }
        return out;
    }
    return String(value);
};

/**
 * Convertit une liste d'arguments console en un message sûr et borné.
 * Ne lève JAMAIS d'exception (contrat : le logging ne peut pas casser le pipeline).
 */
export const sanitizeLogArgs = (args) => {
    try {
        if (!Array.isArray(args)) return String(args || '');
        const parts = args.map(a => {
            const s = sanitizeValue(a);
            return typeof s === 'string' ? s : JSON.stringify(s);
        });
        const message = parts.join(' ');
        return message.length > MAX_MESSAGE_LENGTH
            ? `${message.slice(0, MAX_MESSAGE_LENGTH)}… [message tronqué]`
            : message;
    } catch {
        return '[log non sérialisable]';
    }
};
