import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { ExpertiseContext } from '../context/ExpertiseContext';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

// Configurer le worker pour react-pdf (correction Vercel 404)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Largeur fixe de rendu natif du PDF (le "vrai" contenu, indépendant du container)
// Cela découple la taille de rendu du viewport du zoom — clé de la fluidité
const PDF_RENDER_WIDTH = 760;

const UniversalIngestionModal = () => {
    const {
        ingestionModal,
        openIngestion,
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

    const { isOpen, type, file, data, existingId } = ingestionModal;
    const [fileUrl, setFileUrl] = useState(null);
    const [localData, setLocalData] = useState({});
    const [numPages, setNumPages] = useState(null);
    const [textContent, setTextContent] = useState('');

    // Populate localData when modal opens
    useEffect(() => {
        if (isOpen) {
            if (type === 'frais' && existingId) {
                const existingExpense = expenses.find(e => e.id === existingId) || {};
                setLocalData({ ...existingExpense, ...(data || {}) });
            } else if (data) {
                setLocalData(data);
            } else {
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

        if (isOpen && file) {
            const url = URL.createObjectURL(file);
            setFileUrl(url);
            if (file.type === 'text/plain') {
                file.text().then(setTextContent);
            } else {
                setTextContent('');
            }
            return () => { URL.revokeObjectURL(url); };
        }
    }, [isOpen, file, data, type, existingId, expenses]);

    const handlePasteText = async (e) => {
        if (e) e.stopPropagation();
        try {
            const text = await navigator.clipboard.readText();
            if (text && text.trim() !== '') {
                const newFile = new File([text], `Presse-papier.txt`, { type: "text/plain" });
                openIngestion(newFile, type, localData, existingId);
            } else {
                alert("Le presse-papier est vide ou ne contient pas de texte.");
            }
        } catch (err) {
            console.error("Erreur d'accès au presse-papier", err);
            alert("Impossible de lire le presse-papier. Vérifiez les autorisations du navigateur.");
        }
    };

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setLocalData(prev => ({ ...prev, [name]: value }));
    };

    const handleValidate = async () => {
        try {
            if (type === 'cp') {
                setFormData(prev => ({ ...prev, ...localData }));
                if (file) await handleAttachFile('doc_cond_part', file);
            } else if (type === 'frais') {
                const finalMontantReclame = localData.montantReclame
                    ? (isNaN(parseFloat(String(localData.montantReclame).replace(',', '.'))) ? '' : String(parseFloat(String(localData.montantReclame).replace(',', '.'))))
                    : (localData.montant || '');
                if (existingId) {
                    const existingExpense = expenses.find(e => e.id === existingId) || {};
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

                    // Stash previous data if the document type changes
                    if (existingExpense.type === 'Devis' && updates.type === 'Facture') {
                        updates.montantDevis = existingExpense.montant || existingExpense.montantReclame || '';
                        updates.refDevis = existingExpense.ref || '';
                        updates.prestataireDevis = existingExpense.prestataire || '';
                        updates.descDevis = existingExpense.desc || '';
                    } else if (existingExpense.type === 'Facture' && updates.type === 'Devis') {
                        updates.montantFacture = existingExpense.montant || existingExpense.montantReclame || '';
                        updates.refFacture = existingExpense.ref || '';
                        updates.prestataireFacture = existingExpense.prestataire || '';
                        updates.descFacture = existingExpense.desc || '';
                    }

                    Object.keys(updates).forEach(key => { updateExpense(existingId, key, updates[key]); });
                    if (file) await handleAttachFile(existingId, file, updates.type);
                } else {
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
                    if (file) await handleAttachFile(newExpId, file, newExp.type);
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
    const isText = file?.type === 'text/plain' || file?.name?.endsWith('.txt');

    return (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-slate-900 rounded-lg shadow-2xl flex flex-row overflow-hidden border border-slate-700 w-full max-w-[95vw] h-[90vh]">

                {/* Left Side: Document Preview (w-2/3) */}
                <div className="w-2/3 bg-slate-800 border-r border-slate-700 p-4 flex flex-col h-full overflow-hidden">
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-white font-bold flex items-center gap-2">
                            <span>📄</span> Document : {file?.name || 'Aucun fichier'}
                        </h2>
                        <button onClick={handlePasteText} className="text-xs text-slate-400 hover:text-indigo-300 transition-colors bg-slate-700/50 hover:bg-slate-700 px-2 py-1 rounded" title="Coller depuis le presse-papier">
                            📋 Coller texte
                        </button>
                    </div>
                    <div className="flex-1 bg-slate-950 rounded-lg border border-slate-700 overflow-hidden relative">
                        {fileUrl ? (
                            <TransformWrapper
                                initialScale={1}
                                minScale={0.1}
                                maxScale={8}
                                centerOnInit={false}
                                limitToBounds={false}
                                wheel={{ step: 0.05, smoothStep: 0.003 }}
                                panning={{ velocityDisabled: false }}
                            >
                                {({ zoomIn, zoomOut, resetTransform, centerView }) => (
                                    <div className="relative w-full h-full flex flex-col">
                                        
                                        {/* Barre d'outils de Zoom flottante */}
                                        <div className="absolute top-4 right-4 z-50 flex gap-2 bg-slate-800/90 p-1.5 rounded-lg border border-slate-600 backdrop-blur-md shadow-lg">
                                            <button onClick={() => zoomIn()} className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white rounded text-lg font-bold transition-colors">+</button>
                                            <button onClick={() => zoomOut()} className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white rounded text-lg font-bold transition-colors">-</button>
                                            <button onClick={() => centerView(1, 200)} className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors" title="Centrer">↺</button>
                                        </div>

                                        <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full flex flex-col items-center justify-center py-4">
                                            {isText ? (
                                                <div className="w-full h-full p-6 text-left overflow-auto text-[13px] whitespace-pre-wrap font-mono text-slate-300 break-words max-w-[800px] mx-auto bg-slate-900 border border-slate-700 rounded shadow-xl">
                                                    {textContent || 'Chargement...'}
                                                </div>
                                            ) : isImage ? (
                                                <img src={fileUrl} alt="Aperçu" className="max-w-full max-h-full object-contain rounded shadow-xl" />
                                            ) : (
                                                <Document
                                                    file={file}
                                                    onLoadSuccess={(data) => {
                                                        setNumPages(data.numPages);
                                                        // Double rAF pour garantir le rendu avant centrage parfait (sans animation : 0ms)
                                                        requestAnimationFrame(() => {
                                                            requestAnimationFrame(() => {
                                                                centerView(1, 0);
                                                            });
                                                        });
                                                    }}
                                                    loading={<div className="text-slate-400 text-sm font-bold animate-pulse">⏳ Chargement du document...</div>}
                                                    error={<div className="text-red-400 text-sm font-bold">❌ Erreur lors du chargement du PDF.</div>}
                                                    className="flex flex-col gap-4 w-full items-center"
                                                >
                                                    {Array.from(new Array(numPages), (el, index) => (
                                                        <div key={`page_${index + 1}`} className="shadow-2xl border border-slate-700 rounded overflow-hidden bg-white">
                                                            <Page
                                                                pageNumber={index + 1}
                                                                width={760} 
                                                                renderTextLayer={false}
                                                                renderAnnotationLayer={false}
                                                            />
                                                        </div>
                                                    ))}
                                                </Document>
                                            )}
                                        </TransformComponent>
                                    </div>
                                )}
                            </TransformWrapper>
                        ) : (
                            <div className="text-slate-500 text-sm flex items-center justify-center h-full w-full">Aucun aperçu disponible</div>
                        )}
                    </div>
                </div>

                {/* Right Side: Form (w-1/3) */}
                <div className="w-1/3 bg-slate-900 p-6 flex flex-col h-full overflow-y-auto">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold text-indigo-300">
                            {type === 'cp' ? 'Conditions Particulières' : type === 'frais' ? (existingId ? 'Modifier Ligne de Frais' : 'Nouvelle Ligne de Frais') : 'Nouvelle Annexe Libre'}
                        </h2>
                        <button onClick={closeIngestion} className="text-slate-400 hover:text-white transition-colors">✕</button>
                    </div>

                    <div className="flex-1 space-y-4">
                        {type === 'cp' && (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1">Nom Compagnie</label>
                                    <input type="text" name="nomCie" value={localData.nomCie || ''} onChange={handleChange} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1">Nom Contrat</label>
                                    <input type="text" name="nomContrat" value={localData.nomContrat || ''} onChange={handleChange} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1">N° Police</label>
                                    <input type="text" name="numPolice" value={localData.numPolice || ''} onChange={handleChange} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1">N° Cond. Générales</label>
                                    <input type="text" name="numConditionsGenerales" value={localData.numConditionsGenerales || ''} onChange={handleChange} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1">Franchise</label>
                                    <input type="text" name="franchise" value={localData.franchise || ''} onChange={handleChange} list="franchise-list" className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm" />
                                    <datalist id="franchise-list">
                                        {franchises.map((f, idx) => <option key={idx} value={f} />)}
                                    </datalist>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1">Pertes indirectes</label>
                                    <select name="pertesIndirectes" value={localData.pertesIndirectes || ''} onChange={handleChange} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm">
                                        <option value="">Sélectionner...</option>
                                        <option value="0%">0%</option>
                                        <option value="5%">5%</option>
                                        <option value="10%">10%</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1">Nom Résidence (Preneur)</label>
                                    <input type="text" name="nomResidence" value={localData.nomResidence || ''} onChange={handleChange} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm" />
                                </div>
                            </>
                        )}

                        {type === 'frais' && (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1">Prestataire</label>
                                    <input type="text" name="prestataire" value={localData.prestataire || ''} onChange={handleChange} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm font-bold text-indigo-300" />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-300 mb-1">Montant réclamé</label>
                                        <input type="text" name="montantReclame" value={localData.montantReclame || localData.montant || ''} onChange={handleChange} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm font-bold" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-300 mb-1">Type de montant</label>
                                        <select name="typeMontant" value={localData.typeMontant || 'HTVA'} onChange={handleChange} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm">
                                            <option value="HTVA">HTVA</option>
                                            <option value="TVAC">TVAC</option>
                                            <option value="Forfait">Forfait</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-300 mb-1">Type de document</label>
                                        <select name="type" value={localData.type || 'Facture'} onChange={handleChange} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm">
                                            <option value="Facture">Facture</option>
                                            <option value="Devis">Devis</option>
                                            <option value="Autre">Autre</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-300 mb-1">Référence</label>
                                        <input type="text" name="ref" value={localData.ref || ''} onChange={handleChange} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1">Description</label>
                                    <textarea name="desc" value={localData.desc || ''} onChange={handleChange} rows="2" className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm resize-none" />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1">Pour le compte de</label>
                                    <select
                                        name="compteDe"
                                        value={localData.compteDe || ''}
                                        onChange={(e) => {
                                            if (e.target.value === 'CREATE_NEW') {
                                                const newId = addOcc();
                                                setLocalData(prev => ({ ...prev, compteDe: newId }));
                                            } else {
                                                handleChange(e);
                                            }
                                        }}
                                        className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm border-indigo-500"
                                    >
                                        <option value="">Choisissez...</option>
                                        {occupants.filter(o => o.nom).map(o => {
                                            const fullName = `${o.nom || ''} ${o.prenom || ''}`.trim();
                                            const displayName = o.etage && o.etage.trim() !== '' ? `${o.etage} - ${fullName}` : fullName;
                                            return <option key={o.id} value={o.id}>{displayName}</option>;
                                        })}
                                        <option disabled>──────────</option>
                                        <option value="CREATE_NEW">[ + Créer une nouvelle partie ]</option>
                                    </select>
                                </div>
                            </>
                        )}

                        {type === 'annexe' && (
                            <>
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1">Titre de l'annexe</label>
                                    <input type="text" name="customName" value={localData.customName || ''} onChange={handleChange} className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 mb-1">Description (Optionnelle)</label>
                                    <textarea name="desc" value={localData.desc || ''} onChange={handleChange} rows="4" className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white focus:border-indigo-500 outline-none text-sm resize-none" />
                                </div>
                            </>
                        )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-700 flex justify-end gap-3 shrink-0">
                        <button onClick={closeIngestion} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded font-bold text-sm transition-colors">
                            Annuler
                        </button>
                        <button onClick={handleValidate} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold shadow transition-colors text-sm">
                            Valider
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UniversalIngestionModal;
