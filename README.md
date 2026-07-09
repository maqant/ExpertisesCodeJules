# Expertises Code Jules

## Contrats d’architecture pour agents IA

Cette section est un contrat d’architecture prioritaire pour tout agent IA ou développeur intervenant sur le projet.

Avant toute analyse, correction, refonte ou génération de code, l’agent doit lire cette section et respecter strictement ses règles.

### 1. Principe général

L’application sépare strictement :

- les données métier ;
- le rendu Web ;
- le rendu PDF natif.

Le système d’impression/PDF repose sur une source de vérité unique : `reportData`.

Flux attendu :

```txt
Stores / Context existants
        ↓
buildPrintReportData(...)
        ↓
reportData JSON pur
        ↓
├── rendu Web modulaire
└── rendu PDF natif @react-pdf/renderer
```

Aucun composant ne doit contourner ce contrat.

### 2. Contrat reportData

`reportData` est l’objet universel consommé par le rendu Web et le moteur PDF.

Il doit rester 100 % sérialisable en JSON natif.

Sont autorisés :

- string ;
- number ;
- boolean ;
- null ;
- array ;
- object simple.

Sont interdits dans `reportData` :

- fonctions ;
- composants React ;
- éléments JSX ;
- Date brute ;
- File ;
- Blob ;
- Map ;
- Set ;
- instance de classe ;
- Promise ;
- HTMLElement ;
- référence DOM ;
- valeur métier importante stockée en undefined.

Pourquoi :

Le pipeline PDF peut effectuer des copies profondes via `JSON.stringify` / `JSON.parse`. Ce choix est sécurisé uniquement si `reportData` reste du JSON pur.

Exemples corrects :

```json
dateSinistre: "2026-07-09"
amount: 123.45
annexReference: "JSS Débouchage (Annexe 1 - Pages 4 à 7)"
```

Exemples interdits :

```javascript
dateSinistre: new Date()
file: new File(...)
blob: new Blob(...)
formatter: () => {}
```

Si une donnée doit être transmise au PDF, elle doit d’abord être convertie en valeur JSON simple.

### 3. Adaptateur de données

Le fichier de référence est :

`src/features/print/printDataAdapter.js`

La fonction principale est :

`buildPrintReportData(...)`

Règles :

- elle prépare les données du rapport ;
- elle retourne un objet reportData pur ;
- elle ne doit pas retourner de fonction ;
- elle ne doit pas retourner de composant React ;
- elle ne doit pas dépendre du DOM ;
- elle ne doit pas injecter de Context ou de store dans reportData.

Toute nouvelle donnée destinée au rendu Web ou PDF doit passer par cet adaptateur.

### 4. Règles du rendu Web

Le rendu Web se trouve dans :

`src/features/print/web/`

Règles :

- les composants Web consomment reportData ;
- ils peuvent utiliser React classique, HTML, CSS et Tailwind ;
- ils ne doivent pas refaire de calcul métier lourd ;
- ils ne doivent pas modifier reportData ;
- ils ne doivent pas contenir de logique PDF ;
- ils ne doivent pas importer depuis `src/features/print/pdf/`.

`PrintPreviewWeb.jsx` doit rester un orchestrateur.

Il lit :

`reportData.meta.orderedBlocks`

et délègue le rendu aux composants Web spécialisés.

### 5. Règles du moteur PDF natif

Le moteur PDF se trouve dans :

`src/features/print/pdf/`

Il utilise strictement :

`@react-pdf/renderer`

Sont interdits dans tout le dossier PDF :

- useContext;
- createContext;
- accès direct à un store global ;
- import depuis le dossier Web ;
- window.print;
- document;
- querySelector;
- html2canvas;
- jsPDF;
- PDFDownloadLink;
- composants HTML natifs : div, span, table, tr, td.

Les composants PDF doivent utiliser uniquement les primitives React-PDF :

- Document;
- Page;
- View;
- Text;
- Image;
- Link.

`PDFReportDocument.jsx` reçoit uniquement :

```jsx
<PDFReportDocument reportData={reportData} />
```

Aucune donnée ne doit être récupérée directement depuis un Context, un store ou le DOM dans le moteur PDF.

### 6. Génération PDF

La génération PDF doit être asynchrone et déclenchée explicitement par l’utilisateur.

Méthode obligatoire :

```jsx
pdf(<PDFReportDocument reportData={resolvedReportData} />).toBlob()
```

Méthodes interdites :

- PDFDownloadLink;
- génération automatique au changement de props ;
- impression navigateur comme export PDF officiel ;
- conversion HTML vers PDF ;
- capture canvas.

La fonction publique attendue est :

`generatePdfReportBlob({ reportData })`

Elle doit retourner un Blob PDF.

### 7. Images dans le PDF

