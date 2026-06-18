// v8.0.0 - Clipboard Utils
// Extraction de la logique sécurisée de copie avec fallback depuis GeneratedDocModal.jsx

/**
 * Copie un contenu HTML et son équivalent texte brut dans le presse-papier.
 * 
 * @param {HTMLElement} contentElement - L'élément DOM contenant le HTML à copier.
 * @returns {Promise<boolean>} true si copié avec succès, false sinon
 */
export const copyHtmlToClipboard = async (contentElement) => {
    if (!contentElement) return false;

    try {
        const html = contentElement.innerHTML;
        const text = contentElement.innerText;

        const htmlBlob = new Blob([html], { type: 'text/html' });
        const textBlob = new Blob([text], { type: 'text/plain' });

        const clipboardItem = new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': textBlob
        });

        await navigator.clipboard.write([clipboardItem]);
        return true;
    } catch (err) {
        console.warn("ClipboardItem non supporté, utilisation du fallback texte brut.", err);
        // Fallback pour les navigateurs sans clipboard API avancée
        try {
            const textarea = document.createElement('textarea');
            textarea.value = contentElement.innerText;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            return true;
        } catch (fallbackErr) {
            console.error("Échec du fallback de copie", fallbackErr);
            return false;
        }
    }
};
