import React, { useState } from 'react';

const ValidationAiModal = ({ extractedData, onValidate, onCancel }) => {
    // Initialiser avec la première dépense extraite (s'il y en a une)
    const initialData = extractedData && extractedData.length > 0 ? extractedData[0] : {};

    const [formData, setFormData] = useState({
        prestataire: initialData.prestataire || '',
        type: initialData.type || 'Facture',
        ref: initialData.ref || '',
        desc: initialData.desc || '',
        montantReclame: initialData.montantReclame || '',
        typeMontant: initialData.typeMontant || 'HTVA'
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    return (
        <div className="bg-black/70 backdrop-blur-sm fixed inset-0 z-[200] flex items-center justify-center">
            <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl p-6 w-[500px] max-w-[90vw]">
                <h2 className="text-xl font-bold text-white mb-4 border-b border-slate-700 pb-2">
                    🪄 Validation IA
                </h2>
                <p className="text-sm text-slate-300 mb-4">
                    Vérifiez et complétez les informations extraites par l'IA avant de les ajouter.
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Prestataire</label>
                        <input
                            type="text"
                            name="prestataire"
                            value={formData.prestataire}
                            onChange={handleChange}
                            className="w-full bg-slate-900 border border-slate-600 text-white rounded p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                            placeholder="Nom du prestataire"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Type de document</label>
                            <select
                                name="type"
                                value={formData.type}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-600 text-white rounded p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                            >
                                <option value="Facture">Facture</option>
                                <option value="Devis">Devis</option>
                                <option value="Contrat">Contrat</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Référence</label>
                            <input
                                type="text"
                                name="ref"
                                value={formData.ref}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-600 text-white rounded p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                placeholder="Numéro de référence"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1">Description</label>
                        <textarea
                            name="desc"
                            value={formData.desc}
                            onChange={handleChange}
                            className="w-full bg-slate-900 border border-slate-600 text-white rounded p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none h-20"
                            placeholder="Description des travaux / objet"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Montant Réclamé</label>
                            <input
                                type="text"
                                name="montantReclame"
                                value={formData.montantReclame}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-600 text-white rounded p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-400 mb-1">Type Montant</label>
                            <select
                                name="typeMontant"
                                value={formData.typeMontant}
                                onChange={handleChange}
                                className="w-full bg-slate-900 border border-slate-600 text-white rounded p-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                            >
                                <option value="HTVA">HTVA</option>
                                <option value="TVAC">TVAC</option>
                                <option value="Forfait">Forfait</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-700">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-bold rounded transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={() => onValidate(formData)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded transition-colors shadow-lg"
                    >
                        Valider et Ajouter
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ValidationAiModal;
