// src/domain/claims/claimEngine.js
import { PARTY_CLAIMS, DOSSIER_CLAIMS } from './claimCatalog.js';
import { normalizeStatus } from './statusTypes.js';

/**
 * Évalue les réclamations applicables à un dossier et ses parties.
 */
export const evaluateClaims = (formData = {}, occupants = [], expenses = []) => {
    // Normalisation des statuts
    const normalizedOccupants = (occupants || []).map(occ => ({
        ...occ,
        normalizedStatut: normalizeStatus(occ.statut)
    }));

    const ctxDossier = { formData, occupants: normalizedOccupants, expenses };

    const dossierGaps = DOSSIER_CLAIMS.filter(claim => claim.applies(ctxDossier)).map(claim => ({
        id: claim.id,
        label: claim.label,
        isChecked: claim.preChecked(ctxDossier)
    }));

    const partiesGaps = normalizedOccupants.map(party => {
        const ctxParty = { party: { ...party, statut: party.normalizedStatut }, allOccupants: normalizedOccupants, formData };
        const applicableClaims = PARTY_CLAIMS.filter(claim => claim.applies(ctxParty)).map(claim => ({
            id: claim.id,
            label: claim.label,
            isChecked: claim.preChecked(ctxParty)
        }));

        return {
            id: party.id,
            nom: party.nom || 'Inconnu',
            prenom: party.prenom || '',
            statut: party.statut || 'Inconnu', // keep original for display
            normalizedStatut: party.normalizedStatut,
            email: party.email,
            claims: applicableClaims
        };
    }).filter(p => p.claims.length > 0);

    return {
        dossier: dossierGaps,
        parties: partiesGaps
    };
};
