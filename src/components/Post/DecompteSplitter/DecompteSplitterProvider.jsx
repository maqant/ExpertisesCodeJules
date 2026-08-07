import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { useFinanceStore } from '../../../store/financeStore.js';
import { ALLOCATION_STATUS, CLOSURE_MODE, genId } from '../../../domain/decompteSplitter/allocationModel.js';
import { buildProrataAllocations } from '../../../domain/decompteSplitter/prorataDistribution.js';
import { createBlockRecipientState, migrateDraftRecipients, sanitizeContactList } from '../../../domain/decompteSplitter/blockRecipientModel.js';

const SplitterContext = createContext(null);

const initialState = {
    version: 2,
    sourceExpenseIds: [],
    allocations: [],
    blocks: [],
    localContacts: [],
    documentCandidates: [],
    documentIbans: [],
    unassignedPolicy: 'strict',
    extractedExpenses: [],
    ingestionStatus: 'idle', // 'idle' | 'uploading' | 'parsing' | 'ready' | 'error'
    ingestionError: null,
    ingestionRequestId: null,
    detectedMeta: null,
    resumedFromDraft: false  // flag pour afficher le bandeau de restauration
};

const INGESTION_TRANSITIONS = {
    idle: ['parsing', 'ready', 'parsing_append'],
    parsing: ['ready', 'error', 'idle', 'parsing_append'],
    parsing_append: ['ready', 'error', 'parsing_append'],
    ready: ['parsing', 'parsing_append', 'idle'],
    error: ['parsing', 'idle', 'parsing_append'],
};

