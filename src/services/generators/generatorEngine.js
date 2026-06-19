// v8.0.0 - AR v2 : NANO + GENERATOR + FINISHER pipeline
import { buildDeclarationPrompt } from './templates/declarationMail.js';
import { withRetry } from '../utils/aiHelpers.js';
import { usePromptStore } from '../../store/promptStore.js';
import { buildAiPayload } from '../../ai/ai.resolver.js';
import { sanitizeAiConfig } from '../../ai/ai.config.js';
import { executeAiCall } from '../../ai/apiClient.js';

/**
 * Registre des templates disponibles.
 */
const TEMPLATES = {
    declaration: buildDeclarationPrompt,
};

/**
 * Exécute l'analyse Brio Prep
 */
export const runBrioPrepAnalysis = async (mailText, apiKey, promptTemplate) => {
    const prompt = promptTemplate.replace('{{declaration_brute}}', mailText);

    const callApi = async () => {
        const configStr = localStorage.getItem('expertise_aiConfig_v3');
        const config = sanitizeAiConfig(configStr ? JSON.parse(configStr) : {});
        const resolvedApiKey = apiKey || config.apiKey || import.meta.env.VITE_OPENAI_API_KEY;

        const payload = buildAiPayload(
            config,
            'brio_summary',
            [{ role: 'user', content: prompt }],
            { forceJsonResponse: true }
        );

        const data = await executeAiCall({ apiKey: resolvedApiKey, payload, componentId: 'brio_summary' });
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new Error('[Brio Prep] Réponse vide de l\'API.');
        return JSON.parse(text);
    };

    return withRetry(callApi, 1, 2000);
};

/**
 * generateDocument — Moteur de génération documentaire scalable.
 */
export const generateDocument = async (type, dossierState, apiKey) => {
    const builder = TEMPLATES[type];
    if (!builder) {
        throw new Error(`[Generator] Template inconnu : "${type}". Templates disponibles : ${Object.keys(TEMPLATES).join(', ')}`);
    }

    const { systemPrompt, userContent } = builder(dossierState);

    const callApi = async () => {
        const configStr = localStorage.getItem('expertise_aiConfig_v3');
        const config = sanitizeAiConfig(configStr ? JSON.parse(configStr) : {});
        const resolvedApiKey = apiKey || config.apiKey || import.meta.env.VITE_OPENAI_API_KEY;

        const payload = buildAiPayload(
            config,
            'final_document',
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ],
            { forceJsonResponse: false, maxTokensOverride: 2000 }
        );

        const data = await executeAiCall({ apiKey: resolvedApiKey, payload, componentId: 'final_document' });
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new Error('[Generator] Réponse vide de l\'API.');
        return text;
    };

    return withRetry(callApi, 1, 2000);
};

// ─────────────────────────────────────────────────────────────────────────────
// AR v2 PIPELINE : NANO → GENERATOR → FINISHER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * analyzeNarrativeCause — NANO IA (micro-appel)
 * 
 * Analyse la cause du sinistre et génère UNE phrase ciblée de relance.
 * Retourne null en cas d'échec (dégradation explicite, jamais silencieuse).
 * 
 * @param {string} cause - La cause du sinistre (formData.cause)
 * @param {string} apiKey - Clé API OpenAI
 * @returns {Promise<string|null>}
 */
export const analyzeNarrativeCause = async (cause, apiKey) => {
    if (!cause || String(cause).trim().length < 5) return null;

    const { getPrompt } = usePromptStore.getState();
    const nanoPrompt = getPrompt('prompt_ar_nano').replace('{{cause}}', String(cause).trim());

    try {
        const callApi = async () => {
            const configStr = localStorage.getItem('expertise_aiConfig_v3');
            const config = sanitizeAiConfig(configStr ? JSON.parse(configStr) : {});
            const resolvedApiKey = apiKey || config.apiKey || import.meta.env.VITE_OPENAI_API_KEY;

            const payload = buildAiPayload(
                config,
                'ar_nano',
                [{ role: 'user', content: nanoPrompt }],
                { forceJsonResponse: false }
            );

            const data = await executeAiCall({ apiKey: resolvedApiKey, payload, componentId: 'ar_nano' });
            const text = data.choices?.[0]?.message?.content?.trim();
            if (!text) throw new Error('[AR Nano] Réponse vide.');
            return text;
        };

        console.log('[Generator] Lancement NANO cause AR');
        return await withRetry(callApi, 1, 1000);
    } catch (err) {
        console.warn('[AR Nano] Échec non-bloquant :', err.message);
        return null; // Dégradation explicite
    }
};

