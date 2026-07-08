import { extractFinancialData } from '../../../services/decompteExtractionService.js';
import { normalizeFinancialDocument, DocumentValidationError } from '../../../services/decompteExtractionSchema.js';

/**
 * Orchestre l'ingestion d'un document : appel IA, validation, normalisation,
 * génération des IDs, dispatch. C'est ICI que vit l'impureté (async, UUID),
 * pas dans le reducer.
 *
 * @param {File} file
 * @param {Function} dispatch - dispatch du SplitterContext
 */
export async function ingestDocument(file, dispatch) {
    const requestId = crypto.randomUUID();
    dispatch({ type: 'INGESTION_START', payload: { requestId } });

    try {
        const rawResult = await extractFinancialData(file);

        // Validation Zod & Normalisation (Frontière Anti-Corruption)
        const { postes, meta } = normalizeFinancialDocument(rawResult);

        const expenses = postes.map(p => ({
            id: crypto.randomUUID(),
            desc: p.libelle,
            montantReclame: p.montantStr,
            montantValide: p.montantStr,
            typeMontant: 'HTVA',
            origine: 'ia_extraction',
        }));

        // Construction déterministe du bloc bénéficiaire (si trouvé)
        const autoBlock = (meta.beneficiaire && meta.beneficiaire.nom)
            ? buildAutoBlock(meta.beneficiaire, expenses)
            : null;

        dispatch({
            type: 'INGESTION_SUCCESS',
            payload: { requestId, expenses, meta, autoBlock },
        });
    } catch (err) {
        dispatch({
            type: 'INGESTION_ERROR',
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
