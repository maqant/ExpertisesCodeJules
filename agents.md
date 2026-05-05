# Instructions pour les Agents IA (Jules)

Bienvenue sur le projet "ExpertisesCode". Voici les règles absolues pour travailler sur cette base de code.

## 🛠 Stack Technique
*   **Framework :** React (via Vite)
*   **Styling :** Tailwind CSS (utilisation stricte des classes utilitaires, pas de CSS custom sauf exception).
*   **State Management :** 
    *   Zustand (`src/store/financeStore.js`) pour la gestion des frais, parties, et la logique financière.
    *   React Context (`src/context/ExpertiseContext.jsx`) pour les données générales du dossier.

## 🛑 Règles d'Or et Garde-fous (À LIRE ABSOLUMENT)
1.  **L'IA est sacrée :** Le code contient des fonctionnalités d'extraction IA (`ValidationAiModal.jsx`, `aiManager.js`, bouton `toggleAiMode`). Ne supprime **JAMAIS** ces imports, ces boutons ou cette logique, même s'ils te semblent inutilisés dans le fichier sur lequel tu travailles.
2.  **Uniquement le scope demandé :** Ne touche à aucun autre fichier que ceux explicitement demandés dans le prompt. Ne fais pas de "refactoring global" non sollicité.
3.  **Drag & Drop (Z-Index) :** L'application possède un overlay global pour le Drag & Drop. Si tu ajoutes une zone de drop spécifique, tu dois TOUJOURS y ajouter `e.stopPropagation()` et un `z-index` supérieur (ex: `relative z-[60]`) pour éviter les conflits avec le parent.
4.  **Composants Contrôlés :** Lors de la création de formulaires, assure-toi toujours que les champs `<select>` ou `<input>` ont une valeur par défaut définie dans le state pour éviter les erreurs de "Faux Miroir" (composants non contrôlés).

## 🚀 Workflow
*   Concentre-toi sur une seule tâche atomique à la fois.
*   Pousse directement tes correctifs sur la branche principale avec des messages de commit clairs.
