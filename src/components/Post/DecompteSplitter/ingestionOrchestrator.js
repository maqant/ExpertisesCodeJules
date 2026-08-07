import { extractFinancialData } from '../../../services/decompteExtractionService.js';
import { normalizeFinancialDocument, DocumentValidationError } from '../../../services/decompteExtractionSchema.js';

/**
 * Orchestre l'ingestion d'un document (initial ou additionnel en mode append) :
 * appel IA, validation, normalisation, dispatch.
 *
 * PRINCIPE ARCHITECTURAL : l'ingestion EXTRAIT, elle n'ALLOUE JAMAIS.
 * Tous les postes extraits atterrissent dans le panier global, statut "À ventiler".
 * La ventilation vers les blocs de paiement est une décision exclusivement humaine.
 * Le bénéficiaire détecté par l'IA est transmis comme simple suggestion de contact.
 *
 * @param {File} file
 * @param {Function} dispatch - dispatch du SplitterContext
 * @param {Object} [options]
 * @param {boolean} [options.isAppend=false] - Si true, ajoute aux postes existants sans réinitialiser la session.
 */
export async function ingestDocument(file, dispatch, options = {}) {
    const { isAppend = false } = options;
    const requestId = crypto.randomUUID();
    dispatch({ type: 'INGESTION_START', payload: { requestId, isAppend } });

    try {
        const result = await extractFinancialData(file);

        // Validation Zod & Normalisation (Frontière Anti-Corruption)
        const { meta } = normalizeFinancialDocument(result);

        // Les postes sont issus directement de result.postes (déjà réconciliés et vérifiés par financialIntegrityChecker)
        const expenses = (result.postes || []).map(p => ({
            id: crypto.randomUUID(),
            desc: p.libelle,
            montantReclame: p.montantStr,
            montantValide: p.montantStr,
            typeMontant: 'HTVA',
            origine: 'ia_extraction',
            wasAutoCorrected: !!p.wasAutoCorrected
        }));

        const enrichedMeta = {
            ...meta,
            integrity: result.integrity || null
        };

        // Le bénéficiaire détecté est proposé comme CONTACT, jamais comme bloc pré-alloué.
        const detectedContact = (meta.beneficiaire && meta.beneficiaire.nom)
            ? {
                id: crypto.randomUUID(),
                nom: meta.beneficiaire.nom,
                civilite: meta.beneficiaire.civilite || null,
                civility: meta.beneficiaire.civilite || null,
                iban: meta.beneficiaire.iban || '',
                origine: 'ai_detected',
            }
            : null;

        dispatch({
            type: isAppend ? 'INGESTION_APPEND_SUCCESS' : 'INGESTION_SUCCESS',
            payload: { requestId, expenses, meta: enrichedMeta, detectedContact },
        });
    } catch (err) {
        dispatch({
            type: isAppend ? 'INGESTION_APPEND_ERROR' : 'INGESTION_ERROR',
            payload: {
                requestId,
                code: err instanceof DocumentValidationError ? err.code : 'INGESTION_FAILED',
                message: toUserMessage(err),
            },
        });
    }
}

function toUserMessage(err) {
    if (err instanceof DocumentValidationError) {
        return "Le document a été lu, mais les données extraites sont incohérentes. Vérifiez le fichier ou saisissez manuellement.";
    }
    return err.message || "L'analyse du document a échoué. Réessayez ou contactez le support.";
}