/**
 * generateAcknowledgmentEmail — Générateur AR v2
 * 
 * Construit le mail structuré avec les nouvelles variables :
 * causeNanoPhrase, askPhotos, photosParties, devisParties, perteContenu, demandePlainte, partiesGaps.
 * 
 * @param {Object} dossierData - { formData, occupants, expenses }
 * @param {Object} formSelections - Sélections de l'UI
 * @param {string} apiKey
 * @returns {Promise<string>}
 */
export const generateAcknowledgmentEmail = async (dossierData, formSelections, apiKey) => {
    const { getPrompt } = usePromptStore.getState();
    const generatorPrompt = getPrompt('prompt_ar_generator');

    // Nom du client principal
    let nomClient = 'Client';
    if (dossierData.occupants && dossierData.occupants.length > 0) {
        const principal = dossierData.occupants.find(
            o => o.statut === 'Propriétaire occupant' || o.statut === 'Locataire'
        ) || dossierData.occupants[0];
        nomClient = `${principal.nom || ''} ${principal.prenom || ''}`.trim() || 'Client';
    }

    const dateSinistre = dossierData.formData?.dateSinistre || '[Date inconnue]';
    const adresseBien = dossierData.formData?.adresse || '[Adresse inconnue]';
    const montantFranchise = formSelections.franchiseInput || '0€';

    // Nouvelles variables v2
    const causeNanoPhrase = formSelections.causeNanoPhrase || '';
    const askPhotos = formSelections.askPhotos === true ? 'true' : 'false';
    const photosPartiesStr = JSON.stringify(
        (formSelections.photosParties || []).map(p => ({ nom: `${p.nom} ${p.prenom}`.trim(), statut: p.statut })),
        null, 2
    );
    const devisPartiesStr = JSON.stringify(
        (formSelections.devisParties || []).map(p => ({ nom: `${p.nom} ${p.prenom}`.trim(), statut: p.statut })),
        null, 2
    );
    const perteContenu = formSelections.askPerteContenu === true ? 'true' : 'false';
    const demandePlainte = formSelections.askPlainte === true ? 'true' : 'false';
    const demandePv = formSelections.askPvPolice === true ? 'true' : 'false';

    // Demandes par parties (documents manquants)
    let demandesPartiesStr = '[]';
    if (formSelections.partiesGaps && formSelections.partiesGaps.length > 0) {
        const avecManques = formSelections.partiesGaps.filter(p => p.manques && p.manques.length > 0);
        if (avecManques.length > 0) {
            demandesPartiesStr = JSON.stringify(
                avecManques.map(p => ({ nom: `${p.nom} ${p.prenom}`.trim(), manques: p.manques })),
                null, 2
            );
        }
    }

    const promptContent = generatorPrompt
        .replace(/{{nom_client}}/g, nomClient)
        .replace(/{{date_sinistre}}/g, dateSinistre)
        .replace(/{{adresse_bien}}/g, adresseBien)
        .replace(/{{montant_franchise}}/g, montantFranchise)
        .replace(/{{cause_nano_phrase}}/g, causeNanoPhrase)
        .replace(/{{ask_photos}}/g, askPhotos)
        .replace(/{{photos_parties}}/g, photosPartiesStr)
        .replace(/{{devis_parties}}/g, devisPartiesStr)
        .replace(/{{perte_contenu}}/g, perteContenu)
        .replace(/{{demande_plainte}}/g, demandePlainte)
        .replace(/{{demande_pv}}/g, demandePv)
        .replace(/{{demandes_parties}}/g, demandesPartiesStr)
        .replace(/\{\{salutation\}\}/g, formSelections.salutation || 'Bonjour,')
        .replace(/\(\(salutation\)\)/g, formSelections.salutation || 'Bonjour,');

    const callApi = async () => {
        const configStr = localStorage.getItem('expertise_aiConfig_v3');
        const config = sanitizeAiConfig(configStr ? JSON.parse(configStr) : {});
        const resolvedApiKey = apiKey || config.apiKey || import.meta.env.VITE_OPENAI_API_KEY;

        const payload = buildAiPayload(
            config,
            'ar_modal',
            [{ role: 'user', content: promptContent }],
            { forceJsonResponse: false }
        );

        const data = await executeAiCall({ apiKey: resolvedApiKey, payload, componentId: 'ar_modal' });
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new Error('[Generator] Réponse vide de l\'API (AR).');
        return text;
    };

    console.log('[Generator] Lancement génération AR v2');
    return withRetry(callApi, 1, 2000);
};

