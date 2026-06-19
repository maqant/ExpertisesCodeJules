// Source unique de l'identité de l'onglet courant.
// Un tabId par contexte de page (donc par onglet). Stable pendant toute la vie de la page.

function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    // Fallback robuste si randomUUID indisponible
    return 'tab-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

const TAB_ID = generateId();

/** @returns {string} Identifiant unique et stable de l'onglet courant. */
export function getTabId() {
    return TAB_ID;
}
