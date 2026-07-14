/**
 * Stratégies de fusion métier. Domaine pur — aucune dépendance UI/React.
 */
export const MergeStrategy = Object.freeze({
  /** L'humain prime toujours. L'IA ne remplit que le vide. (défaut sécurisé) */
  FILL_EMPTY: 'FILL_EMPTY',
  /** L'IA écrase systématiquement (réservé aux overrides explicites validés). */
  FORCE: 'FORCE',
});

export const FieldStatus = Object.freeze({
  NEW: 'NEW',           // champ humain vide, IA propose une valeur
  CONFLICT: 'CONFLICT', // humain ET IA ont une valeur différente
  ACCUMULATED: 'ACCUMULATED', // IA a enrichi/cumulé le texte existant sans conflit direct
  IDENTICAL: 'IDENTICAL', // valeurs identiques → rien à faire
  EMPTY_AI: 'EMPTY_AI',   // l'IA ne propose rien
});
