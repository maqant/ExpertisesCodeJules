import React, { useContext, useRef } from 'react';
import { ExpertiseContext } from '../../context/ExpertiseContext';

const ReferenceManagerPanel = () => {
    const { exportReferenceData, importReferenceData } = useContext(ExpertiseContext);
    const fileInputRef = useRef(null);

    const handleExport = () => {
        if (!exportReferenceData) {
            alert("Erreur: L'exportation n'est pas disponible.");
            return;
        }
        try {
            exportReferenceData();
        } catch (e) {
            alert("Erreur lors de l'exportation: " + e.message);
        }
    };

    const handleImportClick = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            if (importReferenceData) {
                importReferenceData(text);
                alert("Importation réussie ! Vos référentiels ont été fusionnés.");
            } else {
                alert("Erreur: L'importation n'est pas disponible.");
            }
        } catch (err) {
            alert("Échec de l'importation :\n" + err.message);
        } finally {
            // Reset input so the same file can be selected again if needed
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const confirmClearStorage = () => {
        if (window.confirm("⚠️ ATTENTION : Voulez-vous vraiment effacer TOUTES les données de l'application (Dossiers, Référentiels, Configuration) ? Cette action est IRRÉVERSIBLE.")) {
            if (window.confirm("Êtes-vous ABSOLUMENT certain ?")) {
                localStorage.clear();
                alert("Toutes les données ont été effacées. L'application va recharger.");
                window.location.reload();
            }
        }
    };

    return (
        <div className="mt-4 p-3 bg-slate-900 border border-slate-700 rounded-lg">
            <h3 className="text-xs font-bold text-indigo-400 mb-2 uppercase tracking-wider">Référentiels & Données</h3>
            <p className="text-[10px] text-slate-400 mb-3">
                Gérez vos experts, franchises et prestataires. Exportez pour sauvegarder, importez pour restaurer ou fusionner depuis un autre appareil.
            </p>
            
            <div className="flex flex-col gap-2">
                <button 
                    onClick={handleExport}
                    className="flex items-center justify-center w-full px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded transition-colors"
                    title="Télécharger une sauvegarde de vos référentiels (Experts, Franchises, Prestataires)"
                >
                    ⬇️ Exporter (Sauvegarde)
                </button>
                
                <button 
                    onClick={handleImportClick}
                    className="flex items-center justify-center w-full px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-indigo-100 text-xs rounded transition-colors border border-slate-600"
                    title="Restaurer une sauvegarde (fusionne sans supprimer l'existant)"
                >
                    ⬆️ Importer (Restauration)
                </button>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept=".json" 
                    className="hidden" 
                />

                <div className="mt-3 pt-3 border-t border-red-900/50">
                    <button 
                        onClick={confirmClearStorage}
                        className="flex items-center justify-center w-full px-3 py-1 bg-red-900/30 hover:bg-red-800/50 text-red-400 text-[10px] rounded transition-colors border border-red-900/50"
                        title="Efface le localStorage entier"
                    >
                        🗑️ Effacer toutes les données locales
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReferenceManagerPanel;