/**
 * runArFinisher — IA Balais AR
 * 
 * Naturalise le mail structuré pour qu'il semble rédigé par un gestionnaire humain.
 * 
 * RÈGLE DE SÉCURITÉ (Claude) :
 * - Reçoit un digest borné (cause + max 800 chars rawContexts), JAMAIS les rawContexts bruts.
 * - Valide que chaque demande clé du mail original est toujours présente dans le texte finalisé.
 * - En cas d'échec ou de violation : retourne le texte original avec un warning.
 * 
 * @param {string} mailText - Mail structuré du GENERATOR
 * @param {Object} dossierData - { formData, rawContexts? }
 * @param {string} apiKey
 * @returns {Promise<{ text: string, finisherApplied: boolean, warning?: string }>}
 */
export const runArFinisher = async (mailText, dossierData, apiKey) => {
    const { getPrompt } = usePromptStore.getState();
    const finisherPrompt = getPrompt('prompt_ar_finisher');

    // Construire le digest borné (Claude : max ~800 tokens de contexte)
    const cause = String(dossierData.formData?.cause ?? '').trim();
    let declarationDigest = cause ? `Cause : ${cause}` : '';
    
    // Ajouter un extrait des rawContexts si disponibles, borné à ~800 chars
    const rawContexts = dossierData.rawContexts || [];
    if (rawContexts.length > 0 && declarationDigest.length < 600) {
        const contextText = rawContexts
            .map(ctx => String(ctx?.content ?? ctx ?? ''))
            .join('\n')
            .slice(0, 800 - declarationDigest.length);
        declarationDigest += contextText ? `\n\nExtraits de la déclaration :\n${contextText}${contextText.length >= 800 - declarationDigest.length ? ' [...]' : ''}` : '';
    }

    const promptContent = finisherPrompt
        .replace('{{declaration_digest}}', declarationDigest || '[Aucun contexte disponible]')
        .replace('{{mail_structure}}', mailText);

    try {
        const callApi = async () => {
            const configStr = localStorage.getItem('expertise_aiConfig_v3');
            const config = sanitizeAiConfig(configStr ? JSON.parse(configStr) : {});
            const resolvedApiKey = apiKey || config.apiKey || import.meta.env.VITE_OPENAI_API_KEY;

            const payload = buildAiPayload(
                config,
                'ar_finisher',
                [{ role: 'user', content: promptContent }],
                { forceJsonResponse: false }
            );

            const data = await executeAiCall({ apiKey: resolvedApiKey, payload, componentId: 'ar_finisher' });
            const text = data.choices?.[0]?.message?.content?.trim();
            if (!text) throw new Error('[AR Finisher] Réponse vide.');
            return text;
        };

        console.log('[Generator] Lancement IA Balais AR');
        const finishedText = await withRetry(callApi, 1, 2000);

        // VALIDATION POST-FINISHER (Claude) : vérifier que les demandes clés sont toujours présentes
        const validationResult = validateFinisherOutput(mailText, finishedText);
        if (!validationResult.isValid) {
            console.warn('[AR Finisher] Validation échouée — demandes supprimées détectées. Fallback sur GENERATOR.', validationResult.missingDemands);
            return {
                text: mailText,
                finisherApplied: false,
                warning: `IA Balais échouée (${validationResult.missingDemands.length} demande(s) supprimée(s)). Mail structuré utilisé.`
            };
        }

        return { text: finishedText, finisherApplied: true };
    } catch (err) {
        console.warn('[AR Finisher] Erreur non-bloquante :', err.message);
        return {
            text: mailText,
            finisherApplied: false,
            warning: 'IA Balais indisponible. Mail structuré utilisé.'
        };
    }
};

/**
 * validateFinisherOutput — Vérifie que les demandes clés du mail structuré sont dans le texte finalisé.
 * Heuristique : les lignes en **gras** dans le mail original doivent toujours être présentes.
 */
