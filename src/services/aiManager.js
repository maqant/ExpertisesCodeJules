/**
 * aiManager.js
 * Facade pour toutes les requêtes d'Intelligence Artificielle.
 * Gère le mode "mock" et "live" pour l'isolation complète des appels API.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configurer le worker PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// Utilitaire de conversion File -> Base64
const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
};

// Utilitaire pour extraire la première page d'un PDF sous forme d'image Base64
const pdfToBase64Image = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    const scale = 1.5;
    const viewport = page.getViewport({ scale });

    // Créer un canvas HTML
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Rendre la page sur le canvas
    await page.render({ canvasContext: context, viewport: viewport }).promise;

    // Convertir en base64
    return canvas.toDataURL('image/jpeg', 0.8);
};

/**
 * Fonction principale d'extraction de données.
 * @param {File} file Le document (ex: Facture, Devis) sous forme d'objet File
 * @param {string} documentType Le type de document ("facture", "devis", "contrat")
 * @returns {Promise<Object>} Un objet JSON formaté pour financeStore.js
 */
export const extractDataFromDocument = async (files, documentType = 'facture', provider = 'openai', model = 'gpt-4o', providedApiKey = null) => {
    // Ensure files is an array
    const fileArray = Array.isArray(files) ? files : [files];

    // Determine the actual mode: Force "live" if an API key is available, otherwise fallback to "mock"
    const apiKey = providedApiKey || import.meta.env.VITE_OPENAI_API_KEY;
    const mode = apiKey ? 'live' : 'mock';

    if (mode === 'mock') {
        console.log(`[AI Mock] Aucune clé API trouvée. Extraction simulée pour un document de type: ${documentType}...`);

        // Simulation d'un délai réseau (2s)
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log(`[AI Mock] Extraction terminée avec succès.`);

        if (documentType === 'annexe') {
            return {
                success: true,
                data: { title: "Justificatif de remplacement de la chaudière" }
            };
        } else if (documentType === 'cause') {
            return {
                success: true,
                data: {
                    cause: "Le sinistre trouve son origine dans la rupture d'un joint d'étanchéité au niveau du raccordement du lave-vaisselle dans la cuisine. Cette rupture, consécutive à l'usure normale, a entraîné un écoulement d'eau lent et continu sous les meubles encastrés, endommageant la chape et les revêtements de sol."
                }
            };
        }

        // Faux JSON formaté parfaitement pour la base de données
        if (documentType === 'contrat') {
            return {
                success: true,
                data: {
                    nomCie: "Assurances ABC",
                    nomContrat: "Top Habitation Idéal",
                    numPolice: "POL-123456789",
                    numConditionsGenerales: "CG-2023-V2",
                    franchise: "250",
                    adresse: "123 Rue de la Paix, 75000 Paris",
                    pertesIndirectes: "10%"
                }
            };
        } else {
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
                            compteDe: "unassigned",
                            montantReclame: "450.50",
                            typeMontant: "HTVA"
                        }
                    ]
                }
            };
        }
    }

    if (mode === 'live') {
        try {
            console.log(`[AI Live] Envoi de la requête à l'API OpenAI pour un document de type: ${documentType}...`);

            // Multi-files logic for vision
            const contentArray = [{ type: "text", text: "Voici le(s) document(s) à analyser." }];

            for (const file of fileArray) {
                let base64Image;
                if (file.type === 'application/pdf') {
                    base64Image = await pdfToBase64Image(file);
                } else if (file.type.startsWith('image/')) {
                    base64Image = await fileToBase64(file);
                } else {
                     return {
                        success: false,
                        error: "Format de fichier non supporté. Veuillez utiliser un PDF ou une image."
                    };
                }
                contentArray.push({
                    type: "image_url",
                    image_url: { url: base64Image }
                });
            }

            // Payload générique pour un modèle multimodal (ex: gpt-4o)
            const payload = {
                model: model,
                messages: [
                    {
                        role: "system",
                        content: documentType === 'annexe'
                            ? `Tu es un assistant administratif. Lis ce document et donne-lui un titre clair, professionnel et très concis (maximum 1 ou 2 lignes). Ce titre servira de légende dans un rapport d'expertise. Ne réponds QUE par le texte du titre, sans guillemets, sans introduction ni formules de politesse.`
                            : documentType === 'cause'
                            ? `Tu es un expert en assurances. Je vais te donner un ou plusieurs documents (rapport de recherche de fuite, mail, devis). Ta mission est d'extraire et de synthétiser l'origine, la cause et les circonstances du sinistre de manière professionnelle, concise et factuelle. Ne réponds QUE par le paragraphe de synthèse, sans introduction.`
                            : `Tu es un assistant expert en extraction de données pour l'expertise incendie.
Extrais les informations de ce document (${documentType}) et renvoie STRICTEMENT un JSON valide respectant ce format :
${documentType === 'contrat' ? `{
  "nomCie": "Nom de la compagnie d'assurance",
  "nomContrat": "Nom du produit d'assurance (ex: Top Habitation)",
  "numPolice": "Numéro de police ou numéro du contrat",
  "numConditionsGenerales": "Numéro ou référence exacte des Conditions Générales appliquées au contrat",
  "franchise": "Montant ou règle de la franchise",
  "adresse": "Adresse complète du risque assuré",
  "pertesIndirectes": "Pourcentage des pertes indirectes (Doit être STRICTEMENT '0%', '5%', '10%', ou '' si non trouvé)"
}` : `{
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
}`}
Ne renvoie aucun autre texte, juste le JSON.`
                    },
                    {
                        role: "user",
                        content: contentArray
                    }
                ],
                response_format: (documentType === 'cause' || documentType === 'annexe') ? { type: "text" } : { type: "json_object" },
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

            if (documentType === 'annexe') {
                return {
                    success: true,
                    data: { title: contentString.trim() }
                };
            } else if (documentType === 'cause') {
                return {
                    success: true,
                    data: { cause: contentString.trim() }
                };
            } else {
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
            }

        } catch (error) {
            console.error("[aiManager] AI Live extraction error :", error);
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
