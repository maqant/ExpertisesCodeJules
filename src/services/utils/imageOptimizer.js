/**
 * imageOptimizer.js
 * Optimisation client-side des images avant transmission aux agents Vision.
 * Redimensionne à MAX_DIMENSION px (côté long), encode en WebP q=0.82
 * avec fallback JPEG automatique (Safari < 17).
 * Zéro dépendance externe (Canvas HTML5 natif).
 */

const MAX_DIMENSION = 1280;
const QUALITY = 0.80;
const BYPASS_SIZE_BYTES = 300 * 1024; // 300 KB
const OPTIMIZABLE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/bmp', 'image/tiff'];

/**
 * Détermine si le fichier doit passer par l'optimiseur.
 */
export const isOptimizableImage = (file) => {
    if (!file || !file.type || !file.type.startsWith('image/')) return false;
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') return false;
    return OPTIMIZABLE_TYPES.includes(file.type) || file.type.startsWith('image/');
};

/**
 * Décode le fichier en bitmap avec correction EXIF (orientation).
 */
const decodeImage = async (file) => {
    try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch (e) {
        // Fallback (vieux navigateurs ou format non décodable par createImageBitmap)
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
            img.onerror = (err) => { URL.revokeObjectURL(url); reject(err); };
            img.src = url;
        });
    }
};

/**
 * Encode le canvas en JPEG (format pivot universel : pdf-lib, navigateurs, impression).
 * Décision architecturale : le gain WebP (~15%) ne justifie pas une chaîne de
 * transcodage aval. Le gain principal vient du redimensionnement 1280px.
 */
const encodeCanvas = (canvas) => {
    return new Promise((resolve, reject) => {
        canvas.toBlob((jpegBlob) => {
            if (jpegBlob && jpegBlob.type === 'image/jpeg') {
                resolve({ blob: jpegBlob, ext: '.jpg' });
            } else {
                reject(new Error('Encodage JPEG impossible sur ce navigateur'));
            }
        }, 'image/jpeg', QUALITY);
    });
};

/**
 * optimizeImage
 * @param {File} file - image originale
 * @returns {Promise<File>} - image optimisée (ou originale si bypass/échec)
 */
export const optimizeImage = async (file) => {
    if (!isOptimizableImage(file)) return file;

    try {
        const bitmap = await decodeImage(file);
        const { width, height } = bitmap;

        // Bypass : image déjà légère ET dans les dimensions cibles
        if (file.size <= BYPASS_SIZE_BYTES && Math.max(width, height) <= MAX_DIMENSION) {
            if (bitmap.close) bitmap.close();
            console.log(`[imageOptimizer] Bypass ${file.name || 'image'} (déjà optimale: ${(file.size / 1024).toFixed(0)} KB, ${width}x${height})`);
            return file;
        }

        // Calcul des dimensions cibles (ratio préservé)
        const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
        const targetW = Math.round(width * scale);
        const targetH = Math.round(height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0, targetW, targetH);
        if (bitmap.close) bitmap.close();

        const { blob, ext } = await encodeCanvas(canvas);
        if (!blob) throw new Error('Encodage canvas a retourné null');

        // Garde-fou : si l'optimisation grossit le fichier, garder l'original
        if (blob.size >= file.size) {
            console.log(`[imageOptimizer] Résultat plus lourd que l'original — conservation de ${file.name || 'image'}`);
            return file;
        }

        const originalName = file.name || 'image_optimisee.jpg';
        const newName = originalName.replace(/\.[^.]+$/, '') + ext;
        const optimizedFile = new File([blob], newName, { type: blob.type });

        console.log(
            `[imageOptimizer] ${originalName}: ${(file.size / 1024 / 1024).toFixed(2)} MB (${width}x${height}) → ` +
            `${(optimizedFile.size / 1024).toFixed(0)} KB (${targetW}x${targetH}, ${blob.type})`
        );
        return optimizedFile;

    } catch (e) {
        console.error(`[imageOptimizer] Échec optimisation ${file?.name || 'image'} — fichier original conservé.`, e);
        return file; // JAMAIS bloquer l'ingestion : dégradation gracieuse
    }
};