function validateFinisherOutput(originalText, finishedText) {
    // Extraire les mots-clés des titres gras (ex: **Documents relatifs aux réparations**)
    const boldMatches = originalText.match(/\*\*([^*]+)\*\*/g) || [];
    const keyDemands = boldMatches
        .map(m => m.replace(/\*\*/g, '').trim())
        .filter(k => k.length > 5);

    const missingDemands = keyDemands.filter(demand => {
        // Vérification tolérante : les 4 premiers mots doivent être présents
        const words = demand.split(' ').slice(0, 4).join(' ').toLowerCase();
        return !finishedText.toLowerCase().includes(words);
    });

    return {
        isValid: missingDemands.length === 0,
        missingDemands
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL LIBRE ITÉRATIF
// ─────────────────────────────────────────────────────────────────────────────

/**
 * draftMagicEmail — Rédige le premier jet d'un e-mail libre
 */
export const draftMagicEmail = async (instruction, salutation, apiKey) => {
    if (!instruction || !instruction.trim()) return '';

    const { getPrompt } = usePromptStore.getState();
    const masterPrompt = getPrompt('prompt_email_master')
        .replace(/\{\{instruction\}\}/g, instruction.trim())
        .replace(/\{\{salutation\}\}/g, salutation || 'Bonjour,')
        .replace(/\(\(salutation\)\)/g, salutation || 'Bonjour,');

    const callApi = async () => {
        const configStr = localStorage.getItem('expertise_aiConfig_v3');
        const config = sanitizeAiConfig(configStr ? JSON.parse(configStr) : {});
        const resolvedApiKey = apiKey || config.apiKey || import.meta.env.VITE_OPENAI_API_KEY;

        const payload = buildAiPayload(
            config,
            'draft_email',
            [{ role: 'user', content: masterPrompt }],
            { forceJsonResponse: false }
        );

        const data = await executeAiCall({ apiKey: resolvedApiKey, payload, componentId: 'draft_email' });
        const text = data.choices?.[0]?.message?.content?.trim();
        if (!text) throw new Error('[Free Email] Réponse vide.');
        return text;
    };

    console.log('[Generator] Lancement draftMagicEmail');
    return withRetry(callApi, 1, 2000);
};

/**
 * modifyDraftEmail — Itère sur un brouillon d'e-mail existant
 */
export const modifyDraftEmail = async (currentHtml, modifierKey, apiKey) => {
    if (!currentHtml || !modifierKey) return currentHtml;

    // Mapping des modificateurs
    const modifiers = {
        'rewrite': 'Conserve le sens exact et la longueur de cet e-mail, mais fluidifie la syntaxe pour qu\'elle soit plus naturelle.',
        'shorter': 'Réécris cet e-mail pour qu\'il soit significativement plus court, tout en conservant les informations essentielles et le ton professionnel.',
        'longer': 'Réécris cet e-mail pour qu\'il soit significativement plus long et plus détaillé, tout en conservant le ton professionnel.',
        'colder': 'Ajuste le ton de cet e-mail pour le rendre plus froid et strictement administratif, tout en restant courtois.',
        'warmer': 'Ajuste le ton de cet e-mail pour le rendre plus chaleureux, empathique et rassurant, tout en restant professionnel.'
    };

    const modifierText = modifiers[modifierKey] || modifierKey; // On accepte aussi un texte libre

    const { getPrompt } = usePromptStore.getState();
    const modifierPrompt = getPrompt('prompt_email_modifiers')
        .replace('{{modifier}}', modifierText)
        .replace('{{current_html}}', currentHtml);

    const callApi = async () => {
        const configStr = localStorage.getItem('expertise_aiConfig_v3');
        const config = sanitizeAiConfig(configStr ? JSON.parse(configStr) : {});
        const resolvedApiKey = apiKey || config.apiKey || import.meta.env.VITE_OPENAI_API_KEY;

        const payload = buildAiPayload(
            config,
            'modify_email',
            [{ role: 'user', content: modifierPrompt }],
            { forceJsonResponse: false }
        );

        const data = await executeAiCall({ apiKey: resolvedApiKey, payload, componentId: 'modify_email' });
        const text = data.choices?.[0]?.message?.content?.trim();
        if (!text) throw new Error('[Modify Email] Réponse vide.');
        return text;
    };

    console.log('[Generator] Lancement modifyDraftEmail avec:', modifierKey);
    return withRetry(callApi, 1, 2000);
};
