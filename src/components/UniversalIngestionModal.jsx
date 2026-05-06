import React, { useContext, useState, useEffect, useRef } from 'react';
import { ExpertiseContext } from '../context/ExpertiseContext';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

// Configurer le worker pour react-pdf (correction Vercel 404)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const UniversalIngestionModal = ({ isOpen: propIsOpen, onClose: propOnClose }) => {
    const {
        ingestionModal,
        closeIngestion,
        setFormData,
        addExpense,
        updateExpense,
        expenses,
        handleAttachFile,
        handleAttachFreeAnnex,
        occupants,
        addOcc,
        franchises,
        formData
    } = useContext(ExpertiseContext);

    const isContextModalOpen = ingestionModal?.isOpen;
    const isOpen = propIsOpen || isContextModalOpen;
    const type = ingestionModal?.type;
    const file = ingestionModal?.file;
    const data = ingestionModal?.data;
    const existingId = ingestionModal?.existingId;

    const handleClose = () => {
        if (propOnClose) propOnClose();
        if (isContextModalOpen) closeIngestion();
    };
    const [fileUrl, setFileUrl] = useState(null);
    const [localData, setLocalData] = useState({});
    const [numPages, setNumPages] = useState(null);
    const containerRef = useRef(null);
    const [containerWidth, setContainerWidth] = useState(0);

    // Populate localData when modal opens
    useEffect(() => {
        if (isOpen) {
            if (type === 'frais' && existingId) {
                // Find existing expense and merge with any AI extracted data
                const existingExpense = expenses.find(e => e.id === existingId) || {};
                setLocalData({ ...existingExpense, ...(data || {}) });
            } else if (data) {
                setLocalData(data);
            } else {
                // Default empty data based on type
                if (type === 'cp') {
                    setLocalData({
                        numPolice: '', numConditionsGenerales: '', pertesIndirectes: '',
                        franchise: '', nomResidence: '', nomCie: '', nomContrat: ''
                    });
                } else if (type === 'frais') {
                    setLocalData({
                        prestataire: '', montant: '', montantReclame: '', typeMontant: 'HTVA',
                        type: 'Facture', ref: '', desc: '', compteDe: ''
                    });
                } else if (type === 'annexe') {
                    setLocalData({ customName: file?.name || '', desc: '' });
                }
            }
        }

        // Generate file URL for preview
        if (isOpen && file) {
            const url = URL.createObjectURL(file);
            setFileUrl(url);
            return () => {
                URL.revokeObjectURL(url);
            };
        }
    }, [isOpen, file, data, type, existingId, expenses]);

    // Update width for PDF rendering
    useEffect(() => {
        if (isOpen && containerRef.current) {
            const updateWidth = () => {
                if (containerRef.current) {
                    setContainerWidth(containerRef.current.clientWidth - 32); // Subtract padding
                }
            };
            updateWidth();
            window.addEventListener('resize', updateWidth);
            return () => window.removeEventListener('resize', updateWidth);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setLocalData(prev => ({ ...prev, [name]: value }));
    };

    const handleValidate = async () => {
        try {
            if (type === 'cp') {
                // Update global form data
                setFormData(prev => ({ ...prev, ...localData }));
                // Attach file
                if (file) await handleAttachFile('doc_cond_part', file);
            } else if (type === 'frais') {
                const finalMontantReclame = localData.montantReclame ? (isNaN(parseFloat(String(localData.montantReclame).replace(',', '.'))) ? '' : String(parseFloat(String(localData.montantReclame).replace(',', '.')))) : (localData.montant || '');
                if (existingId) {
                    // Update existing expense
                    const updates = {
                        prestataire: localData.prestataire || '',
                        type: localData.type || '',
                        ref: localData.ref || '',
                        desc: localData.desc || '',
                        compteDe: localData.compteDe || '',
                        montant: finalMontantReclame,
                        montantReclame: localData.montantReclame || '',
                        montantValide: localData.montantValide || '',
                        pourcentageVetuste: localData.pourcentageVetuste || 0,
                        motifRefus: localData.motifRefus || '',
                        typeMontant: localData.typeMontant || 'HTVA',
                        avisCouverture: localData.avisCouverture || 'Oui',
                        noteCouverture: localData.noteCouverture || ''
                    };
                    Object.keys(updates).forEach(key => {
                        updateExpense(existingId, key, updates[key]);
                    });
                    // Attach file
                    if (file) await handleAttachFile(existingId, file);
                } else {
                    // Add new expense
                    const newExpId = crypto.randomUUID();
                    const newExp = {
                        id: newExpId,
                        prestataire: localData.prestataire || '',
                        type: localData.type || '',
                        ref: localData.ref || '',
                        desc: localData.desc || '',
                        compteDe: localData.compteDe || '',
                        montant: finalMontantReclame,
                        montantReclame: localData.montantReclame || '',
                        montantValide: localData.montantValide || '',
                        pourcentageVetuste: localData.pourcentageVetuste || 0,
                        motifRefus: localData.motifRefus || '',
                        typeMontant: localData.typeMontant || 'HTVA',
                        avisCouverture: localData.avisCouverture || 'Oui',
                        noteCouverture: localData.noteCouverture || ''
                    };
                    addExpense(newExp);
                    // Attach file
                    if (file) await handleAttachFile(newExpId, file);
                }
            } else if (type === 'annexe') {
                if (file) await handleAttachFreeAnnex(file, localData.customName, localData.desc);
            }
        } catch (error) {
            console.error("[UniversalIngestionModal] Error during validation:", error);
            alert("Une erreur est survenue lors de la validation.");
        } finally {
            closeIngestion();
        }
    };

    const isImage = file?.type?.startsWith('image/');

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-slate-900 rounded-lg shadow-2xl flex flex-col overflow-hidden border border-slate-700 w-11/12 max-w-7xl h-[90vh]">

                {/* Header commun */}
                <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900">
                    <h2 className="text-lg font-bold text-indigo-300">
                        Sas d'Ingestion
                    </h2>
                    <button onClick={handleClose} className="text-slate-400 hover:text-white transition-colors text-xl leading-none">✕</button>
                </div>

                {/* Corps de la modale en Split-Screen */}
                <div className="flex-1 overflow-hidden grid grid-cols-2 gap-4 p-4">

                    {/* Left Column: Dropzone Placeholder */}
                    <div className="bg-slate-800/50 rounded-lg flex items-center justify-center p-6 border border-slate-700 overflow-hidden">
                        <div className="text-center text-slate-400">
                            <p className="text-lg font-medium">Espace future Zone d'Attente & Dropzone Multiple</p>
                        </div>
                    </div>

                    {/* Right Column: AI Form Placeholder */}
                    <div className="rounded-lg flex items-center justify-center p-6 border-2 border-dashed border-slate-600 overflow-hidden">
                        <div className="text-center text-slate-500">
                            <p className="text-lg font-medium">Espace futur formulaire de saisie IA</p>
                        </div>
                    </div>

                </div>

            </div>
        </div>
    );
};

export default UniversalIngestionModal;
