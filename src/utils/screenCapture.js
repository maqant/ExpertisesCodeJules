// src/utils/screenCapture.js
// Utilitaire pur de capture d'écran et de gestion du presse-papiers.

/**
 * Génère un fichier File virtuel à partir d'un texte brut.
 */
export const createRawTextFile = (rawText) => {
    if (!rawText || !rawText.trim()) return null;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `Note_Texte_${timestamp}.txt`;
    const blob = new Blob([rawText], { type: 'text/plain;charset=utf-8' });
    const file = new File([blob], fileName, { type: 'text/plain', lastModified: Date.now() });
    file.isRawText = true;
    return file;
};

/**
 * Effectue une capture d'écran via l'API Screen Capture du navigateur (getDisplayMedia).
 * Extrait une image fixe PNG sous forme d'objet File.
 */
export const captureScreenInteractive = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("L'API de capture d'écran n'est pas supportée par ce navigateur.");
    }

    let stream = null;
    try {
        stream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: 'browser' },
            audio: false
        });

        const track = stream.getVideoTracks()[0];
        let blob = null;

        if (typeof window.ImageCapture === 'function') {
            try {
                const imageCapture = new window.ImageCapture(track);
                const bitmap = await imageCapture.grabFrame();
                const canvas = document.createElement('canvas');
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(bitmap, 0, 0);
                blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            } catch (e) {
                console.warn('[screenCapture] ImageCapture fallback sur video element:', e);
            }
        }

        if (!blob) {
            const video = document.createElement('video');
            video.srcObject = stream;
            await video.play();
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 1280;
            canvas.height = video.videoHeight || 720;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0);
            blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const randomSuffix = Math.random().toString(36).slice(2, 7);
        const file = new File([blob], `Capture_Ecran_${timestamp}_${randomSuffix}.png`, { type: 'image/png', lastModified: Date.now() });
        file.isCapture = true;
        return file;
    } finally {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    }
};

/**
 * Génère un suffixe unique pour éviter toute collision de nom
 * lors de collages multiples dans la même seconde.
 */
const uniqueSuffix = (index) =>
    `${index + 1}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

/**
 * Extrait les fichiers images contenus dans un ClipboardEvent (paste).
 * Garantit l'unicité des noms même pour N images collées simultanément.
 */
export const extractImagesFromClipboardEvent = (e) => {
    const items = e.clipboardData?.items;
    const imageFiles = [];

    if (items) {
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                    const ext = item.type.split('/')[1] || 'png';
                    const fileName = `Capture_Collee_${timestamp}_${uniqueSuffix(i)}.${ext}`;
                    // new File([file], ...) clone le contenu et détache le blob pointer éphémère.
                    const newFile = new File([file], fileName, { type: item.type, lastModified: Date.now() });
                    newFile.isCapture = true;
                    imageFiles.push(newFile);
                }
            }
        }
    }

    // Fallback Firefox : certaines versions exposent les images via clipboardData.files.
    if (imageFiles.length === 0 && e.clipboardData?.files?.length) {
        const files = e.clipboardData.files;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.type && file.type.startsWith('image/')) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const ext = file.type.split('/')[1] || 'png';
                const newFile = new File([file], `Capture_Collee_${timestamp}_${uniqueSuffix(i)}.${ext}`, {
                    type: file.type, lastModified: Date.now()
                });
                newFile.isCapture = true;
                imageFiles.push(newFile);
            }
        }
    }

    return imageFiles;
};
