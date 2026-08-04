// ============================================================================
// src/services/financialIntegrityChecker.js
// Moteur de réconciliation et d'intégrité comptable (Double-Entry Balance Verification)
// pour les décomptes d'assurance.
//
// Invariant vérifié : ∑ postes === totalDocument (à la tolérance près).
// En cas d'écart : résolution déterministe d'inversion de signe (Subset-Sum Flip).
// ============================================================================

export const IntegrityStatus = Object.freeze({
    BALANCED: 'BALANCED',              // ∑ postes === total : parfait
    AUTO_CORRECTED: 'AUTO_CORRECTED',  // Flips de signe appliqués, égalité rétablie
    AMBIGUOUS: 'AMBIGUOUS',            // Plus de 2 corrections possibles : arbitrage humain requis
    UNBALANCED: 'UNBALANCED',          // Écart inexplicable par inversion de signe
    NO_TOTAL: 'NO_TOTAL',              // totalDocument absent du document
});

const DEFAULT_TOLERANCE_CENTS = 2; // ±0,02 € (arrondis de TVA)
const DEDUCTION_KEYWORDS = [
    'franchise', 'acompte', 'avance', 'deduction', 'déduction',
    'deja verse', 'déjà versé', 'trop-percu', 'trop-perçu', 'trop percu',
    'reserve', 'réserve', 'provision', 'recuperation', 'récupération',
    'vetuste', 'vétusté', 'retenue', 'remboursement', 'regularisation', 'régularisation'
];

/**
 * Convertit toute représentation de montant (number ou string FR/EN/comptable) en centimes entiers signés.
 * @param {number|string} value 
 * @returns {number|null}
 */
export function toCents(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') {
        return Number.isFinite(value) ? Math.round(value * 100) : null;
    }
    if (typeof value !== 'string') return null;

    let s = value.replace(/[\s\u00A0\u202F€]/g, '');
    if (s.length === 0) return null;

    let negative = false;
    // Format comptable entre parenthèses ex: (321,35)
    if (/^\(.*\)$/.test(s)) {
        negative = true;
        s = s.slice(1, -1);
    }
    if (s.startsWith('-')) {
        negative = true;
        s = s.slice(1);
    }
    if (s.endsWith('-')) {
        negative = true;
        s = s.slice(0, -1);
    }
    if (s.startsWith('+')) {
        s = s.slice(1);
    }

    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    if (hasComma && hasDot) {
        s = (s.lastIndexOf('.') > s.lastIndexOf(','))
            ? s.replace(/,/g, '')
            : s.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
        const parts = s.split(',');
        s = (parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3)
            ? s.replace(/,/g, '')
            : s.replace(/,/g, '.');
    } else if (hasDot) {
        const parts = s.split('.');
        if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
            s = s.replace(/\./g, '');
        }
    }

    const num = Number(s);
    if (!Number.isFinite(num)) return null;
    return Math.round(num * 100) * (negative ? -1 : 1);
}