function canTransition(from, to) {
    return INGESTION_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Vérifie si un draft est "meaningful" (non vide, contient du travail réel).
 * Un draft vide ou sans postes/blocs n'est pas worth restoring.
 */
function isDraftMeaningful(draft) {
    if (!draft) return false;
    const hasExpenses = (draft.extractedExpenses || []).length > 0;
    const hasBlocks = (draft.blocks || []).length > 0;
    const hasAllocations = (draft.allocations || []).length > 0;
    return hasExpenses || hasBlocks || hasAllocations;
}

/**
 * Fusionne un contact détecté par l'IA dans la liste des contacts locaux,
 * avec déduplication par nom (case-insensitive).
 */
function mergeDetectedContact(existingContacts, detectedContact) {
    if (!detectedContact || !detectedContact.nom) return existingContacts;
    const sanitized = sanitizeContactList(existingContacts);
    const nameNorm = detectedContact.nom.trim().toLowerCase();
    const alreadyExists = sanitized.some(c => (c.nom || '').trim().toLowerCase() === nameNorm);
    if (alreadyExists) return sanitized;
    return [...sanitized, detectedContact];
}

function splitterReducer(state, action) {
    switch (action.type) {
        case 'INIT_DRAFT': {
            if (!action.payload) return initialState;
            const migrated = migrateDraftRecipients(action.payload);
            return {
                ...migrated,
                localContacts: sanitizeContactList(migrated.localContacts),
                documentCandidates: migrated.documentCandidates || [],
                documentIbans: migrated.documentIbans || []
            };
        }

        case 'RESET_DOCUMENT_SUGGESTIONS': {
            return {
                ...state,
                documentCandidates: [],
                documentIbans: []
            };
        }

        case 'INGESTION_START': {
            const targetStatus = action.payload?.isAppend ? 'parsing_append' : 'parsing';
            if (!canTransition(state.ingestionStatus, targetStatus)) return state;
            return { ...state, ingestionStatus: targetStatus, ingestionError: null, appendError: null, ingestionRequestId: action.payload.requestId };
        }
            
        case 'INGESTION_SUCCESS': {
            if (state.ingestionRequestId !== action.payload.requestId) return state;
            if (!canTransition(state.ingestionStatus, 'ready')) return state;
            
            const { expenses, meta, detectedContact } = action.payload;
            const newDocCandidates = detectedContact ? [{
                id: detectedContact.id || crypto.randomUUID(),
                displayName: detectedContact.nom,
                nom: detectedContact.nom,
                iban: detectedContact.iban || '',
                origin: 'Lettre / Document'
            }] : [];
            const newDocIbans = (detectedContact && detectedContact.iban) ? [{
                iban: detectedContact.iban,
                holderName: detectedContact.nom,
                origin: 'Lettre / Document'
            }] : [];

            return {
                ...state,
                ingestionStatus: 'ready',
                ingestionRequestId: null,
                extractedExpenses: expenses,
                detectedMeta: meta || null,
                ingestionError: null,
                appendError: null,
                resumedFromDraft: false,
                localContacts: mergeDetectedContact(state.localContacts, detectedContact),
                documentCandidates: newDocCandidates,
                documentIbans: newDocIbans,
            };
        }

        case 'INGESTION_APPEND_SUCCESS': {
            if (state.ingestionRequestId !== action.payload.requestId) return state;
            if (!canTransition(state.ingestionStatus, 'ready')) return state;
            
            const { expenses, meta, detectedContact } = action.payload;
            const appendedDocCandidates = detectedContact ? [{
                id: detectedContact.id || crypto.randomUUID(),
                displayName: detectedContact.nom,
                nom: detectedContact.nom,
                iban: detectedContact.iban || '',
                origin: 'Lettre / Document'
            }] : [];
            const appendedDocIbans = (detectedContact && detectedContact.iban) ? [{
                iban: detectedContact.iban,
                holderName: detectedContact.nom,
                origin: 'Lettre / Document'
            }] : [];

            return {
                ...state,
                ingestionStatus: 'ready',
                ingestionRequestId: null,
                extractedExpenses: [...state.extractedExpenses, ...expenses],
                detectedMeta: meta || state.detectedMeta,
                ingestionError: null,
                appendError: null,
                localContacts: mergeDetectedContact(state.localContacts, detectedContact),
                documentCandidates: [...(state.documentCandidates || []), ...appendedDocCandidates],
                documentIbans: [...(state.documentIbans || []), ...appendedDocIbans],
            };
        }
            
        case 'INGESTION_ERROR': {
            if (state.ingestionRequestId !== action.payload.requestId) return state;
            return { ...state, ingestionStatus: 'error', ingestionError: action.payload.message, ingestionRequestId: null };
        }

        case 'INGESTION_APPEND_ERROR': {
            if (state.ingestionRequestId !== action.payload.requestId) return state;
            return { ...state, ingestionStatus: 'ready', appendError: action.payload.message, ingestionRequestId: null };
        }
            
        case 'MANUAL_ENTRY': {
            if (!canTransition(state.ingestionStatus, 'ready')) return state;
            return {
                ...state,
                ingestionStatus: 'ready',
                ingestionRequestId: null,
                extractedExpenses: [],
                detectedMeta: null,
                ingestionError: null,
                resumedFromDraft: false
            };
        }
            
        case 'ADD_MANUAL_EXPENSE': {
            return {
                ...state,
                extractedExpenses: [...state.extractedExpenses, action.payload]
            };
        }
            
        case 'UPDATE_MANUAL_EXPENSE': {
            return {
                ...state,
                extractedExpenses: state.extractedExpenses.map(e => 
                    e.id === action.payload.id ? { ...e, ...action.payload.changes } : e
                )
            };
        }
            
        case 'DISTRIBUTE_PRORATA': {
            try {
                const newAllocations = buildProrataAllocations(action.payload.expense, state.allocations, action.payload.baseExpenseIds || null);
                const filteredAllocations = state.allocations.filter(a => a.expenseId !== action.payload.expense.id);
                return {
                    ...state,
                    allocations: [...filteredAllocations, ...newAllocations]
                };
            } catch (err) {
                throw err;
            }
        }
            
        case 'RESET_INGESTION':
            return { ...state, ingestionStatus: 'idle', extractedExpenses: [], detectedMeta: null, ingestionError: null, allocations: [], blocks: [], localContacts: [], ingestionRequestId: null, resumedFromDraft: false };

        // Reset complet de la session — utilisé pour "Repartir de zéro" et après integrateToDossier
        case 'RESET_SESSION':
            return { ...initialState };

        // Acquittement de la restauration du draft — masque le bandeau
        case 'ACK_RESUMED_DRAFT':
            return { ...state, resumedFromDraft: false };

        case 'ADD_BLOCK': {
            const newBlock = {
                id: genId(),
                ...createBlockRecipientState(),
                ibanOverride: '',
                closureMode: CLOSURE_MODE.ATTENTE,
                remarque: '',
                remarqueOriginal: null
            };
            return { ...state, blocks: [...state.blocks, newBlock] };
        }

        case 'REMOVE_BLOCK': {
            const newBlocks = state.blocks.filter(b => b.id !== action.payload);
            const newAllocations = state.allocations.filter(a => a.blockId !== action.payload);
            return { ...state, blocks: newBlocks, allocations: newAllocations };
        }

        case 'UPDATE_BLOCK': {
            const newBlocks = state.blocks.map(b => 
                b.id === action.payload.blockId ? { ...b, ...action.payload.updates } : b
            );
            return { ...state, blocks: newBlocks };
        }

        case 'SET_BLOCK_RECIPIENT':
        case 'SET_BLOCK_PAYMENT_RECIPIENT': {
            const { blockId, recipientRef } = action.payload;
            return {
                ...state,
                blocks: state.blocks.map(b => {
                    if (b.id !== blockId) return b;
                    const linked = b.mailRecipientLinked !== false;
                    return {
                        ...b,
                        paymentRecipientRef: recipientRef,
                        paymentRecipientSnapshot: null,
                        ...(linked ? { mailRecipientRef: recipientRef, mailRecipientSnapshot: null } : {}),
                        recipientRef,
                        recipientSnapshot: null
                    };
                })
            };
        }

        case 'SET_BLOCK_MAIL_RECIPIENT': {
            const { blockId, mailRecipientRef } = action.payload;
            return {
                ...state,
                blocks: state.blocks.map(b =>
                    b.id === blockId
                        ? { ...b, mailRecipientRef, mailRecipientSnapshot: null, mailRecipientLinked: false }
                        : b
                )
            };
        }

        case 'LINK_MAIL_TO_PAYMENT': {
            const { blockId } = action.payload;
            return {
                ...state,
                blocks: state.blocks.map(b => {
                    if (b.id !== blockId) return b;
                    const payRef = b.paymentRecipientRef || b.recipientRef;
                    return {
                        ...b,
                        mailRecipientLinked: true,
                        mailRecipientRef: payRef,
                        mailRecipientSnapshot: b.paymentRecipientSnapshot || b.recipientSnapshot || null
                    };
                })
            };
        }

        case 'APPLY_REFINED_REMARQUE': {
            const { blockId, refinedText } = action.payload;
            return {
                ...state,
                blocks: state.blocks.map(b =>
                    b.id === blockId
                        ? { ...b, remarqueOriginal: b.remarqueOriginal ?? b.remarque, remarque: refinedText }
                        : b
                )
            };
        }

        case 'REVERT_REFINED_REMARQUE': {
            const { blockId } = action.payload;
            return {
                ...state,
                blocks: state.blocks.map(b =>
                    b.id === blockId && b.remarqueOriginal !== null
                        ? { ...b, remarque: b.remarqueOriginal, remarqueOriginal: null }
                        : b
                )
            };
        }

        case 'APPLY_MATCH_SUGGESTION': {
            const { expenseId, suggestion } = action.payload;
            return {
                ...state,
                extractedExpenses: state.extractedExpenses.map(e => {
                    if (e.id !== expenseId) return e;
                    return {
                        ...e,
                        descOriginale: e.descOriginale || e.desc || e.type,
                        desc: suggestion.suggestedLabel,
                        linkedDossierExpenseId: suggestion.dossierExpenseId,
                        matchConfidence: suggestion.score
                    };
                })
            };
        }

        case 'LINK_DOSSIER_EXPENSE': {
            const { expenseId, dossierExpense, suggestedLabel } = action.payload;
            return {
                ...state,
                extractedExpenses: state.extractedExpenses.map(e => {
                    if (e.id !== expenseId) return e;
                    return {
                        ...e,
                        descOriginale: e.descOriginale || e.desc || e.type,
                        desc: suggestedLabel,
                        linkedDossierExpenseId: dossierExpense.id,
                        matchConfidence: 1.0
                    };
                }),
                dismissedSuggestionIds: [...(state.dismissedSuggestionIds || []), expenseId]
            };
        }

        case 'UNLINK_DOSSIER_EXPENSE':
        case 'REVERT_MATCH_SUGGESTION': {
            const { expenseId } = action.payload;
            return {
                ...state,
                extractedExpenses: state.extractedExpenses.map(e => {
                    if (e.id !== expenseId) return e;
                    return {
                        ...e,
                        desc: e.descOriginale || e.desc,
                        descOriginale: undefined,
                        linkedDossierExpenseId: undefined,
                        matchConfidence: undefined
                    };
                })
            };
        }

        case 'RENAME_EXPENSE': {
            const { expenseId, newDesc } = action.payload;
            return {
                ...state,
                extractedExpenses: state.extractedExpenses.map(e => {
                    if (e.id !== expenseId) return e;
                    return {
                        ...e,
                        descOriginale: e.descOriginale || e.desc || e.type,
                        desc: newDesc
                    };
                })
            };
        }

        case 'RESTORE_ORIGINAL': {
            const { expenseId } = action.payload;
            return {
                ...state,
                extractedExpenses: state.extractedExpenses.map(e => {
                    if (e.id !== expenseId) return e;
                    return {
                        ...e,
                        desc: e.descOriginale || e.desc,
                        descOriginale: undefined,
                        linkedDossierExpenseId: undefined,
                        matchConfidence: undefined
                    };
                })
            };
        }

        case 'DISMISS_MATCH_SUGGESTION': {
            const { expenseId } = action.payload;
            return {
                ...state,
                dismissedSuggestionIds: [...(state.dismissedSuggestionIds || []), expenseId]
            };
        }

        case 'ADD_LOCAL_CONTACT': {
            // Normalisation du payload : supporte { contact, blockId } ET le contact direct.
            const payload = action.payload || {};
            const isWrapped = Object.prototype.hasOwnProperty.call(payload, 'contact');
            const contact = isWrapped ? payload.contact : payload;
            const blockId = isWrapped ? payload.blockId : undefined;

            // Validation stricte : jamais d'insertion d'un contact invalide (zéro corruption d'état).
            if (!contact || typeof contact !== 'object' || contact.id == null) {
                console.error(
                    '[DecompteSplitter] ADD_LOCAL_CONTACT rejeté : contact invalide.',
                    { payload: action.payload }
                );
                return state;
            }

            const blocks = blockId
                ? state.blocks.map(b => {
                    if (b.id !== blockId) return b;
                    const newRef = { kind: 'local', id: contact.id };
                    const linked = b.mailRecipientLinked !== false;
                    return {
                        ...b,
                        paymentRecipientRef: newRef,
                        paymentRecipientSnapshot: null,
                        ...(linked ? { mailRecipientRef: newRef, mailRecipientSnapshot: null } : {}),
                        recipientRef: newRef,
                        recipientSnapshot: null
                    };
                })
                : state.blocks;

            return {
                ...state,
                localContacts: [...sanitizeContactList(state.localContacts), contact],
                blocks
            };
        }

        case 'ADD_ALLOCATION':
        case 'ASSIGN_ALLOCATION': {
            const { expenseId, blockId, montant, status } = action.payload || {};
            if (expenseId == null || blockId == null) {
                console.error('[DecompteSplitter] ALLOCATION rejetée : payload invalide.', action.payload);
                return state;
            }
            const cleanedAllocs = state.allocations.filter(
                a => !(a.expenseId === expenseId && a.status === ALLOCATION_STATUS.SUSPENDED)
            );
            const newAlloc = {
                id: genId(),
                expenseId,
                blockId,
                montant: montant || '0,00',
                status: status || ALLOCATION_STATUS.ASSIGNED
            };
            return { ...state, allocations: [...cleanedAllocs, newAlloc] };
        }

        case 'REMOVE_ALLOCATION': {
            return { 
                ...state, 
                allocations: state.allocations.filter(a => a.id !== action.payload) 
            };
        }

        case 'SUSPEND_EXPENSE': {
            // Retire toutes les allocations existantes pour cet expense et ajoute une allocation "SUSPENDED"
            const otherAllocs = state.allocations.filter(a => a.expenseId !== action.payload.expenseId);
            const suspendedAlloc = {
                id: genId(),
                expenseId: action.payload.expenseId,
                blockId: null,
                montant: '0', // montant symbolique
                status: ALLOCATION_STATUS.SUSPENDED
            };
            return { ...state, allocations: [...otherAllocs, suspendedAlloc] };
        }

        case 'UNSUSPEND_EXPENSE': {
            return { 
                ...state, 
                allocations: state.allocations.filter(a => !(a.expenseId === action.payload.expenseId && a.status === ALLOCATION_STATUS.SUSPENDED)) 
            };
        }

        case 'PURGE_ORPHAN_ALLOCATIONS': {
            const validIds = new Set(action.payload?.activeExpenseIds || []);
            const purged = state.allocations.filter(a => validIds.has(a.expenseId));
            const removedCount = state.allocations.length - purged.length;
            if (removedCount > 0) {
                console.info(`[DecompteSplitter] Purge de ${removedCount} allocation(s) orpheline(s).`);
            }
            return removedCount > 0 ? { ...state, allocations: purged } : state;
        }

        default:
            if (import.meta.env.DEV) {
                console.error(`[DecompteSplitter] Action inconnue rejetée : "${action.type}"`, action);
            }
            return state;
    }
}

export const DecompteSplitterProvider = ({ children }) => {
    const { decompteSplitter, saveDecompteSplitterDraft, clearDecompteSplitterDraft } = useFinanceStore();
    const [state, dispatch] = useReducer(splitterReducer, null, () => {
        const draft = decompteSplitter.draft;
        if (!draft || !isDraftMeaningful(draft)) return initialState;
        // Restauration d'un draft meaningful : flag pour afficher le bandeau
        const migrated = migrateDraftRecipients(draft);
        return { ...migrated, localContacts: sanitizeContactList(migrated.localContacts), resumedFromDraft: true };
    });
    
    // Auto-save debounced vers le store global — sauvegarde null si état vide
    const timerRef = useRef(null);
    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            if (isDraftMeaningful(state)) {
                saveDecompteSplitterDraft(state);
            } else {
                // Pas de draft fantôme : un état vide efface le draft
                clearDecompteSplitterDraft();
            }
        }, 800);
        return () => clearTimeout(timerRef.current);
    }, [state, saveDecompteSplitterDraft, clearDecompteSplitterDraft]);

    return (
        <SplitterContext.Provider value={{ state, dispatch }}>
            {children}
        </SplitterContext.Provider>
    );
};

export const useDecompteSplitter = () => {
    const context = useContext(SplitterContext);
    if (!context) {
        throw new Error("useDecompteSplitter doit être utilisé dans un DecompteSplitterProvider");
    }
    return context;
};
