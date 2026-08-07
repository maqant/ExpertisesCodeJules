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
 * @returns {object|null} contact normalisé, ou null si pas d'e-mail ou nom
 */
const toContact = (raw, origin) => {
  const email = normalizeEmail(raw?.email);

  let nom = (raw?.nom ?? '').trim();
  let prenom = (raw?.prenom ?? '').trim();
  
  if (nom && !prenom && nom.includes(' ')) {
      const parsed = parseFullName(nom);
      nom = parsed.lastName;
      prenom = parsed.firstName;
  }

  const fullName = [prenom, nom].filter(Boolean).join(' ').trim();
  if (!fullName && !email) return null;

  return {
    id: raw?.id ?? `${origin}-${fullName || email}`,
    origin,
    email: email || '',
    hasEmail: Boolean(email),
    nom,
    prenom,
    iban: raw?.iban || '',
    civility: resolveCivility(raw),
    displayName: fullName || email,
    raw,
  };
};

/**
 * Agrège occupants + intervenants en une liste de contacts uniques (par e-mail ou nom),
 * ne conservant que ceux possédant une adresse valide ou un nom.
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

  // Déduplication par e-mail ou nom
  const seen = new Set();
  return all.filter((c) => {
    const normName = c.displayName.toLowerCase().replace(/\s+/g, ' ').trim();
    const key = c.email ? `email:${c.email}` : `name:${normName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const normalizeIban = (raw) => {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/\s/g, '').toUpperCase();
  return cleaned.length >= 14 ? cleaned : null;
};

export const formatIbanDisplay = (iban) => {
  const norm = normalizeIban(iban);
  if (!norm) return iban || '';
  return norm.replace(/(.{4})/g, '$1 ').trim();
};

export const isValidIbanFormat = (iban) => {
  const norm = normalizeIban(iban);
  if (!norm) return false;
  return /^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(norm);
};

export function buildIbanCandidates({ occupants = [], intervenants = [], documentCandidates = [], documentIbans = [], localContacts = [] } = {}) {
  const candidates = [];
  const seenNorm = new Set();

  const addIban = (rawIban, provenance, holderName, sourceKind) => {
    if (!rawIban || typeof rawIban !== 'string') return;
    const norm = normalizeIban(rawIban);
    if (!norm || seenNorm.has(norm)) return;
    seenNorm.add(norm);

    candidates.push({
      iban: rawIban.replace(/\s/g, '').toUpperCase(),
      ibanDisplay: formatIbanDisplay(rawIban),
      isValidFormat: isValidIbanFormat(rawIban),
      provenance,
      holderName: holderName || null,
      sourceKind
    });
  };

  (occupants || []).forEach(o => {
    if (o?.iban) {
      const name = [o.prenom, o.nom].filter(Boolean).join(' ') || o.nom || 'Occupant';
      addIban(o.iban, `Dossier : ${name}`, name, 'dossier');
    }
  });

  (intervenants || []).forEach(i => {
    if (i?.iban) {
      const name = i.nom || i.name || 'Intervenant';
      addIban(i.iban, `Dossier : ${name}`, name, 'dossier');
    }
  });

  (localContacts || []).forEach(c => {
    if (c?.iban) {
      const name = c.displayName || 'Contact session';
      addIban(c.iban, `Session : ${name}`, name, 'local');
    }
  });

  (documentCandidates || []).forEach(d => {
    if (d?.iban) {
      const name = d.displayName || d.nom || null;
      const prov = `Doc : ${d.origin || 'Document'}${name ? ` — ${name}` : ' — Titulaire non déterminé'}`;
      addIban(d.iban, prov, name, 'document');
    }
  });

  (documentIbans || []).forEach(di => {
    const raw = typeof di === 'string' ? di : di?.iban;
    const name = typeof di === 'object' ? di?.holderName || null : null;
    const docLabel = typeof di === 'object' && di?.origin ? di.origin : 'Document';
    if (raw) {
      addIban(raw, `Doc : ${docLabel}${name ? ` — ${name}` : ' — Titulaire non déterminé'}`, name, 'document');
    }
  });

  return candidates;
}

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
export function buildAllCandidates({ occupants = [], intervenants = [], localContacts = [], documentCandidates = [] } = {}) {
    const cleanLocalContacts = (localContacts || []).filter(c => c != null && typeof c === 'object');
    const dossierCandidates = buildRecipientCandidates({ occupants, intervenants })
        .map(c => ({ ...c, kind: 'dossier', sourceCategory: 'Dossier actif' }));

    const docCandidates = (documentCandidates || []).map((c, i) => ({
        id: c.id || `doc-candidate-${i}`,
        displayName: c.displayName || c.nom || 'Candidat document',
        email: c.email || '',
        hasEmail: Boolean(c.email),
        iban: c.iban || '',
        kind: 'document',
        origin: c.origin || 'Document analysé',
        sourceCategory: 'Document analysé'
    }));

    const overriddenSourceIds = new Set(
        cleanLocalContacts.filter(c => c.origin === 'override' && c.sourceId).map(c => c.sourceId)
    );

    const visibleDossier = dossierCandidates.filter(c => !overriddenSourceIds.has(c.id));
    const visibleDocs = docCandidates.filter(c => !overriddenSourceIds.has(c.id));
    const locals = cleanLocalContacts.map(c => ({ ...c, kind: 'local', hasEmail: Boolean(c.email), sourceCategory: 'Session actuelle' }));

    return [...visibleDossier, ...visibleDocs, ...locals];
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
