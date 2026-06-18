// src/domain/claims/claimCatalog.js
import { PartyStatus } from './statusTypes.js';

const hasValue = (v) => v != null && String(v).trim() !== '';

export const PARTY_CLAIMS = Object.freeze([
    {
        id: 'IBAN',
        label: 'IBAN',
        scope: 'PARTY',
        applies: () => true,
        preChecked: ({ party }) => !hasValue(party.iban),
    },
    {
        id: 'RC_FAMILIALE',
        label: 'Coordonnées RC familiale (Compagnie + N° contrat)',
        scope: 'PARTY',
        applies: ({ party }) =>
            party.statut === PartyStatus.LOCATAIRE ||
            party.statut === PartyStatus.PROPRIO_OCCUPANT,
        preChecked: ({ party }) =>
            party.rc !== 'Oui' || (!hasValue(party.rcPolice) && !hasValue(party.rcCie)),
    },
    {
        id: 'BAIL',
        label: 'Copie du contrat de bail',
        scope: 'PARTY',
        applies: ({ party }) =>
            party.statut === PartyStatus.LOCATAIRE ||
            party.statut === PartyStatus.PROPRIO_NON_OCCUPANT,
        preChecked: ({ party }) => party.statut === PartyStatus.LOCATAIRE,
    },
    {
        id: 'COORD_LOCATAIRE',
        label: 'Coordonnées complètes du locataire (nom, prénom, email, téléphone)',
        scope: 'PARTY',
        applies: ({ party }) => party.statut === PartyStatus.PROPRIO_NON_OCCUPANT,
        preChecked: ({ allOccupants }) =>
            !allOccupants.some((o) => o.statut === PartyStatus.LOCATAIRE),
    },
    {
        id: 'RC_LOCATIVE',
        label: 'Coordonnées RC locative (Compagnie + N° contrat du locataire)',
        scope: 'PARTY',
        applies: ({ party }) => party.statut === PartyStatus.PROPRIO_NON_OCCUPANT,
        preChecked: ({ allOccupants }) => {
            const loc = allOccupants.find((o) => o.statut === PartyStatus.LOCATAIRE);
            return !loc || loc.rc !== 'Oui' || (!hasValue(loc.rcPolice) && !hasValue(loc.rcCie));
        },
    },
    {
        id: 'COORD_PROPRIETAIRE',
        label: 'Coordonnées complètes du propriétaire bailleur',
        scope: 'PARTY',
        applies: ({ party }) => party.statut === PartyStatus.LOCATAIRE,
        preChecked: ({ allOccupants }) =>
            !allOccupants.some((o) => o.statut === PartyStatus.PROPRIO_NON_OCCUPANT),
    },
    {
        id: 'RC_IMMEUBLE',
        label: 'Attestation d\'assurance incendie de l\'immeuble',
        scope: 'PARTY',
        applies: ({ party }) => party.statut === PartyStatus.COPROPRIETE,
        preChecked: () => true,
    },
    {
        id: 'DEVIS_SYNDIC',
        label: 'Devis de réparation des parties communes',
        scope: 'PARTY',
        applies: ({ party }) => party.statut === PartyStatus.COPROPRIETE,
        preChecked: () => false,
    }
]);

export const DOSSIER_CLAIMS = Object.freeze([
    {
        id: 'CAUSE_DETAIL',
        label: 'Description de l\'incident (cause, circonstances, photos)',
        scope: 'DOSSIER',
        targetable: false,
        hasNano: true,   // déclenche l'analyse nano-IA de la cause
        hasPhotos: true, // ouvre le sous-menu de sélection par partie
        applies: () => true,
        preChecked: ({ formData }) => String(formData?.cause ?? '').trim().length < 20,
    },
    {
        id: 'DEVIS',
        label: 'Devis de réparation',
        scope: 'DOSSIER',
        targetable: true, // peut cibler des parties spécifiques
        hasNano: false,
        hasPhotos: false,
        applies: () => true,
        preChecked: ({ expenses }) =>
            !expenses.some((e) => String(e?.type ?? '').toLowerCase() === 'devis'),
    },
    {
        id: 'PERTE_CONTENU',
        label: 'État de perte / liste chiffrée du contenu',
        scope: 'DOSSIER',
        targetable: false,
        hasNano: false,
        hasPhotos: false,
        applies: () => true,
        preChecked: () => false,
    },
    {
        id: 'PLAINTE',
        label: 'Dépôt de plainte / récépissé',
        scope: 'DOSSIER',
        targetable: false,
        hasNano: false,
        hasPhotos: false,
        applies: ({ formData }) => {
            const c = String(formData?.cause ?? '').toLowerCase();
            return ['vol', 'vandalisme', 'effraction'].some((k) => c.includes(k));
        },
        preChecked: () => true,
    },
]);
