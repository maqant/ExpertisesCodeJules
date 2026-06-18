// src/utils/expenseMerge.js
/**
 * Fusionne un Devis et une Facture en un seul expense Multi-Documents,
 * strictement aligné sur l'état produit par un drop groupé Sidebar.
 *
 * @param {Object} factureExp - L'objet expense de type Facture
 * @param {Object} devisExp - L'objet expense de type Devis
 * @param {Object} attachedFiles - Le dictionnaire complet des fichiers attachés (clé = expense.id)
 * @returns {Object} { mergedExpense, keepId, removeId, fusedFiles }
 */
export function mergeDevisIntoFacture(factureExp, devisExp, attachedFiles) {
  // La Facture devient le porteur. Son type est forcé à 'Facture' au cas où.
  const merged = { ...factureExp, type: 'Facture' };

  // Les fichiers des deux expenses cohabitent sous l'id de la Facture.
  const fusedFiles = [
    ...(attachedFiles[factureExp.id] || []),
    ...(attachedFiles[devisExp.id]  || []),
  ];

  return {
    mergedExpense: merged,
    keepId: factureExp.id,    // expense à conserver
    removeId: devisExp.id,    // expense à supprimer
    fusedFiles,               // à placer sous attachedFiles[keepId]
  };
}
