/**
 * Configuration métier des fragments de template "AR Simple".
 *
 * SOURCE UNIQUE DE VÉRITÉ pour :
 *  - les libellés affichés dans la modale (checkbox labels)
 *  - le texte HTML réellement injecté dans l'email généré
 *
 * Objectif : empêcher toute divergence label/contenu (erreur silencieuse).
 * Toute évolution des formulations métier se fait ICI uniquement.
 */

export const AR_FRAGMENT_TRANSMISSION = {
  key: 'transmission',
  label: 'que nous avons transmis à la compagnie.',
  buildHtml: () =>
    `<p>Votre dossier a bien été transmis à la compagnie.</p>`,
};

export const AR_FRAGMENT_ATTENTE = {
  key: 'attente',
  label: 'Attente des éléments mentionnés par le déclarant.',
  buildHtml: ({ delai = '' } = {}) =>
    `<p>Dans l'attente des éléments mentionnés par le déclarant` +
    (delai ? ` (souhaités pour <strong>${delai}</strong>)` : '') +
    `, nous restons à votre disposition.</p>`,
};

export const AR_OPTIONAL_FRAGMENTS = [
  AR_FRAGMENT_TRANSMISSION,
  AR_FRAGMENT_ATTENTE,
];

export const AR_DEFAULT_SALUTATION = 'Bonjour,';
export const AR_SIGNATURE_HTML = `<p>Bien cordialement,</p>\n<p><strong>Bureau Péchard</strong></p>`;
