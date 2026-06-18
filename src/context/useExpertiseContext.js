import { useContext } from 'react';
import { ExpertiseContext } from './ExpertiseContext.jsx';

/**
 * Consommation STRICTE de l'ExpertiseContext.
 * - Échoue si utilisé hors Provider (pas de undefined silencieux).
 * - Vérifie en DEV que les clés requises par le composant existent réellement,
 *   transformant les "X is not defined" en erreurs explicites et tracées.
 *
 * @param {string[]} requiredKeys - clés que le composant s'engage à consommer.
 */
export function useExpertiseContext(requiredKeys = []) {
  const ctx = useContext(ExpertiseContext);
  if (!ctx) {
      throw new Error("useExpertiseContext doit être utilisé dans un ExpertiseContext.Provider");
  }
  
  for (const key of requiredKeys) {
    if (ctx[key] === undefined) {
      throw new Error(`La clé requise "${key}" n'est pas présente dans l'ExpertiseContext. Avez-vous oublié de l'exporter dans le 'value' du Provider ?`);
    }
  }
  return ctx;
}
