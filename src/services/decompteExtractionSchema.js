import { z } from 'zod';
import { toCents, formatCents } from './financialIntegrityChecker.js';

const ibanSchema = z.string()
    .transform(s => s.replace(/\s/g, '').toUpperCase())
    .nullable();

const posteSchema = z.object({
    libelle: z.string().min(1, "Libellé manquant"),
    montant: z.union([z.number(), z.string()]).transform(val => {
        const cents = toCents(val);
        if (cents !== null) {
            return formatCents(cents);
        }
        return "0,00";
    }),
    categorie: z.string().nullish().default(null)
});

/** Schéma de la réponse IA brute. Toute déviation = rejet explicite. */
export const aiFinancialResponseSchema = z.object({
    postes: z.array(posteSchema).min(1, "Aucun poste détecté"),
    beneficiaire: z.object({
        nom: z.string().nullable().default(null),
        iban: ibanSchema.optional().default(null),
    }).nullable().default(null),
    totalDocument: z.number().nullable().optional().default(null),
    reference: z.string().nullable().default(null),
    date: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format ISO YYYY-MM-DD')
        .nullable().default(null),
});

/**
 * Normalise la réponse IA validée en DTO domaine.
 * @returns {{ postes: Array<{libelle:string, montantStr:string, categorie:string|null}>,
 *             meta: {beneficiaire:{nom:string|null,iban:string|null}|null, totalDocument:number|null, reference:string|null, dateISO:string|null} }}
 */
export function normalizeFinancialDocument(rawAiResponse) {
    const parsed = aiFinancialResponseSchema.safeParse(rawAiResponse);
    if (!parsed.success) {
        throw new DocumentValidationError(parsed.error);
    }
    const { postes, beneficiaire, totalDocument, reference, date } = parsed.data;
    
    return {
        postes: postes.map(p => ({
            libelle: p.libelle.trim(),
            montantStr: p.montant,
            categorie: p.categorie,
        })),
        meta: { beneficiaire, totalDocument, reference, dateISO: date },
    };
}

export class DocumentValidationError extends Error {
    constructor(zodError) {
        super("L'extraction IA ne respecte pas le format attendu.");
        this.name = 'DocumentValidationError';
        this.code = 'AI_OUTPUT_INVALID';
        this.issues = zodError.issues;
    }
}
