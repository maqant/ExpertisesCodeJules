import { useEffect, useRef, useState } from 'react';

/**
 * Gère le cycle de vie d'un Blob URL lié à un fichier.
 * - Crée l'URL une seule fois par instance de fichier.
 * - Révoque automatiquement au changement de fichier ou au démontage.
 * - Aucune fuite mémoire, aucun revoke prématuré pendant l'usage du composant.
 *
 * @param {File|Blob|null|undefined} file
 * @returns {string|null} objectUrl utilisable, ou null si pas de fichier
 */
export function useObjectUrl(file) {
    const [url, setUrl] = useState(null);
    const currentUrlRef = useRef(null);

    useEffect(() => {
        if (!file) {
            setUrl(null);
            return undefined;
        }
        const objectUrl = URL.createObjectURL(file);
        currentUrlRef.current = objectUrl;
        setUrl(objectUrl);

        return () => {
            URL.revokeObjectURL(objectUrl);
            if (currentUrlRef.current === objectUrl) {
                currentUrlRef.current = null;
            }
        };
    }, [file]);

    return url;
}

/**
 * Ouvre un Blob URL dans un nouvel onglet via une ancre programmatique.
 * DOIT être appelé de façon SYNCHRONE dans un gestionnaire d'événement
 * utilisateur (clic) : la navigation par ancre dans un geste utilisateur
 * n'est pas soumise au popup blocker, contrairement à window.open.
 *
 * @param {string} url - Blob URL valide (non révoqué)
 * @throws {Error} si l'URL est absente
 */
export function openObjectUrlInNewTab(url) {
    if (!url) {
        throw new Error('[useObjectUrl] Ouverture impossible : Blob URL absent ou révoqué.');
    }
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
}
