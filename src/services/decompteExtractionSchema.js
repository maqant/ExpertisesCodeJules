import { z } from 'zod';

const ibanSchema = z.string()
    .transform(s => s.replace(/\s/g, '').toUpperCase())
    .nullable(); // On ne fait pas de validation complexe modulo 97 pour ne pas bloquer l'ingestion si l'IA hallucine un bout

const posteSchema = z.object({
    libelle: z.string().min(1, "Libellé manquant"),
    montant: z.union([z.number(), z.string()]).transform(val => {
        // Retourne le format string francisé attendu par l'application (ex: "1.234,56")
        // L'app utilise ce format partout
        if (typeof val === 'number') {
            return val.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        if (typeof val === 'string') {
            // Nettoyage de base : enlever les espaces, l'euro
            let cleaned = val.replace(/\s|\u00A0|€/g, '');
            // Si c'est au format anglais "1,234.56" -> on supprime les virgules
            if (cleaned.includes('.') && cleaned.includes(',')) {
                if (cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',')) {
                    cleaned = cleaned.replace(/,/g, '');
                } else {
                    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
                }
            } else if (cleaned.includes(',')) {
                cleaned = cleaned.replace(',', '.');
            }
            
            const num = Number(cleaned);
            if (!isNaN(num)) {
                return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
            return val; // fallback, l'app gérera
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
    reference: z.string().nullable().default(null),
    date: z.string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format ISO YYYY-MM-DD')
        .nullable().default(null),
});

/**
 * Normalise la réponse IA validée en DTO domaine.
 * @returns {{ postes: Array<{libelle:string, montantCents:number, categorie:string|null}>,
 *             meta: {beneficiaire:{nom:string|null,iban:string|null}|null, reference:string|null, dateISO:string|null} }}
 */
export function normalizeFinancialDocument(rawAiResponse) {
    const parsed = aiFinancialResponseSchema.safeParse(rawAiResponse);
    if (!parsed.success) {
        throw new DocumentValidationError(parsed.error);
    }
    const { postes, beneficiaire, reference, date } = parsed.data;
    return {
        postes: postes.map(p => ({
            libelle: p.libelle.trim(),
            montantStr: p.montant, // On conserve le format string localisé
            categorie: p.categorie,
        })),
        meta: { beneficiaire, reference, dateISO: date },
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
