# Moteur PDF Natif

## Contraintes et Principes

- **Outil strict** : Utilisation exclusive de `@react-pdf/renderer`.
- **Pas de Context API** : Toute la donnée doit être passée par props (via `reportData`).
- **Pas de composant `<PDFDownloadLink>`** : La génération se fera à l'avenir via `pdf().toBlob()`.
- **Pas de DOM** : Aucun composant Web (HTML natif : `div`, `span`, `table`, etc.) ni import depuis `src/features/print/web/`.
- **Images** : Les images doivent être résolues en base64 ou URL absolue avant l'injection.
- **Design System** : Tous les styles sont définis de manière centralisée dans `pdfStyles.js`. Aucune classe CSS ou style en dur ("inline") dans les composants.
