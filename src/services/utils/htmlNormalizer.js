/**
 * Garantit l'invariant : draftEmail.html ne contient jamais de Markdown.
 * Défense en profondeur contre les dérapages du LLM.
 */

const MARKDOWN_PATTERNS = [
  /\*\*[^*]+\*\*/, // gras
  /__[^_]+__/,     // gras alt
  /^#{1,6}\s/m,    // titres
  /^[-*]\s/m,      // listes
];

export function isMarkdownPresent(raw) {
  if (typeof raw !== 'string') return false;
  return MARKDOWN_PATTERNS.some((re) => re.test(raw));
}

/**
 * Convertit le Markdown résiduel en HTML et nettoie.
 * Idempotent : appliquer plusieurs fois ne casse rien.
 */
export function normalizeToHtml(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return '';

  let html = raw;

  // Gras Markdown -> <strong> (uniquement si pas déjà du HTML strong)
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');

  // Titres Markdown -> <strong> (on évite <h1> dans un email)
  html = html.replace(/^#{1,6}\s*(.+)$/gm, '<strong>$1</strong>');

  // Sauts de ligne hors balises bloc -> <br>
  // (heuristique prudente : seulement si aucun <p>/<br> déjà présent)
  if (!/<\s*(p|br|div)\b/i.test(html)) {
    html = html.replace(/\n/g, '<br>');
  }

  return html.trim();
}

/**
 * Construit un objet draftEmail normalisé.
 */
export function makeDraft(rawHtml, origin, lastModifiedBy) {
  const html = normalizeToHtml(rawHtml);
  return {
    html,
    origin,
    isHtmlClean: !isMarkdownPresent(html),
    lastModifiedBy,
  };
}
