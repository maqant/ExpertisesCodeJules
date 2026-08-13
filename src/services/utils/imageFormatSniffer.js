/**
 * imageFormatSniffer.js
 * Détection du format réel d'un binaire par magic bytes.
 * NE JAMAIS faire confiance à l'extension ni au MIME déclaré.
 */
export const IMAGE_FORMATS = {
    JPEG: { mime: 'image/jpeg', ext: '.jpg' },
    PNG:  { mime: 'image/png',  ext: '.png' },
    WEBP: { mime: 'image/webp', ext: '.webp' },
    PDF:  { mime: 'application/pdf', ext: '.pdf' },
    UNKNOWN: { mime: 'application/octet-stream', ext: '' },
};

export function sniffFormat(bytes) {
    if (!bytes) return IMAGE_FORMATS.UNKNOWN;
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (b.length < 12) return IMAGE_FORMATS.UNKNOWN;
    if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return IMAGE_FORMATS.JPEG;
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return IMAGE_FORMATS.PNG;
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return IMAGE_FORMATS.WEBP;
    if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return IMAGE_FORMATS.PDF;
    return IMAGE_FORMATS.UNKNOWN;
}

/** Déduction MIME par extension de nom (fallback si bytes indisponibles). */
export function mimeFromName(name = '') {
    const ext = name.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
    return {
        '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
        '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf',
    }[ext] || null;
}
