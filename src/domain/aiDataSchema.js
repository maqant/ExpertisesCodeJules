// src/domain/aiDataSchema.js
// Source de vérité unique pour la forme des données IA validables dans le sas.
// Garantit qu'AUCUNE clé n'est jamais perdue entre l'IA et l'état applicatif.

const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15);
};

export const normalizeLastName = (raw) =>
  (raw || '')
    .replace(/\b(M\.|Mme|Mr|Mlle|Dr|Me)\b/gi, '')
    .trim()
    .toUpperCase();

const OCCUPANT_DEFAULTS = {
  nom: null,
  prenom: null,
  etage: null,
  statut: 'Locataire',
  tel: null,
  email: null,
  iban: null,
  rc: 'Non',             // Normalisé en string "Oui"/"Non" pour compatibilité
  rcPolice: null,
  secAssurance: 'Non',   // Normalisé en string "Oui"/"Non" pour compatibilité
  secCie: null,
  secPolice: null,
  secType: null,
  contreExpert: false,
  nomContreExpert: null
};

const REFERENCE_DEFAULTS = {
  nom: null,
  ref: null
};

const FORMDATA_DEFAULTS = {
  dateExp: null, heureExp: null, nomResidence: null, adresse: null, expertInfos: null,
  dateSinistre: null, dateDeclaration: null, declarant: null, nomCie: null, nomContrat: null,
  numPolice: null, numSinistreCie: null, numConditionsGenerales: null, numeroPVPolice: null, franchise: null,
  pertesIndirectes: null, isAxa: false,
  isContradictoire: false, cieContradictoire: null, bureauContradictoire: null,
  expertContradictoire: null, compteDeContradictoire: null
};

const mergeDefaults = (defaults, source) =>
  Object.keys(defaults).reduce((acc, key) => {
    let val = source && source[key] !== undefined ? source[key] : defaults[key];
    // Normalisation spécifique pour rc et secAssurance si reçus en boolean
    if (key === 'rc' || key === 'secAssurance') {
      if (val === true || val === 'Oui') val = 'Oui';
      else if (val === false || val === 'Non') val = 'Non';
    }
    acc[key] = val;
    return acc;
  }, {});

export function normalizeAiData(raw = {}) {
  return {
    formData: raw.formData ? mergeDefaults(FORMDATA_DEFAULTS, raw.formData) : null,
    
    occupants: Array.isArray(raw.occupants)
      ? raw.occupants
          .filter((o) => o && (o.nom || o.prenom))
          .map((o) => ({
             ...mergeDefaults(OCCUPANT_DEFAULTS, o),
             id: o.id || generateId() // Assurer un ID temporaire unique
          }))
      : [],
      
    expenses: Array.isArray(raw.expenses)
      ? raw.expenses.filter(Boolean).map((e) => ({
          ...e,
          id: e.id || generateId() // Assurer un ID temporaire unique
        }))
      : [],
      
    references: Array.isArray(raw.references)
      ? raw.references
          .filter((r) => r && (r.nom || r.ref))
          .map((r) => ({
             ...mergeDefaults(REFERENCE_DEFAULTS, r),
             id: r.id || generateId() // Assurer un ID unique pour le sas
          }))
      : [],
  };
}

export const referenceKey = (r) =>
  `${(r.nom || '').toLowerCase().trim()}::${(r.ref || '').toLowerCase().trim()}`;
