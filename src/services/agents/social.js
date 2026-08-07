// v6.2.0 - Personnes / Logements / Liens : fin des fusions abusives d'homonymes
/**
 * social.js — Agent Social (Générateur d'UUID)
 * Étape 3 du pipeline : extraction des personnes (occupants, experts, intervenants).
 * Ne reçoit que les documents taggués "SOCIAL".
 *
 * v6.2.0 :
 *  - Déduplication par (nom + prenom + civilite) : deux copropriétaires du même
 *    nom (couple) ne sont PLUS JAMAIS fusionnés.
 *  - Ambiguïtés homonymes (prénom manquant) => flag AMBIGUITE_HOMONYME, jamais de fusion.
 *  - Harmonisation étage via domain/logement.js (etage normalisé, etageRaw préservé).
 *  - Champs optionnels rétrocompatibles : lot, appartement, etageRaw, flags.
 */

import { processInParallelBatches, buildContentArrayParallel } from '../utils/aiHelpers.js';
import { usePromptStore } from '../../store/promptStore.js';
import { buildAiPayload } from '../../ai/ai.resolver.js';
import { sanitizeAiConfig } from '../../ai/ai.config.js';
import { AI_ROLES } from '../../ai/ai.catalog.js';
import { executeAiCall } from '../../ai/apiClient.js';
import { normalizeEtage, parseLocalisation, resolveHousingUnitId } from '../../domain/logement.js';

// ---------------------------------------------------------------------------
// Helpers purs (exportés pour testabilité)
// ---------------------------------------------------------------------------

const normStr = (v) => (v ?? '').toString().trim().toLowerCase();

/**
 * Clé d'identité d'une personne. null si pas de nom exploitable.
 * IMPORTANT : inclut le prénom ET la civilité pour ne jamais écraser
 * un conjoint / copropriétaire homonyme.
 */
export const buildPersonKey = (item) => {
  const nom = normStr(item?.nom);
  if (!nom) return null;
  return `${nom}|${normStr(item?.prenom)}|${normStr(item?.civilite)}`;
};

const addFlag = (item, flag) => {
  const flags = Array.isArray(item.flags) ? item.flags : [];
  if (!flags.includes(flag)) flags.push(flag);
  item.flags = flags;
};

/**
 * Déduplication prudente :
 *  - Fusion UNIQUEMENT si nom + prenom + civilite strictly identiques
 *    (fusion des champs non-vides, id conservé).
 *  - Même nom mais identités distinctes => JAMAIS de fusion.
 *  - Même nom + prénom manquant d'un côté => AMBIGUITE_HOMONYME sur les deux
 *    (signalé dans le Sas de Validation, décision humaine).
 */
export const deduplicatePersons = (items) => {
  const byKey = new Map();
  const byNom = new Map(); // nom -> entrées conservées (détection homonymes)
  const result = [];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const key = buildPersonKey(item);
    if (!key) { result.push(item); continue; }

    if (byKey.has(key)) {
      const existing = byKey.get(key);
      const hasDiscriminant = normStr(item?.prenom) !== '' || normStr(item?.civilite) !== '';

      if (!hasDiscriminant) {
        addFlag(item, 'AMBIGUITE_HOMONYME');
        addFlag(existing, 'AMBIGUITE_HOMONYME');
        result.push(item);
        continue;
      }

      Object.keys(item).forEach((k) => {
        if (k === 'id' || k === 'flags') return;
        const isEmpty = (v) => v === undefined || v === null || v === '' || v === false;
        if (!isEmpty(item[k]) && isEmpty(existing[k])) existing[k] = item[k];
      });
      if (Array.isArray(item.flags)) item.flags.forEach((f) => addFlag(existing, f));
      continue;
    }

    byKey.set(key, item);
    result.push(item);

    // Détection d'homonymes ambigus (même nom, prénom manquant quelque part)
    const nom = normStr(item.nom);
    if (!byNom.has(nom)) byNom.set(nom, []);
    const homonymes = byNom.get(nom);
    for (const other of homonymes) {
      const p1 = normStr(item.prenom);
      const p2 = normStr(other.prenom);
      if (p1 === '' || p2 === '') {
        addFlag(item, 'AMBIGUITE_HOMONYME');
        addFlag(other, 'AMBIGUITE_HOMONYME');
      }
    }
    homonymes.push(item);
  }

  return result;
};

// ---------------------------------------------------------------------------
// Agent Social Principal
// ---------------------------------------------------------------------------