export function formatCents(cents) {
    if (cents === null || cents === undefined) return "0,00";
    return (cents / 100).toLocaleString('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function findFlipCombinations(centsArray, targetFlipCents) {
    const n = centsArray.length;
    const solutions = [];

    // 1. Single flip : centsArray[i] * 2 ≈ targetFlipCents (car passer de +x à -x change la somme de 2x)
    for (let i = 0; i < n; i++) {
        const c = centsArray[i];
        if (c === 0) continue;
        if (Math.abs(2 * c - targetFlipCents) <= DEFAULT_TOLERANCE_CENTS) {
            solutions.push([i]);
        }
    }
    if (solutions.length > 0) return solutions;

    // 2. Double flip
    for (let i = 0; i < n; i++) {
        if (centsArray[i] === 0) continue;
        for (let j = i + 1; j < n; j++) {
            if (centsArray[j] === 0) continue;
            const doubleFlip = 2 * (centsArray[i] + centsArray[j]);
            if (Math.abs(doubleFlip - targetFlipCents) <= DEFAULT_TOLERANCE_CENTS) {
                solutions.push([i, j]);
            }
        }
    }

    return solutions;
}

function deductionScore(combo, libelles) {
    return combo.reduce((score, idx) => {
        const label = (libelles[idx] || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const isDeductionKeyword = DEDUCTION_KEYWORDS.some(kw => label.includes(kw));
        return score + (isDeductionKeyword ? 2 : 1);
    }, 0);
}

/**
 * Vérifie l'intégrité comptable et résout automatiquement les inversions de signes.
 *
 * @param {Object} params
 * @param {Array<{libelle: string, montant: number|string, montantStr?: string}>} params.postes
 * @param {number|string|null} params.totalDocument
 * @returns {IntegrityReport}
 */
export function checkFinancialIntegrity({ postes = [], totalDocument = null }) {
    const items = postes.map((p, idx) => ({
        index: idx,
        libelle: p.libelle || `Poste ${idx + 1}`,
        cents: toCents(p.montantStr ?? p.montant),
        original: p
    }));

    const totalCents = toCents(totalDocument);
    const sumCents = items.reduce((acc, it) => acc + (it.cents || 0), 0);

    if (totalCents === null) {
        return {
            status: IntegrityStatus.NO_TOTAL,
            postes: items.map(it => ({ ...it.original, montantCents: it.cents, montantStr: formatCents(it.cents) })),
            sumCents,
            totalCents: null,
            corrections: [],
            warnings: [`Total du document non extrait. Somme calculée des postes : ${formatCents(sumCents)} €.`]
        };
    }

    const deltaCents = sumCents - totalCents;

    // 1. Égalité comptable exacte
    if (Math.abs(deltaCents) <= DEFAULT_TOLERANCE_CENTS) {
        return {
            status: IntegrityStatus.BALANCED,
            postes: items.map(it => ({ ...it.original, montantCents: it.cents, montantStr: formatCents(it.cents) })),
            sumCents,
            totalCents,
            corrections: [],
            warnings: []
        };
    }

    // 2. Recherche d'inversion de signe (Subset-Sum Flip)
    const centsArray = items.map(it => it.cents || 0);
    const libellesArray = items.map(it => it.libelle);
    const combinations = findFlipCombinations(centsArray, deltaCents);

    if (combinations.length > 0) {
        // Sélection de la meilleure combinaison par score lexical
        combinations.sort((a, b) => deductionScore(b, libellesArray) - deductionScore(a, libellesArray));
        const bestCombo = combinations[0];

        const flippedIndices = new Set(bestCombo);
        const correctedItems = items.map((it, idx) => {
            if (flippedIndices.has(idx)) {
                const newCents = -it.cents;
                return {
                    ...it.original,
                    montantCents: newCents,
                    montantStr: formatCents(newCents),
                    wasAutoCorrected: true,
                    originalCents: it.cents
                };
            }
            return {
                ...it.original,
                montantCents: it.cents,
                montantStr: formatCents(it.cents)
            };
        });

        const newSumCents = correctedItems.reduce((acc, it) => acc + it.montantCents, 0);
        const corrections = bestCombo.map(idx => ({
            index: idx,
            libelle: items[idx].libelle,
            fromCents: items[idx].cents,
            toCents: -items[idx].cents,
            fromStr: formatCents(items[idx].cents),
            toStr: formatCents(-items[idx].cents)
        }));

        if (Math.abs(newSumCents - totalCents) <= DEFAULT_TOLERANCE_CENTS) {
            return {
                status: IntegrityStatus.AUTO_CORRECTED,
                postes: correctedItems,
                sumCents: newSumCents,
                totalCents,
                corrections,
                warnings: [
                    `Correction automatique de signe appliquée sur ${corrections.length} poste(s) : ` +
                    corrections.map(c => `« ${c.libelle} » (${c.fromStr} € → ${c.toStr} €)`).join(', ') +
                    `. La somme correspond désormais exactement au total de la lettre (${formatCents(totalCents)} €).`
                ]
            };
        }
    }

    // 3. Reconstitution ou Écart Inexpliqué
    return {
        status: IntegrityStatus.UNBALANCED,
        postes: items.map(it => ({ ...it.original, montantCents: it.cents, montantStr: formatCents(it.cents) })),
        sumCents,
        totalCents,
        corrections: [],
        warnings: [
            `⚠️ Écart d'intégrité financière détecté : La somme des postes extraits (${formatCents(sumCents)} €) ne correspond pas au total de la lettre (${formatCents(totalCents)} €). Écart : ${formatCents(deltaCents)} €.`
        ]
    };
}
