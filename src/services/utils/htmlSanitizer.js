// v8.0.0 - HTML Sanitizer
// Sécurise tout HTML issu de l'IA avant rendu (dangerouslySetInnerHTML).
// Whitelist stricte : on n'autorise QUE le formatage d'email simple.

const ALLOWED_TAGS = new Set([
    'b', 'strong', 'i', 'em', 'u', 'br', 'p', 'div', 'span',
    'ul', 'ol', 'li', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
]);

const ALLOWED_ATTRS = new Set(['href', 'style', 'border', 'cellpadding', 'cellspacing', 'colspan', 'rowspan']);

// style autorisé : uniquement quelques propriétés inoffensives (mise en forme mail)
const ALLOWED_STYLE_PROPS = new Set([
    'font-weight', 'font-style', 'text-decoration', 'color', 'background-color',
    'text-align', 'margin', 'padding', 'border-collapse', 'width'
]);

/**
 * Nettoie les artefacts markdown que l'IA peut ajouter (```html ... ```).
 */
export const cleanAiHtml = (raw) => {
    if (!raw || typeof raw !== 'string') return '';
    return raw
        .replace(/^```html\s*/i, '')
        .replace(/^```\s*/, '')
        .replace(/```\s*$/, '')
        .trim();
};

/**
 * Sanitize via le parseur DOM natif (pas de dépendance externe).
 * Supprime scripts, handlers on*, attributs/balises non whitelistés.
 * @param {string} dirty - HTML potentiellement dangereux
 * @returns {string} HTML sûr
 */
export const sanitizeHtml = (dirty) => {
    const cleaned = cleanAiHtml(dirty);
    if (!cleaned) return '';

    let doc;
    try {
        doc = new DOMParser().parseFromString(`<div id="__root__">${cleaned}</div>`, 'text/html');
    } catch {
        // Fallback ultra-défensif : on échappe tout
        return cleaned.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const root = doc.getElementById('__root__');
    if (!root) return '';

    const sanitizeNode = (node) => {
        // Parcours des enfants en copie (la liste change pendant la suppression)
        Array.from(node.childNodes).forEach((child) => {
            if (child.nodeType === Node.ELEMENT_NODE) {
                const tag = child.tagName.toLowerCase();
                if (!ALLOWED_TAGS.has(tag)) {
                    // Balise interdite : on garde le texte, on supprime la balise
                    const text = doc.createTextNode(child.textContent || '');
                    child.replaceWith(text);
                    return;
                }
                // Nettoyage des attributs
                Array.from(child.attributes).forEach((attr) => {
                    const name = attr.name.toLowerCase();
                    if (!ALLOWED_ATTRS.has(name) || name.startsWith('on')) {
                        child.removeAttribute(attr.name);
                        return;
                    }
                    if (name === 'href') {
                        const val = attr.value.trim().toLowerCase();
                        if (val.startsWith('javascript:') || val.startsWith('data:')) {
                            child.removeAttribute('href');
                        }
                    }
                    if (name === 'style') {
                        const safe = attr.value
                            .split(';')
                            .map(s => s.trim())
                            .filter(Boolean)
                            .filter(s => {
                                const prop = s.split(':')[0]?.trim().toLowerCase();
                                return ALLOWED_STYLE_PROPS.has(prop);
                            })
                            .join('; ');
                        if (safe) child.setAttribute('style', safe);
                        else child.removeAttribute('style');
                    }
                });
                sanitizeNode(child);
            } else if (child.nodeType !== Node.TEXT_NODE) {
                // Commentaires, etc. : on supprime
                child.remove();
            }
        });
    };

    sanitizeNode(root);
    return root.innerHTML;
};
