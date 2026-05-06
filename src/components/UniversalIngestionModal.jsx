import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { ExpertiseContext } from '../context/ExpertiseContext';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useDropzone } from 'react-dropzone';
import { FileText, UploadCloud } from 'lucide-react';

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
    const [pendingFiles, setPendingFiles] = useState([]);

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

    const onDrop = useCallback((acceptedFiles) => {
        setPendingFiles((prev) => [
            ...prev,
            ...acceptedFiles.map(f => ({ file: f, id: crypto.randomUUID(), status: 'idle' }))
        ]);
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        multiple: true,
        accept: {
            'application/pdf': ['.pdf'],
            'image/jpeg': ['.jpeg', '.jpg'],
            'image/png': ['.png'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-outlook': ['.msg']
        }
    });

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

                    {/* Left Column: Dropzone Multiple et Zone d'Attente */}
                    <div className="bg-slate-800/50 rounded-lg flex flex-col p-4 border border-slate-700 overflow-y-auto">
                        <div
                            {...getRootProps()}
                            className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors
                                ${isDragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-600 hover:border-indigo-400 hover:bg-slate-800'}`}
                        >
                            <input {...getInputProps()} />
                            <UploadCloud className="text-slate-400 mb-2" size={32} />
                            <p className="text-slate-300 font-medium text-center">
                                {isDragActive ? "Déposez les fichiers ici..." : "Glissez & déposez jusqu'à 300 fichiers ici"}
                            </p>
                            <p className="text-slate-500 text-sm mt-1 text-center">
                                Formats acceptés : .pdf, .jpg, .png, .doc, .docx, .xls, .xlsx, .msg
                            </p>
                        </div>

                        {/* Zone d'Attente (Liste UI) */}
                        {pendingFiles.length > 0 && (
                            <div className="mt-4 flex flex-col gap-2">
                                <h3 className="text-slate-300 font-semibold mb-1 text-sm">Fichiers en attente ({pendingFiles.length})</h3>
                                {pendingFiles.map((pf) => (
                                    <div key={pf.id} className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded p-2">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <FileText size={16} className="text-slate-400 shrink-0" />
                                            <span className="text-slate-200 text-sm truncate" title={pf.file.name}>
                                                {pf.file.name}
                                            </span>
                                        </div>
                                        {pf.status === 'idle' && (
                                            <span className="bg-slate-700 text-slate-300 rounded px-2 py-1 text-xs shrink-0 border border-slate-600">
                                                En attente
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
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
