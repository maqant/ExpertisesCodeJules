/**
 * arAnalyzer.js
 * Détecte les documents et informations manquants dans le dossier d'expertise
 * pour pré-remplir l'interface de l'Accusé de Réception.
 */

export const analyzeMissingItems = (formData = {}, occupants = [], expenses = []) => {
    const gaps = {
        dossier: {
            devis: false,
            plainte: false,
            causeDetail: false
        },
        parties: []
    };

    // 1. Analyse Globale du Dossier
    
    // Devis: Y a-t-il au moins un devis dans les expenses ?
    const hasDevis = expenses.some(exp => exp.type && exp.type.toLowerCase() === 'devis');
    gaps.dossier.devis = !hasDevis;

    // Plainte: La cause suggère-t-elle un vol/vandalisme ?
    const causeText = (formData.cause || '').toLowerCase();
    const isVol = causeText.includes('vol') || causeText.includes('vandalisme') || causeText.includes('effraction');
    if (isVol) {
        // En théorie, il faudrait vérifier s'il y a un document "Plainte" rattaché.
        // Comme on n'a pas accès direct aux pièces jointes qualifiées, on le demande par défaut.
        gaps.dossier.plainte = true;
    }

    // Cause détaillée: La cause est-elle très courte ou absente ?
    if (!causeText || causeText.length < 20) {
        gaps.dossier.causeDetail = true;
    }

    // 2. Analyse par Partie (Occupants)
    occupants.forEach(occ => {
        const partyGaps = {
            id: occ.id,
            nom: occ.nom || 'Inconnu',
            prenom: occ.prenom || '',
            statut: occ.statut || 'Inconnu',
            manques: []
        };

        // Vérification IBAN
        if (!occ.iban || occ.iban.trim() === '') {
            partyGaps.manques.push('IBAN');
        }

        // Vérification RC (si Locataire ou Proprio occupant)
        const isLocataire = occ.statut === 'Locataire';
        const isProprioOcc = occ.statut === 'Propriétaire occupant';
        
        if (isLocataire || isProprioOcc) {
            // Si l'assurance RC n'est pas "Oui" ou si y'a pas de police/compagnie renseignée
            if (occ.rc !== 'Oui' || (!occ.rcPolice && !occ.rcCie)) {
                partyGaps.manques.push('Attestation RC familiale');
            }
        }

        // Vérification Bail (si Locataire)
        if (isLocataire) {
            partyGaps.manques.push('Copie du contrat de bail');
        }

        if (partyGaps.manques.length > 0) {
            gaps.parties.push(partyGaps);
        }
    });

    return gaps;
};
