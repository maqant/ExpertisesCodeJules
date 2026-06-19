/**
 * Génère un AR Simple en HTML pur, sans LLM.
 * Déterministe, testable, traçable.
 *
 * @param {Object} opts
 * @param {Object} opts.dossier          - données sinistre (sécurisées en lecture)
 * @param {boolean} opts.withTransmission
 * @param {boolean} opts.withAttente
 * @param {string}  [opts.attenteDelai]  - ex: "vendredi", "sous 8 jours"
 * @param {string}  [opts.salutation]
 * @returns {string} HTML propre
 */
export function buildSimpleAr({
  dossier = {},
  withTransmission = false,
  withAttente = false,
  attenteDelai = '',
  salutation = 'Bonjour,'
} = {}) {
  // Sécurité : valeurs par défaut explicites, jamais undefined dans le rendu
  // const reference = escapeText(dossier?.reference ?? '');
  // Pour Bureau Péchard, la référence est souvent formData.numPolice ou formData.numSinistreCie
  // Mais ici, l'accusé de réception est adressé à l'assuré pour accuser réception de la déclaration.
  // On n'a pas forcément besoin de la référence dans le template de base.
  
  const dateSinistre = dossier?.formData?.dateSinistre ? escapeText(dossier.formData.dateSinistre) : '';
  const adresse = dossier?.formData?.adresse ? escapeText(dossier.formData.adresse) : '';

  const parts = [];

  // Base (toujours présente)
  parts.push(`<p>${escapeText(salutation)}</p>`);

  let baseText = `<p>Nous accusons réception de votre déclaration de sinistre`;
  if (dateSinistre) baseText += ` survenu le <strong>${dateSinistre}</strong>`;
  if (adresse) baseText += ` au <strong>${adresse}</strong>`;
  baseText += `.</p>`;
  
  parts.push(baseText);

  if (withTransmission) {
    parts.push(
      `<p>Votre dossier a bien été transmis à notre service en charge de l'expertise.</p>`
    );
  }

  if (withAttente) {
    const delai = escapeText(attenteDelai);
    parts.push(
      `<p>Dans l'attente des éléments nécessaires` +
        (delai ? ` (souhaités pour <strong>${delai}</strong>)` : '') +
        `, nous restons à votre disposition.</p>`
    );
  }

  parts.push(
    `<p>Bien cordialement,</p>`,
    `<p><strong>Bureau Péchard</strong></p>`
  );

  return parts.join('\n');
}

/** Échappement minimal anti-injection (les données dossier ne sont pas du HTML). */
function escapeText(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
