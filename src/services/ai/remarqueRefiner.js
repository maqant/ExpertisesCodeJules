// src/services/ai/remarqueRefiner.js
import { buildAiPayload } from '../../ai/ai.resolver.js';
import { executeAiCall } from '../../ai/apiClient.js';
import { sanitizeAiConfig } from '../../ai/ai.config.js';

const SYSTEM_PROMPT = [
  "Tu es un assistant de rédaction expert en courtage d'assurance.",
  "Ta seule mission : reformuler la remarque fournie par le gestionnaire en une phrase ou paragraphe clair, élégant, professionnel et concis, en français.",
  "La phrase réécrite DOIT se fondre harmonieusement dans le corps d'un e-mail d'accompagnement de paiement de sinistre.",
  "Prends en compte à qui s'adresse l'e-mail (assuré, copropriétaire, syndic, tiers) pour adapter le ton.",
  "Conserve les références de dossier, montants et faits stricts sans rien inventer ni déformer.",
  "Réponds UNIQUEMENT avec le texte reformulé, sans guillemets, sans politesses, sans préambule."
].join(' ');

/**
 * Reformule une remarque avec le nano-agent IA 'remarque_refine' (gpt-5.6-luna).
 * 
 * @param {Object} params
 * @param {string} params.remarque - La remarque brute saisie
 * @param {Object} [params.context] - Contexte du mail et du destinataire
 * @returns {Promise<string>} Le texte reformulé
 */
export async function refineRemarqueText({ remarque, context = {} }) {
    const input = (remarque ?? '').trim();
    if (!input) throw new Error('La remarque est vide : rien à affiner.');

    const configStr = localStorage.getItem('expertise_aiConfig_v3');
    const config = sanitizeAiConfig(configStr ? JSON.parse(configStr) : {});
    const apiKey = config.apiKey || import.meta.env.VITE_OPENAI_API_KEY;

    if (!apiKey) {
        throw new Error('Clé API OpenAI non configurée.');
    }

    const userPromptLines = ['Remarque à reformuler :', '---', input, '---'];
    if (context?.mailRecipientSnapshot?.displayName) {
        userPromptLines.push(`Destinataire de l'e-mail : ${context.mailRecipientSnapshot.displayName}`);
    }
    if (context?.dossierName) {
        userPromptLines.push(`Dossier : ${context.dossierName}`);
    }

    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPromptLines.join('\n') }
    ];

    const payload = buildAiPayload(config, 'remarque_refine', messages, {
        temperature: 0.2
    });

    const response = await executeAiCall({
        apiKey,
        payload,
        componentId: 'remarque_refine',
        timeoutMs: 15000
    });

    const rawResult = response?.choices?.[0]?.message?.content ?? response?.text ?? '';
    const refined = String(rawResult).trim().replace(/^["«]|["»]$/g, '');

    if (!refined) {
        throw new Error("L'IA n'a pas pu générer de reformulation.");
    }

    return refined;
}
