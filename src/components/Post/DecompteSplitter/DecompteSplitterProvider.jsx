import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { useFinanceStore } from '../../../store/financeStore.js';
import { ALLOCATION_STATUS, CLOSURE_MODE, genId } from '../../../domain/decompteSplitter/allocationModel.js';

const SplitterContext = createContext(null);

const initialState = {
    version: 1,
    sourceExpenseIds: [],
    allocations: [],
    blocks: [],
    localContacts: [],
    unassignedPolicy: 'strict',
    extractedExpenses: [],
    ingestionStatus: 'idle', // 'idle' | 'uploading' | 'parsing' | 'ready' | 'ready_payment' | 'error'
    ingestionError: null,
    documentType: null, // 'DECOMPTE' | 'LETTRE_PAIEMENT' | null
    detectedPayment: null // { montant, beneficiaire, date, reference, communication }
};

function splitterReducer(state, action) {
    switch (action.type) {
        case 'INIT_DRAFT':
            return action.payload || initialState;

        case 'INGESTION_START':
            return { ...state, ingestionStatus: 'parsing', ingestionError: null };
            
        case 'INGESTION_UPLOADING':
            return { ...state, ingestionStatus: 'uploading', ingestionError: null };
            
        case 'INGESTION_SUCCESS':
            return { ...state, ingestionStatus: 'ready', documentType: 'DECOMPTE', extractedExpenses: action.payload, ingestionError: null };
            
        case 'INGESTION_ERROR':
            return { ...state, ingestionStatus: 'error', ingestionError: action.payload };

        case 'PAYMENT_INGESTION_SUCCESS':
            return {
                ...state,
                ingestionStatus: 'ready_payment',
                documentType: 'LETTRE_PAIEMENT',
                detectedPayment: action.payload,
                ingestionError: null
            };

        case 'UPDATE_DETECTED_PAYMENT':
            return {
                ...state,
                detectedPayment: { ...state.detectedPayment, ...action.payload }
            };
            
        case 'RESET_INGESTION':
            // Reset ingestion and allocations since source changes
            return { ...state, ingestionStatus: 'idle', documentType: null, extractedExpenses: [], detectedPayment: null, ingestionError: null, allocations: [], blocks: [] };

        case 'ADD_BLOCK': {
            const newBlock = {
                id: genId(),
                recipientRef: null,
                recipientSnapshot: null,
                ibanOverride: '',
                closureMode: CLOSURE_MODE.ATTENTE,
                remarque: ''
            };
            return { ...state, blocks: [...state.blocks, newBlock] };
        }

        case 'REMOVE_BLOCK': {
            // Supprimer le bloc ET réaffecter ses allocations (les supprimer revient à les remettre "à ventiler")
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

        case 'SET_BLOCK_RECIPIENT': {
            const { blockId, recipientRef } = action.payload;
            return {
                ...state,
                blocks: state.blocks.map(b =>
                    b.id === blockId ? { ...b, recipientRef, recipientSnapshot: null } : b
                )
            };
        }

        case 'ADD_LOCAL_CONTACT': {
            const { contact, blockId } = action.payload;
            const blocks = blockId
                ? state.blocks.map(b =>
                    b.id === blockId
                        ? { ...b, recipientRef: { kind: 'local', id: contact.id }, recipientSnapshot: null }
                        : b
                )
                : state.blocks;
            return {
                ...state,
                localContacts: [...(state.localContacts || []), contact],
                blocks
            };
        }

        case 'ASSIGN_ALLOCATION': {
            // Assigner un montant d'un expenseId vers un blockId
            const newAlloc = {
                id: genId(),
                expenseId: action.payload.expenseId,
                blockId: action.payload.blockId,
                montant: action.payload.montant,
                status: ALLOCATION_STATUS.ASSIGNED
            };
            return { ...state, allocations: [...state.allocations, newAlloc] };
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

        default:
            return state;
    }
}

export const DecompteSplitterProvider = ({ children }) => {
    const { decompteSplitter, saveDecompteSplitterDraft } = useFinanceStore();
    const [state, dispatch] = useReducer(splitterReducer, decompteSplitter.draft || initialState);
    
    // Auto-save debouncé vers le store global
    const timerRef = useRef(null);
    useEffect(() => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            saveDecompteSplitterDraft(state);
        }, 800);
        return () => clearTimeout(timerRef.current);
    }, [state, saveDecompteSplitterDraft]);

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
