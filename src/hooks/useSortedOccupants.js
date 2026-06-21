// src/hooks/useSortedOccupants.js
import { useMemo } from 'react';
import { buildOccupantHierarchy } from '../domain/occupantsHierarchy';

/**
 * Hook React pour dériver la hiérarchie visuelle des occupants
 * depuis l'état brut du store.
 * Memoïsé pour éviter les recalculs inutiles à chaque render.
 *
 * @param {Array} rawOccupants - Liste brute venant du store
 * @returns {Array} Liste triée avec les locataires nichés
 */
export const useSortedOccupants = (rawOccupants) => {
  return useMemo(() => {
    return buildOccupantHierarchy(rawOccupants);
  }, [rawOccupants]);
};
