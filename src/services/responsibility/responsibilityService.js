// src/services/responsibility/responsibilityService.js
// Service pur et isolé : logique de responsabilité de sinistre.
// AUCUNE dépendance React/store. Testable unitairement.
// Sépare : sélection des responsables / formatage de phrase CRE / cohérence franchise.

/**
 * Formate le nom complet d'un occupant de façon robuste.
 * @param {object} occ - occupant { nom, prenom, statut, etage }
 * @returns {string}
 */
export function formatPartyName(occ) {
  if (!occ) return '[Partie inconnue]';
  const nom = (occ.nom || '').trim();
  const prenom = (occ.prenom || '').trim();
  const full = `${prenom} ${nom}`.trim();
  return full || '[Partie sans nom]';
}

/**
 * Retourne la liste enrichie des occupants responsables.
 * @param {Array} occupants - pii.occupants
 * @param {Array<string>} responsablesIds - metier.responsablesIds
 * @returns {Array<object>} occupants responsables (filtrés, jamais null)
 */
export function getResponsibleParties(occupants = [], responsablesIds = []) {
  if (!Array.isArray(occupants) || !Array.isArray(responsablesIds)) return [];
  const idSet = new Set(responsablesIds.filter(Boolean));
  return occupants.filter((o) => o && idSet.has(o.id));
}

/**
 * Joint une liste de noms : "A", "A et B", "A, B et C".
 * @param {Array<string>} names
 * @returns {string}
 */
export function joinNames(names = []) {
  const clean = names.filter(Boolean);
  if (clean.length === 0) return '';
  if (clean.length === 1) return clean[0];
  return `${clean.slice(0, -1).join(', ')} et ${clean[clean.length - 1]}`;
}

/**
 * Génère la phrase CRE "pendant le durant" liant responsable(s) et franchise.
 * Fonction PURE, sans accès store. Code défensif sur données manquantes.
 *
 * @param {object} params
 * @param {Array} params.occupants - pii.occupants
 * @param {Array<string>} params.responsablesIds - metier.responsablesIds
 * @param {number|string|null} params.franchiseMontant - montant (ex: 250, "250€")
 * @returns {string} phrase préremplie (jamais null/undefined)
 */
export function buildFranchiseResponsibilitySentence({
  occupants = [],
  responsablesIds = [],
  franchiseMontant = null,
}) {
  const responsables = getResponsibleParties(occupants, responsablesIds);

  // Cas 1 : aucun responsable désigné
  if (responsables.length === 0) {
    return '';
  }

  const noms = joinNames(responsables.map(formatPartyName));

  // Formatage défensif du montant.
  let montantStr = '[Non défini]';
  if (franchiseMontant !== null && franchiseMontant !== undefined && franchiseMontant !== '') {
    // Nettoyage basique pour affichage (au cas où ce soit un string avec le symbole €)
    montantStr = String(franchiseMontant).replace(/€/g, '').trim();
    if (!isNaN(parseFloat(montantStr))) {
        montantStr = parseFloat(montantStr).toFixed(2).replace('.', ',');
    }
  }

  return `La responsabilité incombant à ${noms}, la franchise d'un montant de ${montantStr} € est applicable.`;
}
