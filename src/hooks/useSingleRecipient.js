import { useMemo } from 'react';
import { buildAllCandidates, extractEmailsForOutlook, buildSalutation } from '../services/utils/contactUtils';

/**
 * Hook réutilisable pour la sélection d'un UNIQUE destinataire.
 * Basé sur la même logique de candidats que `useRecipientSelection` mais pour des blocs 1:1.
 * Devenu STATELESS (la source de vérité est le reducer du parent).
 *
 * @param {{ occupants?: Array, intervenants?: Array, localContacts?: Array, recipientRef?: {kind:string, id:string} }} args
 */
export const useSingleRecipient = ({
    occupants = [],
    intervenants = [],
    localContacts = [],
    recipientRef = null,
} = {}) => {
    const candidates = useMemo(
        () => buildAllCandidates({ occupants, intervenants, localContacts }),
        [occupants, intervenants, localContacts]
    );

    const selectedContact = useMemo(
        () => {
            if (!recipientRef) return null;
            return candidates.find(c => c.kind === recipientRef.kind && c.id === recipientRef.id) || null;
        },
        [candidates, recipientRef]
    );

    const emailString = useMemo(
        () => extractEmailsForOutlook(selectedContact ? [selectedContact] : []),
        [selectedContact]
    );

    const salutation = useMemo(
        () => buildSalutation(selectedContact ? [selectedContact] : []),
        [selectedContact]
    );

    return {
        candidates,
        selectedContact,
        recipientRef,
        emailString,
        salutation,
        hasCandidates: candidates.length > 0,
        hasSelection: !!selectedContact,
    };
};
