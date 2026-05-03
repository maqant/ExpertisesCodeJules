/**
 * aiManager.js
 * Facade pour toutes les requêtes d'Intelligence Artificielle.
 * Gère le mode "mock" et "live" pour l'isolation complète des appels API.
 */

// Utilitaire de conversion File -> Base64
const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
};

/**
 * Fonction principale d'extraction de données.
 * @param {File} file Le document (ex: Facture, Devis) sous forme d'objet File
 * @param {string} documentType Le type de document ("facture", "devis", "contrat")
 * @returns {Promise<Object>} Un objet JSON formaté pour financeStore.js
 */
export const extractDataFromDocument = async (file, documentType = 'facture', provider = 'openai', model = 'gpt-4o') => {
    const mode = import.meta.env.VITE_AI_MODE || 'mock';

    if (mode === 'mock') {
        console.log(`[AI Mock] Extraction démarrée pour un document de type: ${documentType}...`);

        // Simulation d'un délai réseau (2s)
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log(`[AI Mock] Extraction terminée avec succès.`);

        // Faux JSON formaté parfaitement pour la base de données
        return {
            success: true,
            data: {
                expenses: [
                    {
                        id: crypto.randomUUID(),
                        prestataire: "Plomberie Dubois & Fils",
                        type: documentType === 'facture' ? 'Facture' : 'Devis',
                        ref: "FAC-2026-042",
                        desc: "Recherche de fuite et réparation provisoire",
                        compteDe: "unassigned", // Ou l'UUID d'un occupant spécifique si le prompt le permettait
                        montantReclame: "450.50",
                        typeMontant: "HTVA"
                    }
                ]
            }
        };
    }

    if (mode === 'live') {
        const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
        if (!apiKey) {
            return {
                success: false,
                error: "La clé API OpenAI n'est pas configurée dans le fichier .env.local."
            };
        }

        try {
            console.log(`[AI Live] Envoi de la requête à l'API OpenAI pour un document de type: ${documentType}...`);

            const base64Image = await fileToBase64(file);

            // Payload générique pour un modèle multimodal (ex: gpt-4o)
            const payload = {
                model: model,
                messages: [
                    {
                        role: "system",
                        content: `Tu es un assistant expert en extraction de données pour l'expertise incendie.
Extrais les informations de ce document (${documentType}) et renvoie STRICTEMENT un JSON valide respectant ce format :
{
  "expenses": [
    {
      "prestataire": "Nom de l'entreprise",
      "type": "Facture ou Devis",
      "ref": "Numéro de référence",
      "desc": "Description courte des travaux",
      "montantReclame": "Montant sous format texte avec point (ex: 450.50)",
      "typeMontant": "HTVA, TVA ou FORFAIT"
    }
  ]
}
Ne renvoie aucun autre texte, juste le JSON.`
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Voici le document à analyser." },
                            {
                                type: "image_url",
                                image_url: { url: base64Image }
                            }
                        ]
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 500,
                temperature: 0.1
            };

            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `Erreur API HTTP ${response.status}`);
            }

            const data = await response.json();
            const contentString = data.choices[0].message.content;

            // Parse le JSON de la réponse
            const parsedData = JSON.parse(contentString);

            // S'assurer de générer un UUID pour chaque frais retourné par l'IA
            if (parsedData.expenses && Array.isArray(parsedData.expenses)) {
                parsedData.expenses = parsedData.expenses.map(exp => ({
                    ...exp,
                    id: crypto.randomUUID(),
                    compteDe: exp.compteDe || "unassigned" // Sécurité
                }));
            }

            return {
                success: true,
                data: parsedData
            };

        } catch (error) {
            console.error("[AI Live] Erreur lors de l'extraction :", error);
            return {
                success: false,
                error: error.message || "Une erreur inconnue est survenue lors de l'appel à l'IA."
            };
        }
    }

    // Fallback de sécurité
    return {
        success: false,
        error: "Le mode IA (VITE_AI_MODE) n'est ni 'mock' ni 'live'."
    };
};
