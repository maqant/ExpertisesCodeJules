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

export const CIVILITY = {
    MADAME: 'Madame',
    MONSIEUR: 'Monsieur',
    ACP: 'ACP',
    SOCIETE: 'Société',
};

const CIVILITY_ALIASES = {
    'madame': CIVILITY.MADAME, 'mme': CIVILITY.MADAME, 'mme.': CIVILITY.MADAME,
    'monsieur': CIVILITY.MONSIEUR, 'm.': CIVILITY.MONSIEUR, 'mr': CIVILITY.MONSIEUR,
    'mr.': CIVILITY.MONSIEUR, 'm': CIVILITY.MONSIEUR,
    'acp': CIVILITY.ACP, 'copropriété': CIVILITY.ACP, 'copropriete': CIVILITY.ACP,
    'société': CIVILITY.SOCIETE, 'societe': CIVILITY.SOCIETE, 'sté': CIVILITY.SOCIETE,
    'sa': CIVILITY.SOCIETE, 'srl': CIVILITY.SOCIETE, 'asbl': CIVILITY.SOCIETE,
    'sprl': CIVILITY.SOCIETE,
};

/**
 * Résout la civilité EXPLICITE d'un contact.
 * Retourne une valeur de CIVILITY, ou `null` si aucune civilité n'est connue.
 * Ne devine JAMAIS depuis le prénom (contrainte projet n°4).
 */
export const resolveExplicitCivility = (contact) => {
    if (!contact) return null;

    // 1. Champ civilité explicite (dossier ou document)
    const raw = (contact.civility ?? contact.civilite ?? contact.titre ?? contact.statut ?? '').toString().trim().toLowerCase();
    if (raw && CIVILITY_ALIASES[raw]) return CIVILITY_ALIASES[raw];

    // 2. Type structurel explicite (ACP / société)
    const type = (contact.type ?? contact.kind ?? contact.origin ?? '').toString().trim().toLowerCase();
    if (type === 'acp' || type === 'copropriete') return CIVILITY.ACP;
    if (['company', 'société', 'societe', 'entreprise', 'prestataire'].includes(type) && (contact.isCompany || contact.isSociete)) return CIVILITY.SOCIETE;

    return null;
};

const resolveCivility = (party) => resolveExplicitCivility(party) || '';

const NAME_PARTICLES = new Set(['van', 'de', 'du', 'der', 'den', 'des', 'le', 'la', 'von', "d'", 'ten', 'ter', 'el', 'al', 'da', 'di']);

/**
 * Découpe une chaîne brute ("Dominique Jordan", "Jean-Pierre De La Tour")
 * en { firstName, lastName, full }. Heuristique déterministe SANS deviner le genre.
 */
export const parseFullName = (rawName) => {
  const cleaned = (rawName || '').toString().trim().replace(/\s+/g, ' ');
  if (!cleaned) return { firstName: null, lastName: null, full: '' };

  const tokens = cleaned.split(' ');
  if (tokens.length === 1) {
    return { firstName: null, lastName: tokens[0], full: cleaned };
  }

  let lastNameStart = tokens.length - 1;
  for (let i = 1; i < tokens.length; i++) {
    const cleanToken = tokens[i].toLowerCase().replace(/'$/, "'");
    if (NAME_PARTICLES.has(cleanToken)) {
      lastNameStart = i;
      break;
    }
  }

  const firstName = tokens.slice(0, lastNameStart).join(' ') || null;
  const lastName = tokens.slice(lastNameStart).join(' ');

  return { firstName, lastName, full: cleaned };
};

export function buildReferenceCandidates({ refPechard, refCompagnie, numSinistreCie, numPolice, dossierName } = {}) {
  const cleanRef = (raw) => {
    const t = (raw || '').toString().trim().replace(/\s+/g, ' ');
    if (!t) return '';
    if (/^[\d\s./-]+$/.test(t) && /\d/.test(t)) return t.replace(/[\s./-]/g, '');
    return t;
  };

  const seen = new Set();
  const candidates = [];
  const push = (raw, provenance) => {
    const value = cleanRef(raw);
    if (!value || seen.has(value)) return;
    seen.add(value);
    candidates.push({ value, provenance });
  };

  if (refPechard) push(refPechard, 'Référence Péchard');
  if (numSinistreCie) push(numSinistreCie, 'Référence AXA / Cie');
  else if (refCompagnie) push(refCompagnie, 'Référence AXA / Cie');
  else if (numPolice) push(numPolice, 'Police AXA / Cie');
  if (dossierName) push(dossierName, 'Nom du dossier');

  return candidates;
}

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
    civilite: resolveCivility(raw),
    displayName: fullName || email,
    raw,
  };
};

