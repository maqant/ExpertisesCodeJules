import { useMemo, useState, useCallback, useEffect } from 'react';
import { buildRecipientCandidates, extractEmailsForOutlook, buildSalutation } from '../services/utils/contactUtils';

/**
 * Hook réutilisable pour la sélection d'un UNIQUE destinataire.
 * Basé sur la même logique de candidats que `useRecipientSelection` mais pour des blocs 1:1.
 *
 * @param {{ occupants?: Array, intervenants?: Array, initialSelectedId?: string }} args
 */
export const useSingleRecipient = ({
    occupants = [],
    intervenants = [],
    initialSelectedId = null,
} = {}) => {
    const candidates = useMemo(
        () => buildRecipientCandidates({ occupants, intervenants }),
        [occupants, intervenants]
    );

    const [selectedId, setSelectedId] = useState(initialSelectedId);

    // Si le candidat sélectionné disparaît des candidats valides, on reset
    useEffect(() => {
        if (selectedId && !candidates.some(c => c.id === selectedId)) {
            setSelectedId(null);
        }
    }, [candidates, selectedId]);

    const select = useCallback((id) => {
        setSelectedId(id);
    }, []);

    const selectedContact = useMemo(
        () => candidates.find(c => c.id === selectedId) || null,
        [candidates, selectedId]
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
        selectedId,
        select,
        emailString,
        salutation,
        hasCandidates: candidates.length > 0,
        hasSelection: !!selectedContact,
    };
};
