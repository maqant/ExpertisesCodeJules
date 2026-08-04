// ============================================================================
// src/domain/decompteSplitter/dossierExpenseMatcher.js
// Moteur pur de réconciliation "Scan & Suggest" entre les lignes extraites
// du décompte compagnie et les frais officiels du dossier (metier.expenses).
//
// PARADIGME : assistance discrète. Ce module NE MUTE RIEN. Il retourne une
// map de suggestions { expenseId -> suggestion } que l'UI matérialise en
// badges cliquables. Toute application est un acte humain explicite.
// ============================================================================

import { cleanAmount } from '../../store/financeStore.js';

export const MATCH_TIER = {
    EXACT_AMOUNT: 'EXACT_AMOUNT', // Montant identique, même régime TVA
    CROSS_TVA: 'CROSS_TVA',       // Montant identique après conversion HTVA<->TVAC
    FUZZY: 'FUZZY',               // Montant proche + similarité sémantique
};

export const TIER_SCORES = {
    [MATCH_TIER.EXACT_AMOUNT]: 1.0,
    [MATCH_TIER.CROSS_TVA]: 0.9,
    [MATCH_TIER.FUZZY]: 0.8,
};

const TVA_RATE = 1.21;
const AMOUNT_TOLERANCE = 0.011;
const FUZZY_AMOUNT_REL_TOL = 0.02;
const FUZZY_TEXT_MIN_SIM = 0.35;

const FR_STOPWORDS = new Set([
    'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'ou', 'au',
    'aux', 'en', 'a', 'pour', 'sur', 'par', 'dans', 'suite',
]);

const normalizeText = (str = '') =>
    String(str)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const tokenize = (str = '') =>
    normalizeText(str)
        .split(' ')
        .filter(t => t.length > 1 && !FR_STOPWORDS.has(t));

const diceSimilarity = (tokensA, tokensB) => {
    if (!tokensA.length || !tokensB.length) return 0;
    const setB = new Set(tokensB);
    const intersection = tokensA.filter(t => setB.has(t)).length;
    return (2 * intersection) / (tokensA.length + tokensB.length);
};

const getAmount = (exp) => cleanAmount(exp.montantValide || exp.montantReclame);

const amountsEqual = (a, b, tol = AMOUNT_TOLERANCE) => Math.abs(a - b) <= tol;

const relDiff = (a, b) => {
    const max = Math.max(Math.abs(a), Math.abs(b));
    return max === 0 ? 0 : Math.abs(a - b) / max;
};

export const buildSuggestedLabel = (dossierExp) => {
    const parts = [dossierExp.prestataire, dossierExp.desc || dossierExp.type].filter(Boolean);
    return parts.join(' — ') || 'Frais du dossier';
};

const scorePair = (extracted, dossier) => {
    const amtE = getAmount(extracted);
    const amtD = getAmount(dossier);
    if (amtE <= 0 || amtD <= 0) return null;

    const sameTvaRegime = (extracted.typeMontant || 'HTVA') === (dossier.typeMontant || 'HTVA');

    // 1. Montant exact
    if (sameTvaRegime && amountsEqual(amtE, amtD)) {
        return {
            tier: MATCH_TIER.EXACT_AMOUNT,
            score: TIER_SCORES[MATCH_TIER.EXACT_AMOUNT],
            reason: `Montant identique (${amtD.toFixed(2)} € ${dossier.typeMontant || 'HTVA'})`,
        };
    }

    // 2. Conversion HTVA / TVAC
    if (amountsEqual(amtE * TVA_RATE, amtD) || amountsEqual(amtD * TVA_RATE, amtE)) {
        return {
            tier: MATCH_TIER.CROSS_TVA,
            score: TIER_SCORES[MATCH_TIER.CROSS_TVA],
            reason: `Correspondance HTVA/TVAC (TVA 21%)`,
        };
    }

    // 3. Fuzzy (montant proche + similarité textuelle)
    if (relDiff(amtE, amtD) <= FUZZY_AMOUNT_REL_TOL) {
        const tokensE = tokenize(extracted.desc || extracted.type || '');
        const tokensD = tokenize(`${dossier.desc || ''} ${dossier.prestataire || ''}`);
        const sim = diceSimilarity(tokensE, tokensD);
        if (sim >= FUZZY_TEXT_MIN_SIM) {
            return {
                tier: MATCH_TIER.FUZZY,
                score: TIER_SCORES[MATCH_TIER.FUZZY],
                reason: `Montant proche + similarité libellés (${Math.round(sim * 100)} %)`,
            };
        }
    }

    return null;
};

/**
 * Scanne et construit l'affectation gloutonne biunivoque (un frais dossier -> une ligne décompte).
 */
export const computeDossierSuggestions = (
    extractedExpenses = [],
    dossierExpenses = [],
    opts = {}
) => {
    const dismissed = new Set(opts.dismissedIds || []);

    const candidatesE = extractedExpenses.filter(e =>
        !e.linkedDossierExpenseId &&
        !dismissed.has(e.id) &&
        e.origine !== 'manuel'
    );
    if (!candidatesE.length || !dossierExpenses.length) return {};

    const pairs = [];
    for (const ext of candidatesE) {
        for (const dos of dossierExpenses) {
            const match = scorePair(ext, dos);
            if (match) pairs.push({ ext, dos, ...match });
        }
    }

    pairs.sort((a, b) => b.score - a.score);
    const usedExtracted = new Set();
    const usedDossier = new Set();
    const suggestions = {};

    for (const p of pairs) {
        if (usedExtracted.has(p.ext.id) || usedDossier.has(p.dos.id)) continue;
        usedExtracted.add(p.ext.id);
        usedDossier.add(p.dos.id);

        suggestions[p.ext.id] = {
            expenseId: p.ext.id,
            dossierExpenseId: p.dos.id,
            tier: p.tier,
            score: p.score,
            reason: p.reason,
            suggestedLabel: buildSuggestedLabel(p.dos),
            dossierSnapshot: {
                prestataire: p.dos.prestataire || '',
                type: p.dos.type || '',
                ref: p.dos.ref || '',
                desc: p.dos.desc || '',
                montant: getAmount(p.dos),
                typeMontant: p.dos.typeMontant || 'HTVA',
            },
        };
    }

    return suggestions;
};
