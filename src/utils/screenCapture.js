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
        const file = new File([blob], `Capture_Ecran_${timestamp}.png`, { type: 'image/png', lastModified: Date.now() });
        file.isCapture = true;
        return file;
    } finally {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    }
};

/**
 * Extrait les fichiers images contenus dans un ClipboardEvent (paste).
 */
export const extractImagesFromClipboardEvent = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return [];
    
    const imageFiles = [];
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type && item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const ext = item.type.split('/')[1] || 'png';
                const newFile = new File([file], `Capture_Collee_${timestamp}.${ext}`, { type: item.type, lastModified: Date.now() });
                newFile.isCapture = true;
                imageFiles.push(newFile);
            }
        }
    }
    return imageFiles;
};
