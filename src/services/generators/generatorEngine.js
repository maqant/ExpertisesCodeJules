// v6.0.0 - Context Vault & Mail Generator
import { buildDeclarationPrompt } from './templates/declarationMail.js';
import { withRetry } from '../utils/aiHelpers.js';
import { usePromptStore } from '../../store/promptStore.js';
import { buildAiPayload } from '../../ai/ai.resolver.js';
import { sanitizeAiConfig } from '../../ai/ai.config.js';
import { AI_ROLES } from '../../ai/ai.catalog.js';

/**
 * Registre des templates disponibles.
 * Pour ajouter un nouveau type de document, il suffit d'ajouter une entrée ici.
 */
const TEMPLATES = {
    declaration: buildDeclarationPrompt,
};

/**
 * generateDocument — Moteur de génération documentaire scalable.
 * 
 * Appelle OpenAI avec le bon template pour produire un document formaté
 * à partir des données du dossier et du Context Vault.
 * 
 * @param {string} type - Le type de document à générer (ex: 'declaration')
 * @param {Object} dossierState - { formData, rawContexts, references }
 * @param {string} apiKey - Clé API OpenAI
 * @param {string} [model='gpt-5.4'] - Modèle à utiliser (v6.1.0 : gpt-5.4)
 * @returns {Promise<string>} Le texte généré
 */
/**
 * Exécute l'analyse Brio Prep
 *
 * @param {string} mailText - Le texte brut de l'email
 * @param {string} apiKey - Clé API OpenAI
 * @param {string} promptTemplate - Le template du prompt (prompt_brio_prep)
 * @returns {Promise<Object>} Le JSON extrait
 */
export const runBrioPrepAnalysis = async (mailText, apiKey, promptTemplate) => {
    const prompt = promptTemplate.replace('{{declaration_brute}}', mailText);

    const callApi = async () => {
        const configStr = localStorage.getItem('expertise_aiConfig_v2');
        const config = sanitizeAiConfig(configStr ? JSON.parse(configStr) : {});
        const resolvedApiKey = apiKey || config.apiKey || import.meta.env.VITE_OPENAI_API_KEY;

        const payload = buildAiPayload(
            config,
            AI_ROLES.SYNTHESIS,
            [
                { role: 'user', content: prompt }
            ],
            { forceJsonResponse: true }
        );

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resolvedApiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`API ${response.status}: ${errBody}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;

        if (!text) {
            throw new Error('[Brio Prep] Réponse vide de l\'API.');
        }

        return JSON.parse(text);
    };

    return withRetry(callApi, 1, 2000);
};

export const generateDocument = async (type, dossierState, apiKey) => {
    const builder = TEMPLATES[type];
    if (!builder) {
        throw new Error(`[Generator] Template inconnu : "${type}". Templates disponibles : ${Object.keys(TEMPLATES).join(', ')}`);
    }

    const { systemPrompt, userContent } = builder(dossierState);

    console.log(`[Generator] 📝 Génération type="${type}"`);
    console.log(`[Generator] Context Vault : ${(dossierState.rawContexts || []).length} entrée(s)`);

    // v5.9.3 - Smart Retry & Résilience
    const callApi = async () => {
        const configStr = localStorage.getItem('expertise_aiConfig_v2');
        const config = sanitizeAiConfig(configStr ? JSON.parse(configStr) : {});
        const resolvedApiKey = apiKey || config.apiKey || import.meta.env.VITE_OPENAI_API_KEY;

        const payload = buildAiPayload(
            config,
            AI_ROLES.SYNTHESIS,
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ],
            { forceJsonResponse: false, maxTokensOverride: 2000 }
        );

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resolvedApiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`API ${response.status}: ${errBody}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;

        if (!text) {
            throw new Error('[Generator] Réponse vide de l\'API.');
        }

        return text;
    };

    return withRetry(callApi, 1, 2000);
};

/**
 * generateAcknowledgmentEmail — Générateur d'Accusé de Réception v2
 *
 * Utilise un prompt strict (prompt_ar_generator) avec les variables validées par l'UI.
 */
export const generateAcknowledgmentEmail = async (dossierData, formSelections, apiKey) => {
    const { getPrompt } = usePromptStore.getState();
    const generatorPrompt = getPrompt('prompt_ar_generator');

    // Extraire le nom du client (le premier occupant pertinent)
    let nomClient = "Client";
    if (dossierData.occupants && dossierData.occupants.length > 0) {
        const principal = dossierData.occupants.find(o => o.statut === "Propriétaire occupant" || o.statut === "Locataire") || dossierData.occupants[0];
        nomClient = `${principal.nom || ''} ${principal.prenom || ''}`.trim() || "Client";
    }

    const dateSinistre = dossierData.formData?.dateSinistre || '[Date inconnue]';
    const adresseBien = dossierData.formData?.adresse || '[Adresse inconnue]';
    
    const montantFranchise = formSelections.franchiseInput || '0€';
    const demandeDevis = formSelections.askDevis === true ? 'true' : 'false';
    const demandePlainte = formSelections.askPlainte === true ? 'true' : 'false';
    const causeDetail = formSelections.askCauseDetail === true ? 'true' : 'false';

    // Formater les demandes spécifiques aux parties
    let demandesPartiesStr = '';
    if (formSelections.partiesGaps && formSelections.partiesGaps.length > 0) {
        // Filtrer les parties qui ont au moins un manque coché
        const partiesAvecManques = formSelections.partiesGaps.filter(p => p.manques && p.manques.length > 0);
        if (partiesAvecManques.length > 0) {
            demandesPartiesStr = JSON.stringify(partiesAvecManques.map(p => ({
                nom: `${p.nom} ${p.prenom}`.trim(),
                manques: p.manques
            })), null, 2);
        }
    }

    if (!demandesPartiesStr) {
        demandesPartiesStr = '[]';
    }

    // Interpolation des variables
    const promptContent = generatorPrompt
        .replace(/{{nom_client}}/g, nomClient)
        .replace(/{{date_sinistre}}/g, dateSinistre)
        .replace(/{{adresse_bien}}/g, adresseBien)
        .replace(/{{montant_franchise}}/g, montantFranchise)
        .replace(/{{demande_devis}}/g, demandeDevis)
        .replace(/{{demande_plainte}}/g, demandePlainte)
        .replace(/{{cause_detail}}/g, causeDetail)
        .replace(/{{demandes_parties}}/g, demandesPartiesStr);

    const callApi = async () => {
        const configStr = localStorage.getItem('expertise_aiConfig_v2');
        const config = sanitizeAiConfig(configStr ? JSON.parse(configStr) : {});
        const resolvedApiKey = apiKey || config.apiKey || import.meta.env.VITE_OPENAI_API_KEY;

        const payload = buildAiPayload(
            config,
            AI_ROLES.SYNTHESIS,
            [
                { role: 'user', content: promptContent }
            ],
            { forceJsonResponse: false }
        );

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${resolvedApiKey}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`API AR Generator ${response.status}: ${errBody}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        if (!text) throw new Error('[Generator] Réponse vide de l\'API (AR).');
        return text;
    };

    console.log("[Generator] Lancement de la génération AR (v2)");
    return withRetry(callApi, 1, 2000);
};
