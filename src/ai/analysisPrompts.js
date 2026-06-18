// src/ai/analysisPrompts.js

export const ANALYSIS_PROMPTS = {
  // Utilisé quand les métadonnées (BCE, IBAN, Polices) ne sont pas détectées
  DEBUG_METADATA: `Agis comme un ingénieur QA expert en extraction de données.
Voici le texte brut OCR d'un document. 
Ton objectif est de trouver POURQUOI nos expressions régulières ou notre agent n'a pas détecté les métadonnées clés (IBAN, Numéro d'entreprise/BCE, Numéro de police).
Identifie les anomalies OCR (espaces, zéros au lieu de O, tirets manquants).
Fournis une recommandation stricte pour améliorer l'extraction.

Document brut :
{{RAW_TEXT}}`,

  // Utilisé quand le trieur de documents (Router) se trompe
  DEBUG_ROUTER: `Agis comme un Data Scientist spécialisé en NLP.
Notre Agent Routeur a classé ce document de manière incorrecte.
Analyse la sémantique de ce texte et explique pourquoi un LLM pourrait confondre ce document avec la catégorie "X".
Donne-moi 2 phrases précises à rajouter dans le prompt système du Routeur pour corriger ce faux-positif, sans dégrader le reste.

Document brut :
{{RAW_TEXT}}`,

  // Utilisé pour vérifier pourquoi une phrase NANO est mauvaise
  DEBUG_NANO: `Agis comme un Prompt Engineer.
Notre IA NANO a généré une phrase de relance inadaptée ou avec un ton robotique à partir de la cause suivante.
Analyse la cause fournie et la phrase générée. Explique pourquoi le modèle a "dérapé" (manque de contexte, mot-clé déclencheur, etc.) et propose un correctif au prompt système pour bloquer ce comportement.

Cause originale : {{CAUSE}}
Phrase générée : {{GENERATED}}`
};
