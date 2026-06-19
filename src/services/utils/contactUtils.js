// src/services/utils/contactUtils.js

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalise une adresse e-mail (trim + lowercase). Retourne null si invalide.
 * @param {string|undefined} raw
 * @returns {string|null}
 */
export const normalizeEmail = (raw) => {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().toLowerCase();
  return EMAIL_REGEX.test(cleaned) ? cleaned : null;
};

/**
 * Détermine la civilité d'affichage à partir du champ statut/civilité.
 * Robuste : fallback neutre si inconnu.
 * @param {object} party
 * @returns {string} ex: "Madame", "Monsieur", "" (neutre)
 */
const resolveCivility = (party) => {
  const source = `${party?.civilite ?? ''} ${party?.statut ?? ''}`.toLowerCase();
  if (/(madame|mme|f[ée]minin|^f$)/.test(source)) return 'Madame';
  if (/(monsieur|mr|m\.|masculin|^m$)/.test(source)) return 'Monsieur';
  return ''; // neutre maîtrisé, jamais d'invention
};

/**
 * Construit une partie normalisée à partir d'un objet occupant OU intervenant.
 * @param {object} raw
 * @param {string} origin - 'occupant' | 'intervenant'
 * @returns {object|null} contact normalisé, ou null si pas d'e-mail valide
 */
const toContact = (raw, origin) => {
  const email = normalizeEmail(raw?.email);
  if (!email) return null;

  const nom = (raw?.nom ?? '').trim();
  const prenom = (raw?.prenom ?? '').trim();
  const fullName = [prenom, nom].filter(Boolean).join(' ').trim();

  return {
    id: raw?.id ?? `${origin}-${email}`,
    origin,
    email,
    nom,
    prenom,
    civility: resolveCivility(raw),
    displayName: fullName || email,
    raw,
  };
};

/**
 * Agrège occupants + intervenants en une liste de contacts uniques (par e-mail),
 * ne conservant que ceux possédant une adresse valide.
 * @param {object} params
 * @param {Array} [params.occupants]
 * @param {Array} [params.intervenants]
 * @returns {Array<object>} contacts dédupliqués
 */
export const buildRecipientCandidates = ({ occupants = [], intervenants = [] }) => {
  const safeOccupants = Array.isArray(occupants) ? occupants : [];
  const safeIntervenants = Array.isArray(intervenants) ? intervenants : [];

  const all = [
    ...safeOccupants.map((o) => toContact(o, 'occupant')),
    ...safeIntervenants.map((i) => toContact(i, 'intervenant')),
  ].filter(Boolean);

  // Déduplication par e-mail (premier rencontré gagne)
  const seen = new Set();
  return all.filter((c) => {
    if (seen.has(c.email)) return false;
    seen.add(c.email);
    return true;
  });
};

/**
 * Concatène les e-mails pour Outlook (séparés par "; ").
 * @param {Array<object>} contacts - contacts déjà normalisés
 * @returns {string} ex: "a@x.fr; b@y.fr"
 */
export const extractEmailsForOutlook = (contacts = []) => {
  const emails = (Array.isArray(contacts) ? contacts : [])
    .map((c) => c?.email)
    .filter(Boolean);
  return [...new Set(emails)].join('; ');
};

/**
 * SOURCE DE VÉRITÉ de la salutation. Générée par CODE, jamais par l'IA.
 * Règle métier : "Bonjour Madame X, Bonjour Monsieur Y,"
 * - Si pas de civilité connue : "Bonjour Prénom Nom,"
 * - Si aucun destinataire : "Bonjour," (fallback sûr)
 * @param {Array<object>} contacts
 * @returns {string}
 */
export const buildSalutation = (contacts = []) => {
  const list = Array.isArray(contacts) ? contacts : [];
  if (list.length === 0) return 'Bonjour,';

  const parts = list.map((c) => {
    if (c.civility) {
      // "Madame Dupont" — on privilégie le nom de famille pour le formalisme
      const last = c.nom || c.displayName;
      return `${c.civility} ${last}`.trim();
    }
    return c.displayName; // fallback neutre maîtrisé
  });

  return `Bonjour ${parts.join(', ')},`;
};
