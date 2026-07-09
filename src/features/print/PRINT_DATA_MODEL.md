# Modèle de Données : Impression & PDF

Ce document décrit la structure de l'objet de données retourné par `buildPrintReportData` dans `printDataAdapter.js`.
Cet objet est le **seul contrat de données** autorisé entre la logique métier React et les moteurs de rendu (Web `PrintPreview.jsx` ou futur PDF `React-PDF`).

## Principes Fondamentaux
1. **Pureté et Sérialisation :** L'objet `reportData` ne contient aucune fonction, aucune référence au DOM, aucun Context React. Il peut être transformé en JSON via `JSON.stringify()` sans perte de données.
2. **Indépendance Visuelle :** La logique d'affichage (tailles, marges, composants) est gérée par le composant de rendu, mais les informations conditionnelles métiers (`showSubtotals`, `orgaAdvancedMode`) sont fournies dans le champ `meta`.

## Contrats de Rendu (Web vs PDF)
Le projet repose sur la promesse stricte que le rendu Web et le moteur PDF consomment **exactement** le même objet `reportData`.
Cependant, l'implémentation de leur affichage obéit à des règles propres :
- **Web (`src/features/print/web/`)** : Autorisé à utiliser TailwindCSS, le DOM (`<div>`, `<span>`), et les styles inline si nécessaire, tant qu'il ne pollue pas `reportData`.
- **PDF (`src/features/print/pdf/`)** : 
  - Doit utiliser **exclusivement** les primitives de `@react-pdf/renderer`.
  - Le design system PDF est strictement confiné à `pdfStyles.js`.
  - **Règle absolue pour les références d'annexes (`annexReference`)** : Que ce soit en Web ou en PDF, si une ligne de frais contient une référence d'annexe, celle-ci doit être rendue **sous la description principale**, et jamais dans une colonne séparée. Dans le PDF, elle doit utiliser strictement le style `styles.annexReference` (petit, italique, gris).

## Structure de `reportData`

```json
{
  "meta": {
    "orderedBlocks": ["titre", "coord", "infos", "cause", "orga", "frais", "photos", "divers"],
    "styles": { "titre": { "fontSize": 14, "color": "#000" }, "..." : {} },
    "showSubtotals": true,
    "orgaAdvancedMode": false
  },
  "titre": {
    "formData": { "dateExp": "2026-06-15", "heureExp": "10:00", "refPechard": "DOSS-001" }
  },
  "coord": {
    "title": "Coordonnées de l'expertise",
    "formData": { "adresse": "12 rue de la Paix", "franchise": "250€", "expertInfos": "M. Dupont", "isContradictoire": false },
    "references": [ { "nom": "Ref Client", "ref": "898-1" } ],
    "paginationDocMailExpertise": "Annexe 1 - Page 2"
  },
  "infos": {
    "title": "Informations contractuelles",
    "formData": { "dateSinistre": "...", "nomCie": "AXA", "numPolice": "..." },
    "paginationDocMailDeclaration": "Annexe 2",
    "paginationDocCondPart": "Annexe 3"
  },
  "cause": {
    "title": "Cause et dommages",
    "timeline": [ { "date": "10:00", "type": "note", "content": "Arrivée sur place" } ],
    "formDataCause": "Fuite sous évier",
    "paginationDocRapportCause": "Annexe 4"
  },
  "orga": {
    "title": "Parties impliquées",
    "occupantsHierarchy": [
      {
        "id": "uuid-1234",
        "nom": "Dupont",
        "prenom": "Jean",
        "statut": "Locataire",
        "isResponsible": true,
        "formattedNomPrenom": "Dupont Jean",
        "_depth": 0
      }
    ],
    "intervenants": [
      { "id": "uuid-5678", "nom": "Plombex", "role": "Réparateur" }
    ]
  },
  "frais": {
    "title": "Tableau récapitulatif des frais",
    "totalFrais": 450.50,
    "expenses": [
      {
        "id": "uuid-9012",
        "prestataire": "Plombex",
        "type": "Facture",
        "ref": "FA-2026-01",
        "desc": "Recherche de fuite",
        "montant": "450,50",
        "typeMontant": "HTVA",
        "isFranchise": false,
        "compteDeFormatted": "Dupont Jean (RDC)",
        "annexReference": "Annexe 5 - Page 1 à 2"
      }
    ],
    "dettesParPersonne": {
      "DUPONT Jean": {
        "HTVA": 450.50,
        "TVAC": 0,
        "Forfait": 0,
        "Franchise": 0,
        "lignes": [ ... ],
        "compteDeFormatted": "Dupont Jean (RDC)"
      }
    }
  },
  "frais_liste": {
    "dettesParPersonne": [
      {
        "personne": "DUPONT Jean",
        "compteDeFormatted": "Dupont Jean (RDC)",
        "isExpertClient": false,
        "HTVA": 450.50,
        "lignes": [ { "prestataire": "Plombex", "desc": "...", "montant": "450,50", "typeMontant": "HTVA" } ]
      }
    ]
  },
  "photos": {
    "title": "Annexes photographiques",
    "occupantsWithPhotos": [
      { "id": "uuid-1234", "nom": "Dupont Jean", "annexReference": "Annexe 6 - Pages 4 à 8" }
    ]
  },
  "divers": {
    "title": "Remarques diverses",
    "formDataDivers": "Le locataire était absent."
  },
  "customBlocks": [
    { "id": "custom_1", "text": "Un bloc de texte personnalisé." }
  ]
}
```

## Champs Obligatoires & Optionnels
- **meta.orderedBlocks :** Obligatoire. Dicte l'ordre de rendu visuel.
- **meta.styles :** Obligatoire. Peut contenir des objets vides si aucun style spécifique n'est défini.
- **expenses[].annexReference :** Optionnel (null). Contient la chaîne renvoyée par le module de pagination (ex: "Annexe 1 - Pages 4 à 7"). **Doit être affiché sous la description du frais.**
- **photos.occupantsWithPhotos[].annexReference :** Optionnel (null). IDEM pour les photos d'un occupant.

## Gestion des Pièces Jointes et UUIDs
**Important :** Bien que `occupantsWithPhotos` contienne les identifiants `id` (UUIDs), le moteur PDF *ne devrait pas* utiliser ces IDs directement. Ils sont présents pour des raisons de debug ou de matching s'il le faut, mais le texte affiché doit utiliser le nom et la référence de l'annexe (`annexReference`). Les UUIDs ne doivent jamais être affichés en clair dans le rendu final.