Le moteur PDF ne doit jamais recevoir un UUID brut, un dbKey brut ou une référence IndexedDB brute comme source d’image.

Avant génération PDF :

```txt
reportData brut
        ↓
resolvePdfImageBlobUrls(reportData)
        ↓
reportData prêt PDF avec Blob URLs
        ↓
pdf().toBlob()
        ↓
revokePdfImageBlobUrls(...)
```

Règles :

- les images doivent être résolues avant l’instanciation de PDFReportDocument ;
- les UUIDs doivent être convertis en blob: URL ou data URL ;
- l’objet original ne doit pas être muté ;
- si un UUID brut reste présent au moment de générer le PDF, la génération doit échouer explicitement ;
- les Blob URLs doivent être libérées via URL.revokeObjectURL.

Attention : reportData doit rester JSON pur. Ne jamais y injecter directement un Blob, un File ou une instance non sérialisable.

### 8. Références d’annexes dans les frais

Chaque ligne de frais peut contenir :

`annexReference: "JSS Débouchage (Annexe 1 - Pages 4 à 7)"`

Cette référence doit toujours être rendue sous la description principale.

Elle ne peut jamais être déplacée dans une colonne séparée.

Rendu attendu :

```txt
Description principale du frais
JSS Débouchage (Annexe 1 - Pages 4 à 7)
```

Style Web attendu :

- plus petit ;
- italique ;
- gris/muted ;
- placé sous la description.

Style PDF obligatoire dans pdfStyles.js :

```javascript
annexReference: {
  fontSize: 8,
  fontStyle: 'italic',
  color: '#64748b'
}
```

Dans le PDF, PDFFeesTableRow.jsx doit utiliser strictement :

`styles.annexReference`

Aucun style inline alternatif n’est autorisé pour cette référence.

### 9. Pagination PDF des tableaux de frais

Les lignes de frais doivent être indivisibles.

Dans le PDF :

- wrap={false} doit être appliqué au niveau de la ligne de frais ;
- la description et annexReference doivent rester dans le même bloc ;
- une référence d’annexe ne peut jamais être orpheline sur une autre page.

Correct :

```jsx
<View wrap={false}>
  <Text>Description</Text>
  <Text style={styles.annexReference}>Annexe...</Text>
</View>
```

À éviter :

- wrap={false} sur tout le tableau ;
- wrap={false} sur une section entière très longue ;
- calcul de hauteur basé sur le DOM ;
- découpage manuel fragile en pixels.

Attention : Si une seule ligne de frais devient plus haute qu’une page complète, React-PDF ne peut pas garantir une pagination parfaite. Dans ce cas, limiter le contenu, le condenser ou documenter explicitement ce cas.

### 10. Sommaire PDF interactif

Les ancres PDF doivent être centralisées et stables.

Le sommaire doit :

- lister uniquement les sections présentes dans reportData.meta.orderedBlocks ;
- utiliser des liens internes compatibles React-PDF ;
- pointer vers des sections réellement rendues ;
- ne pas créer de lien mort.

Exemple conceptuel :

```jsx
<Link src="#fees">Frais</Link>
<View id="fees">...</View>
```

### 11. Garde-fous et tests

Les tests d’architecture doivent empêcher les régressions suivantes dans `src/features/print/pdf/` :

- useContext;
- createContext;
- window.print;
- PDFDownloadLink;
- html2canvas;
- jsPDF;
- accès DOM ;
- import depuis le dossier Web.

Les tests doivent également couvrir :

- pureté JSON de buildPrintReportData;
- présence de annexReference dans les frais ;
- rendu de annexReference sous la description ;
- usage de styles.annexReference;
- lignes de frais avec wrap={false};
- génération PDF via pdf().toBlob();
- résolution des images avant PDF ;
- erreur explicite si UUID image brut ;
- nettoyage des Blob URLs.

### 12. Règle de modification

Ne pas refactorer cette architecture sans raison métier ou bug réel.

Avant toute modification :

- identifier le contrat concerné ;
- vérifier les tests existants ;
- modifier le minimum nécessaire ;
- ajouter ou adapter un test ;
- ne pas mélanger Web et PDF ;
- ne pas affaiblir les garde-fous.

### 13. Résumé prioritaire pour agent IA

Si tu es un agent IA qui scanne ce code :

- commence par lire cette section du README ;
- ne propose pas de fusionner Web et PDF ;
- ne remplace pas React-PDF par une capture HTML ;
- ne réintroduis pas PDFDownloadLink;
- ne mets pas de Context dans le PDF ;
- ne passe jamais d’UUID image brut au PDF ;
- conserve reportData en JSON pur ;
- conserve annexReference sous la description ;
- conserve styles.annexReference;
- conserve les lignes de frais indivisibles ;
- ne modifie l’architecture qu’en cas de bug réel identifié.
