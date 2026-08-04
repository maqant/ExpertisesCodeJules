import { extractFinancialData } from '../../../services/decompteExtractionService.js';
import { normalizeFinancialDocument, DocumentValidationError } from '../../../services/decompteExtractionSchema.js';

/**
 * Orchestre l'ingestion d'un document (initial ou additionnel en mode append) :
 * appel IA, validation, normalisation, vérification d'intégrité financière, dispatch.
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
            id: p.id || crypto.randomUUID(),
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

        // Construction déterministe du bloc bénéficiaire (si trouvé)
        const autoBlock = (meta.beneficiaire && meta.beneficiaire.nom)
            ? buildAutoBlock(meta.beneficiaire, expenses)
            : null;

        dispatch({
            type: isAppend ? 'INGESTION_APPEND_SUCCESS' : 'INGESTION_SUCCESS',
            payload: { requestId, expenses, meta: enrichedMeta, autoBlock },
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

function buildAutoBlock(beneficiaire, expenses) {
    const contact = {
        id: crypto.randomUUID(),
        nom: beneficiaire.nom,
        iban: beneficiaire.iban || '',
        origine: 'ai_detected',
    };
    const blockId = crypto.randomUUID();
    const block = {
        id: blockId,
        recipientRef: { kind: 'local', id: contact.id },
        recipientSnapshot: null,
        ibanOverride: '',
        closureMode: 'attente',
        remarque: ''
    };
    const allocations = expenses.map(e => ({
        id: crypto.randomUUID(),
        blockId: blockId,
        expenseId: e.id,
        montant: e.montantValide,
        status: 'assigned'
    }));

    return {
        contact,
        block,
        allocations
    };
}

function toUserMessage(err) {
    if (err instanceof DocumentValidationError) {
        return "Le document a été lu, mais les données extraites sont incohérentes. Vérifiez le fichier ou saisissez manuellement.";
    }
    return err.message || "L'analyse du document a échoué. Réessayez ou contactez le support.";
}
