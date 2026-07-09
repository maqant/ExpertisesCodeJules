# Modèle de Données d'Impression (Print Data Model)

Ce document décrit la structure de l'objet `reportData` généré par `buildPrintReportData`. Cet objet sert de source de vérité unique, stable et sérialisable pour tout système de rendu du rapport (rendu Web via `PrintPreview.jsx` ou futur moteur PDF).

## Principes Fondamentaux

1. **Agnostique du rendu** : Aucune dépendance à React, au DOM ou aux classes CSS.
2. **Données prêtes à l'emploi** : Les calculs (totaux, formatage de devises, décomptes) sont pré-effectués.
3. **Références explicites** : Les textes d'annexes (ex: "(Annexe 1 - Pages 4 à 7)") sont résolus sous forme de chaînes explicites `annexReference`.
4. **Indépendance des identifiants (UUID)** : Pour les photos et pièces jointes, les UUID internes ne doivent pas être envoyés directement ou utilisés par le moteur de rendu PDF final comme des identifiants stricts de fichiers locaux sans un mapping clair, car le rendu PDF se fera probablement côté serveur ou via un autre flux de données.

## Structure Globale (`reportData`)

```javascript
{
  // Méta-informations globales et flags d'affichage
  metadata: {
    isContradictoire: Boolean,
    showSubtotals: Boolean,
    orgaAdvancedMode: Boolean
  },
  
  // Styles typographiques et de bordures par bloc (provenant des préférences utilisateur)
  styles: {
    titre: { fontSize: Number, color: String, fontFamily: String, textAlign: String, border: Boolean },
    // ... identique pour coord, infos, cause, orga, frais, divers, photos, et custom_*
  },

  // Liste ordonnée des identifiants de blocs à rendre
  blocks: ["titre", "coord", "infos", "cause", "orga", "frais", "frais_liste", "photos", "divers", "custom_1"],

  // Dictionnaires contenant les données de chaque bloc.
  // Un dictionnaire n'est présent que si des données existent.
  
  titre: {
    // Chaîne formatée prête à l'affichage (ex: "Expertise du 12 mai 2024 à 14h00 - REF123 - Résidence")
    dateFormatted: String,
    // Données brutes si le moteur souhaite recomposer le texte
    raw: {
      dateExp: String, // format ISO
      heureExp: String,
      refPechard: String,
      nomResidence: String
    }
  },

  coord: {
    title: String,
    adresse: String,
    franchise: String,
    pertesIndirectes: String,
    expert: String, // ex: "Bureau A - Jean Dupont"
    mailExpertiseAnnexe: String, // ex: "Mails de fixation (Annexe 1 - Pages 1 à 2)"
    contradictoire: { // Présent uniquement si isContradictoire est true
      cie: String,
      expert: String,
      compteDe: String
    }
  },

  infos: {
    title: String,
    sinistreDu: String, // ex: "Sinistre du 10/05/2024"
    declareLe: String, // ex: "déclaré au Bureau Pechard le 12/05/2024"
    declarant: String,
    declarationAnnexe: String, // Référence explicite
    nomCie: String,
    nomContrat: String,
    condPartAnnexe: String,
    numPolice: String,
    numeroPVPolice: String,
    pvPoliceAnnexe: String,
    numConditionsGenerales: String,
    condGenAnnexe: String,
    numSinistreCie: String,
    references: [
      { id: String, nom: String, ref: String }
    ]
  },

  cause: {
    title: String,
    // Si timeline existe, on utilise la timeline, sinon le texte libre
    timeline: [
      {
        id: String,
        date: String, // ex: "10/05/2024"
        type: String, // "file" ou "note"
        fileName: String, // Optionnel, pour le type "file"
        content: String // Contenu texte de la note
      }
    ],
    texte: String,
    rapportCauseAnnexe: String
  },

  orga: {
    title: String,
    occupants: [
      {
        id: String,
        depth: Number, // Niveau d'indentation (0: parent, 1: enfant)
        etage: String,
        statut: String,
        nomComplet: String,
        isResponsible: Boolean,
        iban: String,
        tel: String,
        email: String, // Seulement si orgaAdvancedMode = true
        rc: String, // "Oui" / "Non"
        rcPolice: String,
        secAssurance: String, // "Oui" / "Non"
        secType: String,
        secCie: String,
        secPolice: String
      }
    ],
    intervenants: [
      {
        id: String,
        nom: String,
        prenom: String,
        role: String,
        societe: String,
        tel: String,
        email: String
      }
    ]
  },

  frais: {
    title: String,
    lignes: [
      {
        id: String,
        index: Number, // 1, 2, 3...
        prestataire: String,
        type: String,
        ref: String,
        desc: String,
        annexReference: String, // ex: "Devis JSS (Annexe 1 - Pages 4 à 7)"
        compteDeCourt: String, // ex: "Jean Dupont (RDC)"
        montantFormate: String, // ex: "150,00"
        typeMontant: String, // "HTVA", "TVAC", "Forfait"
        isFranchise: Boolean,
        avisCouverture: String // "Oui" / "Non"
      }
    ],
    totalFraisFormate: String, // ex: "1500,00"
    totalFraisNum: Number,
    // Décomptes générés uniquement si showSubtotals = true
    decomptes: [
      {
        compteDeCourt: String,
        htvaFormate: String,
        tvacFormate: String,
        forfaitFormate: String,
        franchiseFormate: String,
        htvaNum: Number,
        tvacNum: Number,
        forfaitNum: Number,
        franchiseNum: Number,
        lignes: [
          // Réplique simplifiée des lignes pour ce compte
          { prestataire: String, desc: String, montantFormate: String, typeMontant: String, avisCouverture: String }
        ]
      }
    ]
  },

  photos: {
    title: String,
    occupantsWithPhotos: [
      {
        id: String,
        nom: String, // Nom de l'occupant
        annexReference: String // ex: "Photos de Jean (Annexe 5 - Pages 10 à 12)"
      }
    ]
  },

  divers: {
    title: String,
    texte: String
  },

  // Tableau dynamique pour les blocs custom
  customBlocks: [
    {
      id: String, // "custom_XXX"
      title: String, // optionnel
      text: String
    }
  ]
}
```
