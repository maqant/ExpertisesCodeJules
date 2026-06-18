// src/domain/claims/statusTypes.js

/** Statuts canoniques (clés logiques stables, jamais affichées telles quelles). */
export const PartyStatus = Object.freeze({
    LOCATAIRE: 'LOCATAIRE',
    PROPRIO_OCCUPANT: 'PROPRIO_OCCUPANT',
    PROPRIO_NON_OCCUPANT: 'PROPRIO_NON_OCCUPANT',
    COPROPRIETE: 'COPROPRIETE',
    UNKNOWN: 'UNKNOWN',
});

/** Mappe une chaîne libre (potentiellement sale) vers un statut canonique. */
export const normalizeStatus = (raw) => {
    const s = String(raw ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // retire les accents
        .trim();

    if (!s) return PartyStatus.UNKNOWN;
    if (s.includes('non occupant') || s === 'pno') return PartyStatus.PROPRIO_NON_OCCUPANT;
    if (s.includes('proprietaire') && s.includes('occupant')) return PartyStatus.PROPRIO_OCCUPANT;
    if (s.includes('proprietaire')) return PartyStatus.PROPRIO_OCCUPANT; // défaut prudent
    if (s.includes('locataire')) return PartyStatus.LOCATAIRE;
    if (s.includes('copropriete') || s.includes('syndic')) return PartyStatus.COPROPRIETE;
    if (s === 'acp') return PartyStatus.COPROPRIETE;
    return PartyStatus.UNKNOWN;
};
