// src/domain/claims/claimCatalog.js
import { PartyStatus } from './statusTypes.js';

const hasValue = (v) => v != null && String(v).trim() !== '';

export const PARTY_CLAIMS = Object.freeze([
    {
        id: 'IBAN',
        label: 'IBAN / RIB',
        scope: 'PARTY',
        applies: () => true, // toute partie peut être indemnisée
        preChecked: ({ party }) => !hasValue(party.iban),
    },
    {
        id: 'RC_FAMILIALE',
        label: 'Attestation RC familiale',
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
        // Pré-coché si AUCUN locataire n'est déjà identifié dans le dossier.
        preChecked: ({ allOccupants }) =>
            !allOccupants.some((o) => o.statut === PartyStatus.LOCATAIRE),
    },
    {
        id: 'RC_LOCATIVE',
        label: 'Attestation RC locative du locataire',
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
        preChecked: () => true, // Souvent manquant ou demandé au syndic
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
        id: 'DEVIS',
        label: 'Devis de réparation',
        scope: 'DOSSIER',
        applies: () => true,
        preChecked: ({ expenses }) =>
            !expenses.some((e) => String(e?.type ?? '').toLowerCase() === 'devis'),
    },
    {
        id: 'PLAINTE',
        label: 'Dépôt de plainte / récépissé (suite au vol/vandalisme)',
        scope: 'DOSSIER',
        applies: ({ formData }) => {
            const c = String(formData?.cause ?? '').toLowerCase();
            return ['vol', 'vandalisme', 'effraction'].some((k) => c.includes(k));
        },
        preChecked: () => true, // si applicable (cause = vol), c'est requis
    },
    {
        id: 'CAUSE_DETAIL',
        label: 'Précisions sur les circonstances exactes du sinistre',
        scope: 'DOSSIER',
        applies: () => true,
        preChecked: ({ formData }) => {
            const c = String(formData?.cause ?? '').trim();
            return c.length < 20;
        },
    },
]);
