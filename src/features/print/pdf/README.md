# Moteur PDF Natif

## Contraintes et Principes d'Architecture Globale

Le rendu PDF est strictement séparé du rendu Web de l'application. Cette séparation garantit une génération asynchrone pure sans polluer le thread UI.

### Règles d'or :
- **Props-only** : Toute la donnée doit être passée par props via `reportData`. **Aucun `Context` ou Store Global (`Zustand`) ne doit être appelé ici.**
- **Aucun DOM** : L'utilisation de balises HTML (div, span, table) ou de l'accès au DOM (`document.querySelector`) est strictement interdite. 
- **Séparation Web/PDF** : Aucun import depuis `src/features/print/web/`.
- **Génération Binaire** : La génération s'effectue via `pdf().toBlob()`. **L'utilisation de `PDFDownloadLink` est interdite.**
- **Résolution des Images** : Les images doivent être résolues sous forme de Blob URLs avant l'instanciation de React-PDF. Aucun UUID brut ne doit atteindre les composants PDF, et la mémoire des Blob URLs doit être libérée après usage.
- **Pagination et Indivisibilité** : Les éléments comme les lignes de tableaux (`PDFFeesTableRow`) doivent utiliser `wrap={false}`.
- **Références d'Annexes** : Les références d'annexes (`fee.annexReference`) doivent toujours apparaître sous la description, avec la classe exacte `styles.annexReference` (petit, gris, italique).

Exemple de structure d'un frais avec annexe :
```javascript
{
  prestataire: "Artisan X",
  desc: "Peinture",
  annexReference: "Réf. Annexe 2", // Toujours affiché sous la description
  montant: "100.00"
}
```
