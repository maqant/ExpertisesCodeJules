// v7.1.0 - Data-Driven Deduplication
/**
 * merger.js — Agent de Synthèse (Merge Agent)
 * Étape Finale du pipeline : Nettoie et déduplique les tableaux JSON (Occupants et Frais).
 * Force l'utilisation d'un modèle ultra-rapide et peu coûteux (ex: gpt-4o-mini).
 */

export const runMergeAgent = async (occupants, expenses, providedApiKey = null, provider = 'openai') => {
    // Si la liste est vide ou très petite, inutile de payer ou d'attendre
    if ((!occupants || occupants.length <= 1) && (!expenses || expenses.length <= 1)) {
        return { success: true, data: { occupants: occupants || [], expenses: expenses || [] } };
    }

    const apiKey = providedApiKey || import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
        // Mode Mock / Pas de clé = on retourne tel quel (ou on pourrait faire un fallback JS)
        return { success: true, data: { occupants, expenses } };
    }

    // Le Merger utilise toujours le modèle le plus rapide/cheap possible.
    const mergeModel = provider === 'anthropic' ? 'claude-3-haiku-20240307' : 'gpt-4o-mini';

    const systemPrompt = `Tu es l'Agent de Synthèse (Merge Agent). Ton rôle exclusif est de dédupliquer et fusionner intelligemment deux listes d'objets JSON provenant d'extractions multiples.

RÈGLE 1 - OCCUPANTS :
- Fusionne les objets si le nom désigne manifestement la même personne (ex: "Daniel Dethier" et "DETHIER Daniel", "A.D.K" et "ADK").
- Lors de la fusion, garde le numéro de téléphone le plus complet (ex: préférer "+32..." à "0476...").
- Garde le \`id\` d'un des objets fusionnés (de préférence le premier apparu).

RÈGLE 2 - RÉCLAMATIONS (expenses) :
- Fusionne les objets si le \`prestataire\` est similaire ET que la référence \`ref\` est identique ou très proche (ex: "280261" et "Facture 280261").
- ATTENTION AUX MONTANTS : Si deux réclamations à fusionner ont des \`montantReclame\` différents (ex: 1479.11 et 1567.86), tu DOIS ABSOLUMENT conserver le montant le plus PETIT (qui correspond au montant HTVA) et définir \`typeMontant\` sur "HTVA".
- Harmonise le champ \`desc\` en gardant la description la plus détaillée.

RÈGLE 3 - INTÉGRITÉ RÉFÉRENTIELLE :
- Si tu as fusionné deux occupants (A et B) et gardé l'ID de A, tu dois remplacer tous les \`compteDe\` dans les "expenses" qui pointaient vers B pour qu'ils pointent vers A.

RÈGLE 4 - FORMAT DE SORTIE :
- Tu dois retourner STRICTEMENT et UNIQUEMENT un objet JSON valide, avec les deux tableaux \`occupants\` et \`expenses\` nettoyés.
- N'invente AUCUNE nouvelle donnée, tu ne fais que fusionner et nettoyer.

Format attendu :
{
  "occupants": [ ... ],
  "expenses": [ ... ]
}`;

    const payloadContent = JSON.stringify({ occupants, expenses }, null, 2);

    try {
        let endpoint = "https://api.openai.com/v1/chat/completions";
        let payload = {
            model: mergeModel,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: payloadContent }
            ],
            response_format: { type: "json_object" },
            temperature: 0.0 // Déterministe
        };

        let headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        };

        if (provider === 'anthropic') {
            endpoint = "https://api.anthropic.com/v1/messages";
            headers = {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerously-allow-browser": "true"
            };
            payload = {
                model: mergeModel,
                system: systemPrompt,
                messages: [{ role: "user", content: `Fusionne ce JSON et retourne uniquement un objet JSON (sans texte avant ou après) : \n${payloadContent}` }],
                max_tokens: 4096,
                temperature: 0.0
            };
        }

        const response = await fetch(endpoint, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `Erreur API HTTP ${response.status}`);
        }

        const data = await response.json();
        let content = "";
        
        if (provider === 'anthropic') {
            content = data.content[0].text;
            // Retrait manuel des backticks Markdown si présents (Haiku peut parfois les rajouter malgré les instructions)
            if (content.startsWith('```json')) content = content.replace(/^```json\s*/, '');
            if (content.endsWith('```')) content = content.replace(/\s*```$/, '');
        } else {
            content = data.choices[0].message.content;
        }

        const parsedData = JSON.parse(content);
        return { success: true, data: parsedData };

    } catch (error) {
        console.error("[merger] Erreur lors de la fusion :", error);
        // Fallback sécurisé : en cas de plantage IA ou JSON malformé, on renvoie les données d'origine (avec les doublons)
        return { success: false, data: { occupants, expenses }, error: error.message };
    }
};
