// src/hooks/useRecipientSelection.js
import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  buildRecipientCandidates,
  extractEmailsForOutlook,
  buildSalutation,
} from '../services/utils/contactUtils';

/**
 * Hook réutilisable pour la sélection de destinataires.
 * Réutilisable dans AR, et futurs modules Pendant/Post sinistre.
 *
 * @param {{ occupants?: Array, intervenants?: Array, defaultAllSelected?: boolean }} args
 */
export const useRecipientSelection = ({
  occupants = [],
  intervenants = [],
  defaultAllSelected = true,
} = {}) => {
  const candidates = useMemo(
    () => buildRecipientCandidates({ occupants, intervenants }),
    [occupants, intervenants]
  );

  const [selectedIds, setSelectedIds] = useState(() =>
    defaultAllSelected ? new Set(candidates.map((c) => c.id)) : new Set()
  );

  // Re-synchronise si les candidats changent (ex: ajout d'un intervenant)
  useEffect(() => {
    setSelectedIds((prev) => {
      const validIds = new Set(candidates.map((c) => c.id));
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      // Sélection auto des nouveaux candidats si mode "tout sélectionné"
      if (defaultAllSelected) {
        candidates.forEach((c) => {
          if (![...prev].length && next.size === 0) next.add(c.id);
        });
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates]);

  const toggle = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const setAll = useCallback(
    (checked) => {
      setSelectedIds(checked ? new Set(candidates.map((c) => c.id)) : new Set());
    },
    [candidates]
  );

  const selectedContacts = useMemo(
    () => candidates.filter((c) => selectedIds.has(c.id)),
    [candidates, selectedIds]
  );

  const emailsString = useMemo(
    () => extractEmailsForOutlook(selectedContacts),
    [selectedContacts]
  );

  const salutation = useMemo(
    () => buildSalutation(selectedContacts),
    [selectedContacts]
  );

  return {
    candidates,        // tous les contacts avec e-mail valide
    selectedContacts,  // les cochés
    selectedIds,
    toggle,
    setAll,
    emailsString,      // "a@x.fr; b@y.fr"  (pour Outlook)
    salutation,        // "Bonjour Madame X, Bonjour Monsieur Y,"
    hasCandidates: candidates.length > 0,
    hasSelection: selectedContacts.length > 0,
  };
};