export const buildRecipientCandidates = ({ occupants = [], intervenants = [] }) => {
  const safeOccupants = Array.isArray(occupants) ? occupants : [];
  const safeIntervenants = Array.isArray(intervenants) ? intervenants : [];

  const all = [
    ...safeOccupants.map((o) => toContact(o, 'occupant')),
    ...safeIntervenants.map((i) => toContact(i, 'intervenant')),
  ].filter(Boolean);

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

export const extractEmailsForOutlook = (contacts = []) => {
  const emails = (Array.isArray(contacts) ? contacts : [])
    .map((c) => c?.email)
    .filter(Boolean);
  return [...new Set(emails)].join('; ');
};

export const buildSalutation = (contacts = []) => {
  const list = Array.isArray(contacts) ? contacts : [];
  if (list.length === 0) return 'Bonjour,';

  const parts = list.map((c) => {
    const rawLastName = c?.nom || c?.displayName || '';
    const lastName = typeof rawLastName === 'string' && rawLastName.includes(' ')
      ? (parseFullName(rawLastName)?.lastName || rawLastName)
      : rawLastName;

    if (c?.civility && lastName) {
      return `${c.civility} ${formatPersonName(lastName)}`.trim();
    }

    const fullName = (c?.displayName || c?.nom || '').trim();
    if (fullName && fullName !== c?.email) {
      return formatPersonName(fullName);
    }

    return '';
  });

  const validParts = parts.filter(Boolean);
  if (validParts.length === 0) return 'Bonjour,';

  return `Bonjour ${validParts.join(', ')},`;
};

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

export function buildAllCandidates({ occupants = [], intervenants = [], localContacts = [], documentCandidates = [] } = {}) {
    const cleanLocalContacts = (localContacts || []).filter(c => c != null && typeof c === 'object');
    const dossierCandidates = buildRecipientCandidates({ occupants, intervenants })
        .map(c => {
            const civ = c.civilite || c.civility || resolveExplicitCivility(c) || null;
            return {
                ...c,
                displayName: c.displayName || c.nom,
                firstName: c.firstName || c.prenom || null,
                lastName: c.lastName || c.nom || null,
                civilite: civ,
                civility: civ,
                contactType: c.contactType || (civ === 'ACP' ? 'acp' : civ === 'Société' ? 'company' : 'person'),
                civilitySource: c.civilitySource || (civ ? 'record' : 'none'),
                resolution: c.resolution || (civ ? 'structured_record' : 'name_only'),
                kind: 'dossier',
                sourceCategory: 'Dossier actif'
            };
        });

    const docCandidates = (documentCandidates || []).map((c, i) => {
        const civ = c.civilite || c.civility || resolveExplicitCivility(c) || null;
        const displayName = c.displayName || c.nom || 'Candidat document';
        const words = (displayName || '').trim().split(/\s+/).filter(Boolean);
        const parsedFirstName = c.firstName || c.prenom || (words.length > 1 ? words.slice(0, -1).join(' ') : null);
        const parsedLastName = c.lastName || c.nom || (words.length > 0 ? words[words.length - 1] : null);

        return {
            id: c.id || `doc-candidate-${i}`,
            displayName,
            nom: parsedLastName || displayName,
            firstName: parsedFirstName,
            lastName: parsedLastName,
            civilite: civ,
            civility: civ,
            contactType: c.contactType || (civ === 'ACP' ? 'acp' : civ === 'Société' ? 'company' : 'person'),
            civilitySource: c.civilitySource || (civ ? 'document_explicit' : 'none'),
            resolution: c.resolution || (civ ? 'civility_explicit' : 'name_only'),
            email: c.email || '',
            hasEmail: Boolean(c.email),
            iban: c.iban || '',
            kind: 'document',
            origin: c.origin || 'Document analysé',
            sourceCategory: 'Document analysé'
        };
    });

    const overriddenSourceIds = new Set(
        cleanLocalContacts.filter(c => c.origin === 'override' && c.sourceId).map(c => c.sourceId)
    );

    const visibleDossier = dossierCandidates.filter(c => !overriddenSourceIds.has(c.id));
    const visibleDocs = docCandidates.filter(c => !overriddenSourceIds.has(c.id));
    const locals = cleanLocalContacts.map(c => {
        const civ = c.civilite || c.civility || resolveExplicitCivility(c) || null;
        return {
            ...c,
            displayName: c.displayName || c.nom,
            firstName: c.firstName || c.prenom || null,
            lastName: c.lastName || c.nom || null,
            civilite: civ,
            civility: civ,
            contactType: c.contactType || (civ === 'ACP' ? 'acp' : civ === 'Société' ? 'company' : 'person'),
            civilitySource: c.civilitySource || (civ ? 'manual' : 'none'),
            resolution: c.resolution || (civ ? 'civility_explicit' : 'name_only'),
            kind: 'local',
            hasEmail: Boolean(c.email),
            sourceCategory: 'Session actuelle'
        };
    });

    return [...visibleDossier, ...visibleDocs, ...locals];
}

export function resolveRecipientSnapshot(ref, allCandidates) {
    if (!ref) return null;
    const found = allCandidates.find(c => c.kind === ref.kind && c.id === ref.id);
    if (!found) return null;
    return {
        displayName: found.displayName,
        firstName: found.firstName || null,
        lastName: found.lastName || null,
        email: found.email ?? '',
        iban: found.iban,
        civility: found.civility || found.civilite || null,
        civilite: found.civility || found.civilite || null,
        contactType: found.contactType || 'person',
        civilitySource: found.civilitySource || 'none',
        resolution: found.resolution || 'name_only',
        origin: found.origin,
        resolvedAt: new Date().toISOString(),
    };
}

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
