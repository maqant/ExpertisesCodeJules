import {
  AR_FRAGMENT_TRANSMISSION,
  AR_FRAGMENT_ATTENTE,
  AR_DEFAULT_SALUTATION,
  AR_SIGNATURE_HTML,
} from '../../config/arTemplates';

/**
 * Génère le HTML de l'AR Simple à partir de la configuration métier centralisée.
 * Fonction pure (testable). Aucun texte métier en dur ici : tout vient de arTemplates.
 */
export function buildSimpleAr({
  dossier = {},
  withTransmission = false,
  withAttente = false,
  attenteDelai = '',
  salutation = AR_DEFAULT_SALUTATION,
} = {}) {
  const dateSinistre = dossier?.formData?.dateSinistre
    ? escapeText(dossier.formData.dateSinistre)
    : '';
  const adresse = dossier?.formData?.adresse
    ? escapeText(dossier.formData.adresse)
    : '';

  const parts = [];

  // Salutation (toujours présente)
  parts.push(`<p>${escapeText(salutation)}</p>`);

  // Base (toujours présente)
  let baseText = `<p>Nous accusons réception de votre déclaration de sinistre`;
  if (dateSinistre) baseText += ` survenu le <strong>${dateSinistre}</strong>`;
  if (adresse) baseText += ` au <strong>${adresse}</strong>`;
  baseText += `.</p>`;
  parts.push(baseText);

  // Sous-cases conditionnelles — texte issu de la config métier (source unique)
  if (withTransmission) {
    parts.push(AR_FRAGMENT_TRANSMISSION.buildHtml());
  }

  if (withAttente) {
    parts.push(AR_FRAGMENT_ATTENTE.buildHtml({ delai: escapeText(attenteDelai) }));
  }

  // Signature (toujours présente)
  parts.push(AR_SIGNATURE_HTML);

  return parts.join('\n');
}

function escapeText(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
