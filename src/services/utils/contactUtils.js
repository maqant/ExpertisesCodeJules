// src/services/utils/contactUtils.js
import { genId } from '../../domain/decompteSplitter/allocationModel.js';
import { formatPersonName } from './formatUtils.js';
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
 * Découpe une chaîne brute ("Dominique Jordan", "Jean-Pierre De La Tour")
 * en { firstName, lastName }. Heuristique déterministe SANS deviner le genre.
 * Règle: dernier token = nom de famille (les particules nl/de/van sont rattachées au nom de famille).
 */
export const parseFullName = (rawName) => {
  if (typeof rawName !== 'string') return { firstName: '', lastName: '' };
  const tokens = rawName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { firstName: '', lastName: '' };
  if (tokens.length === 1) return { firstName: '', lastName: tokens[0] };

  const PARTICLES = new Set(['de', 'du', 'des', 'van', 'von', 'le', 'la', 'el', "d'", 'da', 'di']);
  let i = tokens.length - 1;
  const lastParts = [tokens[i]];
  i -= 1;
  while (i >= 0 && PARTICLES.has(tokens[i].toLowerCase().replace(/'$/, "'"))) {
    lastParts.unshift(tokens[i]);
    i -= 1;
  }
  const lastName = lastParts.join(' ');
  const firstName = tokens.slice(0, i + 1).join(' ');
  return { firstName, lastName };
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

  let nom = (raw?.nom ?? '').trim();
  let prenom = (raw?.prenom ?? '').trim();
  
  if (nom && !prenom && nom.includes(' ')) {
      const parsed = parseFullName(nom);
      nom = parsed.lastName;
      prenom = parsed.firstName;
  }

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
    const rawLastName = c?.nom || c?.displayName || '';
    const lastName = typeof rawLastName === 'string' && rawLastName.includes(' ')
      ? (parseFullName(rawLastName)?.lastName || rawLastName)
      : rawLastName;

    // Cas 1 : civilité connue → "Monsieur Mosca"
    if (c?.civility && lastName) {
      return `${c.civility} ${formatPersonName(lastName)}`.trim();
    }

    // Cas 2 : pas de civilité → nom complet formaté "Iman Abd el Alim…"
    const fullName = (c?.displayName || c?.nom || '').trim();
    if (fullName && fullName !== c?.email) {
      return formatPersonName(fullName);
    }

    // Cas 3 : rien d'exploitable (ou nom == email) → vide, filtré ensuite
    return '';
  });

  const validParts = parts.filter(Boolean);
  if (validParts.length === 0) return 'Bonjour,';

  return `Bonjour ${validParts.join(', ')},`;
};

/** Validation stricte — bloquante avant tout décaissement. */
export function validateContactDraft(draft) {
    const errors = {};
    const name = (draft?.displayName ?? '').trim();
    const email = (draft?.email ?? '').trim();

    if (name.length < 2) errors.displayName = 'Nom requis (min. 2 caractères).';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email = 'Format e-mail invalide.';
    }
    if (draft?.iban && !/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(draft.iban.replace(/\s/g, ''))) {
        errors.iban = 'IBAN invalide.';
    }
    return { isValid: Object.keys(errors).length === 0, errors };
}

/** @returns {object} */
export function createLocalContact(draft, { fromSourceId = null } = {}) {
    return {
        id: `local:${genId()}`,
        displayName: (draft.displayName ?? '').trim(),
        email: (draft.email ?? '').trim(),
        iban: (draft.iban ?? '').trim() || undefined,
        origin: fromSourceId ? 'override' : 'custom',
        sourceId: fromSourceId,
    };
}

/**
 * Fusionne les candidats du dossier avec les contacts locaux du splitter.
 * Les overrides "masquent" leur source pour éviter les doublons visuels.
 */
export function buildAllCandidates({ occupants = [], intervenants = [], localContacts = [] } = {}) {
    const dossierCandidates = buildRecipientCandidates({ occupants, intervenants })
        .map(c => ({ ...c, kind: 'dossier' }));

    const overriddenSourceIds = new Set(
        localContacts.filter(c => c.origin === 'override' && c.sourceId).map(c => c.sourceId)
    );

    const visibleDossier = dossierCandidates.filter(c => !overriddenSourceIds.has(c.id));
    const locals = localContacts.map(c => ({ ...c, kind: 'local' }));

    return [...visibleDossier, ...locals];
}

/** Résout une RecipientRef en snapshot figé (appelé à la génération rapport). */
export function resolveRecipientSnapshot(ref, allCandidates) {
    if (!ref) return null;
    const found = allCandidates.find(c => c.kind === ref.kind && c.id === ref.id);
    if (!found) return null;
    return {
        displayName: found.displayName,
        email: found.email ?? '',
        iban: found.iban,
        origin: found.origin,
        resolvedAt: new Date().toISOString(),
    };
}

/**
 * Formate un occupant pour l'affichage dans les listes déroulantes,
 * en incluant l'étage et le statut si disponibles.
 * @param {object} o L'objet occupant
 * @returns {string} Le label formaté (ex: "7e - Jean Dupont (Locataire)")
 */
export const formatOccupantLabel = (o) => {
    if (!o) return 'Sans nom';
    const fullName = `${o.nom || ''} ${o.prenom || ''}`.trim() || 'Sans nom';
    let label = fullName;
    if (o.statut && o.statut.trim() !== '') {
        label = `${label} (${o.statut.trim()})`;
    }
    if (o.etage && o.etage.trim() !== '') {
        label = `${o.etage.trim()} - ${label}`;
    }
    return label;
};
