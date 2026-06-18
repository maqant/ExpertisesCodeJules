// src/domain/claims/claimEngine.js
import { PARTY_CLAIMS, DOSSIER_CLAIMS } from './claimCatalog.js';
import { normalizeStatus } from './statusTypes.js';

/**
 * Évalue les réclamations applicables à un dossier et ses parties.
 * v2 : enrichit les claims dossier `targetable` ou `hasPhotos` avec `eligibleParties`.
 */
export const evaluateClaims = (formData = {}, occupants = [], expenses = []) => {
    const normalizedOccupants = (occupants || []).map(occ => ({
        ...occ,
        normalizedStatut: normalizeStatus(occ.statut)
    }));

    const ctxDossier = { formData, occupants: normalizedOccupants, expenses };

    // Liste simplifiée des parties pour les sous-menus targetable/photos
    const eligiblePartiesList = normalizedOccupants.map(o => ({
        id: o.id,
        nom: o.nom || 'Inconnu',
        prenom: o.prenom || '',
        statut: o.statut || 'Inconnu',
    }));

    const dossierGaps = DOSSIER_CLAIMS.filter(claim => claim.applies(ctxDossier)).map(claim => {
        const base = {
            id: claim.id,
            label: claim.label,
            isChecked: claim.preChecked(ctxDossier),
            targetable: claim.targetable || false,
            hasNano: claim.hasNano || false,
            hasPhotos: claim.hasPhotos || false,
        };

        // Exposer les parties éligibles pour les claims ciblables ou avec photos
        if (claim.targetable || claim.hasPhotos) {
            base.eligibleParties = eligiblePartiesList;
        }

        return base;
    });

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
            statut: party.statut || 'Inconnu',
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