export const extractSocialData = async (files, providedApiKey = null, onStatusChange = null) => {
    const fileArray = Array.isArray(files) ? files : [files];
    const configStr = localStorage.getItem('expertise_aiConfig_v3');
    const config = sanitizeAiConfig(configStr ? JSON.parse(configStr) : {});
    const apiKey = providedApiKey || config.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
    const mode = apiKey ? 'live' : 'mock';

    if (mode === 'mock') {
        if (onStatusChange) onStatusChange('extracting');
        await new Promise(resolve => setTimeout(resolve, 1500));
        return {
            success: true,
            data: {
                experts: [{ nom: "EXPERT MOCK", prenom: "", tel: "0499 99 99 99" }],
                occupants: [{
                    id: crypto.randomUUID(), nom: "DUPONT", prenom: "Jean", etage: "1er", etageRaw: "1er étage", lot: "5", appartement: "2", housingUnitId: "hu_1er|5|2", statut: "Locataire", tel: "0499 88 88 88", email: "jean@mock.com",
                    rc: false, rcPolice: "", secAssurance: false, secCie: "", secPolice: "", secType: "", contreExpert: false, flags: []
                }],
                intervenants: [{
                    id: crypto.randomUUID(), nom: "PLOMBERIE ABC", prenom: "", role: "Plombier", societe: "ABC Plomberie", email: "", tel: "0470 00 00 00"
                }]
            }
        };
    }

    try {
        if (onStatusChange) onStatusChange('extracting');

        const processBatch = async (batchFiles) => {
            const contentArray = await buildContentArrayParallel(batchFiles, "Voici les documents sociaux à analyser.");
            const systemPrompt = usePromptStore.getState().getPrompt('SOCIAL');

            const payload = buildAiPayload(
                config,
                'agent_social',
                [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: contentArray }
                ],
                { forceJsonResponse: true }
            );

            const data = await executeAiCall({
                apiKey,
                payload,
                componentId: 'agent_social'
            });

            const parsedData = JSON.parse(data.choices[0].message.content);

            const buildOccupantId = (occ) => {
                const norm = (v) => (v ?? '').toString().trim().toLowerCase();
                const seed = [occ.nom, occ.prenom, occ.civilite, occ.etage, occ.lot, occ.appartement, occ.statut]
                  .map(norm)
                  .join('|');

                if (seed.replace(/\|/g, '') === '') return crypto.randomUUID();

                if (!norm(occ.prenom) && !norm(occ.civilite)) {
                  return `occ_${crypto.randomUUID()}`;
                }

                let h = 5381;
                for (let i = 0; i < seed.length; i++) h = (h * 33) ^ seed.charCodeAt(i);
                return `occ_${(h >>> 0).toString(16)}`;
            };

            const normalizeOccupant = (raw) => {
                if (!raw || typeof raw !== 'object') return null;

                const link = raw.proprietaireLie && typeof raw.proprietaireLie === 'object'
                  ? {
                      nom: raw.proprietaireLie.nom ?? null,
                      prenom: raw.proprietaireLie.prenom ?? null,
                      source: raw.proprietaireLie.source ?? null,
                    }
                  : { nom: null, prenom: null, source: null };

                const rawEtage = raw.etage ?? null;
                const parsedLoc = parseLocalisation(rawEtage || raw.localisation || '');

                const canonEtage = normalizeEtage(rawEtage) || parsedLoc.etage || rawEtage || null;
                const lot = raw.lot ?? parsedLoc.lot ?? null;
                const appartement = raw.appartement ?? parsedLoc.appartement ?? null;

                const flags = Array.isArray(raw.flags) ? [...raw.flags] : [];

                const occ = {
                  ...raw,
                  etage: canonEtage,
                  etageRaw: rawEtage,
                  lot,
                  appartement,
                  proprietaireLie: link,
                  linkedProprietaireId: raw.linkedProprietaireId ?? null,
                  flags
                };

                occ.housingUnitId = resolveHousingUnitId(occ);

                const hasRawEtage = (rawEtage ?? '').toString().trim() !== '';
                if (hasRawEtage && !normalizeEtage(rawEtage)) {
                  if (!occ.flags.includes('ETAGE_AMBIGU')) occ.flags.push('ETAGE_AMBIGU');
                }

                const conflict = (a, b) => a != null && b != null
                  && a.toString().trim().toLowerCase() !== b.toString().trim().toLowerCase();

                if (conflict(raw.lot, parsedLoc.lot) || conflict(raw.appartement, parsedLoc.appartement)) {
                  if (!occ.flags.includes('AMBIGUITE_LOGEMENT')) occ.flags.push('AMBIGUITE_LOGEMENT');
                }

                occ.id = occ.id ?? buildOccupantId(occ);
                return occ;
            };

            if (parsedData.occupants && Array.isArray(parsedData.occupants)) {
                parsedData.occupants = parsedData.occupants.map(normalizeOccupant).filter(Boolean);
            }
            if (parsedData.intervenants && Array.isArray(parsedData.intervenants)) {
                parsedData.intervenants = parsedData.intervenants.map(inter => ({ ...inter, id: crypto.randomUUID() }));
            } else {
                parsedData.intervenants = [];
            }
            return parsedData;
        };

        const batchResults = await processInParallelBatches(fileArray, 8, processBatch);

        let mergedExperts = [];
        let mergedOccupants = [];
        let mergedIntervenants = [];

        for (const res of batchResults) {
            if (res.experts && Array.isArray(res.experts)) mergedExperts = mergedExperts.concat(res.experts);
            if (res.occupants && Array.isArray(res.occupants)) mergedOccupants = mergedOccupants.concat(res.occupants);
            if (res.intervenants && Array.isArray(res.intervenants)) mergedIntervenants = mergedIntervenants.concat(res.intervenants);
        }

        mergedOccupants = deduplicatePersons(mergedOccupants);
        mergedExperts = deduplicatePersons(mergedExperts);
        mergedIntervenants = deduplicatePersons(mergedIntervenants);
        
        console.log(`[social] 👥 Social dédupliqué: ${mergedOccupants.length} occupants, ${mergedExperts.length} experts, ${mergedIntervenants.length} intervenants`);

        return { success: true, data: { experts: mergedExperts, occupants: mergedOccupants, intervenants: mergedIntervenants } };

    } catch (error) {
        console.error("[social] extractSocialData error :", error);
        return { success: false, error: error.message || "Erreur lors de l'extraction sociale." };
    }
};
