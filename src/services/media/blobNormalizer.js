/**
 * Normalisation canonique vers Blob.
 * Contrat unique pour toute l'application : toute donnée binaire lue depuis
 * le stockage local (localforage) DOIT passer par ce module avant usage.
 *
 * localforage peut retourner, selon le navigateur et le driver (IndexedDB,
 * WebSQL, localStorage) : Blob, File, ArrayBuffer, Uint8Array.
 */

const MAGIC_BYTES = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offsetCheck: { at: 8, bytes: [0x57, 0x45, 0x42, 0x50] } },
];

export class BlobNormalizationError extends Error {
  constructor(message, { receivedType } = {}) {
    super(message);
    this.name = 'BlobNormalizationError';
    this.receivedType = receivedType;
  }
}

/**
 * Détecte le MIME type par magic bytes (fiable, contrairement à l'extension).
 * @param {Uint8Array} bytes
 * @returns {string} MIME type détecté, ou 'application/octet-stream'
 */
export const sniffMimeType = (bytes) => {
  for (const sig of MAGIC_BYTES) {
    const headerMatches = sig.bytes.every((b, i) => bytes[i] === b);
    if (!headerMatches) continue;
    if (sig.offsetCheck) {
      const { at, bytes: extra } = sig.offsetCheck;
      if (!extra.every((b, i) => bytes[at + i] === b)) continue;
    }
    return sig.mime;
  }
  return 'application/octet-stream';
};

/**
 * Normalise toute donnée binaire en Blob typé.
 * @param {Blob|File|ArrayBuffer|Uint8Array|null|undefined} data
 * @param {{ mimeHint?: string }} [options] MIME connu (ex: stocké en métadonnée)
 * @returns {Blob|null} null si data est null/undefined (absence légitime)
 * @throws {BlobNormalizationError} si le type est irrécupérable
 */
export const normalizeToBlob = (data, { mimeHint } = {}) => {
  if (data == null) return null;

  // Déjà conforme au contrat (File hérite de Blob)
  if (data instanceof Blob) return data;

  let bytes;
  if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else if (ArrayBuffer.isView(data)) {
    bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  } else {
    throw new BlobNormalizationError(
      `Type binaire non normalisable : ${Object.prototype.toString.call(data)}`,
      { receivedType: typeof data },
    );
  }

  const type = mimeHint || sniffMimeType(bytes);
  return new Blob([bytes], { type });
};
