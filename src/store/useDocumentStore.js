import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import localforage from 'localforage';

export const useDocumentStore = create(
    persist(
        (set, get) => ({
            documents: [], // Array of DocumentEntry

            // Ajouter des documents depuis l'ingestion (sans les attacher à un bloc)
            addDocuments: async (files) => {
                if (!files || files.length === 0) return;
                
                const currentDocs = get().documents;
                const newDocs = [];

                for (const rawFile of files) {
                    const id = crypto.randomUUID();
                    // Heuristique simplifiée pour la présentation
                    let kind = 'autre';
                    const nameLow = rawFile.name.toLowerCase();
                    if (nameLow.includes('cg') || nameLow.includes('conditions générales')) kind = 'CG';
                    else if (nameLow.includes('cp') || nameLow.includes('conditions particulières')) kind = 'CP';
                    else if (nameLow.includes('pv')) kind = 'PV';
                    else if (rawFile.type.startsWith('image/')) kind = 'photo';
                    else if (nameLow.includes('devis') || nameLow.includes('facture')) kind = 'financier';

                    const docEntry = {
                        id,
                        name: rawFile.name,
                        mimeType: rawFile.type || 'application/octet-stream',
                        size: rawFile.size,
                        origin: 'ingestion',
                        linkedBlocks: [],
                        kind,
                        usedByIA: true,
                        createdAt: Date.now()
                    };

                    newDocs.push(docEntry);

                    // Sauvegarde asynchrone du binaire dans localForage
                    try {
                        const arrayBuffer = await rawFile.arrayBuffer();
                        await localforage.setItem(`global_doc_${id}`, arrayBuffer);
                    } catch (e) {
                        console.error("[DocumentStore] Erreur sauvegarde localForage", e);
                    }
                }

                set({ documents: [...currentDocs, ...newDocs] });
            },

            // Charger un Blob depuis localForage
            hydrateBlob: async (docId) => {
                const arrayBuffer = await localforage.getItem(`global_doc_${docId}`);
                if (!arrayBuffer) return null;
                const docMeta = get().documents.find(d => d.id === docId);
                if (!docMeta) return null;
                return new Blob([arrayBuffer], { type: docMeta.mimeType });
            },

            // Trombone : lier
            attachToBlock: (docId, blockKey) => {
                set(state => ({
                    documents: state.documents.map(doc => {
                        if (doc.id === docId && !doc.linkedBlocks.includes(blockKey)) {
                            return { ...doc, linkedBlocks: [...doc.linkedBlocks, blockKey] };
                        }
                        return doc;
                    })
                }));
            },

            // Trombone : délier
            detachFromBlock: (docId, blockKey) => {
                set(state => ({
                    documents: state.documents.map(doc => {
                        if (doc.id === docId) {
                            return { ...doc, linkedBlocks: doc.linkedBlocks.filter(k => k !== blockKey) };
                        }
                        return doc;
                    })
                }));
            },

            // Sélecteur pour UI
            getByBlock: (blockKey) => {
                return get().documents.filter(doc => doc.linkedBlocks.includes(blockKey));
            },

            removeDocument: async (docId) => {
                set(state => ({ documents: state.documents.filter(d => d.id !== docId) }));
                await localforage.removeItem(`global_doc_${docId}`);
            },

            clearAll: async () => {
                const currentDocs = get().documents;
                set({ documents: [] });
                for (const doc of currentDocs) {
                    await localforage.removeItem(`global_doc_${doc.id}`);
                }
            }
        }),
        {
            name: 'expertise-global-documents',
            version: 1
        }
    )
);
