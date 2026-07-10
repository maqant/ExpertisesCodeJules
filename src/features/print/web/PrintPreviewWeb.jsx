import React, { useState } from 'react';

import PrintReportHeader from './PrintReportHeader';
import PrintCoordBlock from './PrintCoordBlock';
import PrintInfoBlock from './PrintInfoBlock';
import PrintCircumstancesBlock from './PrintCircumstancesBlock';
import PrintOrganisationBlock from './PrintOrganisationBlock';
import PrintFeesTable from './PrintFeesTable';
import PrintFeesDetailBlock from './PrintFeesDetailBlock';
import PrintImagesBlock from './PrintImagesBlock';
import PrintDiversBlock from './PrintDiversBlock';
import PrintCustomBlock from './PrintCustomBlock';

import { generatePdfReportBlob } from '../pdf/generatePdfReport';
import { revokePdfImageBlobUrls } from '../pdf/resolvePdfImages';
import { fetchBlob } from '../../../services/attachmentStorage';

const PrintPreviewWeb = ({ reportData, onPrint, onBack }) => {
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [pdfError, setPdfError] = useState(null);

    if (!reportData) return null;
    const styles = reportData.meta.styles;

    const handleExportPdf = async () => {
        setIsGeneratingPdf(true);
        setPdfError(null);
        let generatedData = null;
        try {
            const { blob, resolvedReportData } = await generatePdfReportBlob({ reportData, fetchBlobByUuid: fetchBlob });
            generatedData = resolvedReportData;

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Rapport_Expertise_${reportData?.infos?.formData?.numSinistreCie || 'Export'}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Erreur lors de la génération PDF:", error);
            setPdfError(error.message || "Une erreur est survenue lors de la génération du PDF.");
        } finally {
            if (generatedData) {
                revokePdfImageBlobUrls(generatedData);
            }
            setIsGeneratingPdf(false);
        }
    };

    const renderBlocksInOrder = () => {
        return reportData.meta.orderedBlocks.map(key => {
            if (key === 'titre') {
                return <PrintReportHeader key="titre" data={reportData.titre} styleBlock={styles.titre} />;
            }
            if (key === 'coord') {
                return <PrintCoordBlock key="coord" data={reportData.coord} styleBlock={styles.coord} />;
            }
            if (key === 'infos') {
                return <PrintInfoBlock key="infos" data={reportData.infos} styleBlock={styles.infos} />;
            }
            if (key === 'cause') {
                return <PrintCircumstancesBlock key="cause" data={reportData.cause} styleBlock={styles.cause} />;
            }
            if (key === 'orga') {
                return <PrintOrganisationBlock key="orga" data={reportData.orga} styleBlock={styles.orga} metadata={reportData.metadata} />;
            }
            if (key === 'frais') {
                return <PrintFeesTable key="frais" data={reportData.frais} styleBlock={styles.frais} metadata={reportData.metadata} />;
            }
            if (key === 'frais_liste') {
                return <PrintFeesDetailBlock key="frais_liste" data={reportData.frais} styleBlock={styles.frais_liste || styles.frais} showSubtotals={reportData.metadata.showSubtotals} />;
            }
            if (key === 'photos') {
                return <PrintImagesBlock key="photos" data={reportData.photos} styleBlock={styles.photos} />;
            }
            if (key === 'divers') {
                return <PrintDiversBlock key="divers" data={reportData.divers} styleBlock={styles.divers} />;
            }
            if (key.startsWith('spacer_')) {
                const heightMm = styles[key]?.spacerHeight || 20;
                const clampedHeight = Math.max(1, Math.min(heightMm, 100));
                return (
                    <div 
                        key={key} 
                        style={{ height: `${clampedHeight}mm` }} 
                        className="print-spacer w-full border-t border-b border-dashed border-transparent print:border-none" 
                    />
                );
            }
            if (key.startsWith('custom_')) {
                const blockData = reportData.customBlocks.find(b => b.id === key);
                return <PrintCustomBlock key={key} data={blockData} styleBlock={styles[key]} />;
            }
            return null;
        });
    };

    return (
        <div className="flex flex-col min-h-screen w-full bg-slate-200">
            {/* Top Toolbar (Non imprimable) */}
            <div className="print:hidden bg-slate-900 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-50">
                <div>
                    <h2 className="text-lg font-bold">👁️ Aperçu Avant Impression</h2>
                    <p className="text-xs text-slate-400">Le contenu est automatiquement paginé. Redimensionnez ou appuyez sur Imprimer pour voir le rendu exact.</p>
                    {pdfError && <p className="text-xs text-red-400 mt-1">{pdfError}</p>}
                </div>
                <div className="flex gap-4">
                    <button onClick={onBack} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded font-bold text-sm transition-colors">
                        ⬅️ Retour à l'éditeur
                    </button>
                    <button 
                        onClick={handleExportPdf} 
                        disabled={isGeneratingPdf}
                        className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 px-6 py-2 rounded font-bold text-sm shadow-lg transition-colors flex items-center gap-2"
                    >
                        {isGeneratingPdf ? '⏳ Génération...' : '📄 Exporter PDF'}
                    </button>
                    <button onClick={onPrint} className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded font-bold text-sm shadow-lg transition-colors">
                        🖨️ Lancer l'impression
                    </button>
                </div>
            </div>

            {/* A4 Container */}
            <div className="flex-1 flex justify-center py-12 print:py-0 print:block overflow-auto">
                <div className="bg-white text-slate-900 shadow-2xl print:shadow-none w-[210mm] max-w-full print:w-full min-h-[297mm] p-[15mm] mx-auto print:mx-0 print:p-0 break-words relative">
                    {/* Lignes de coupe visuelles pour l'écran */}
                    <div className="print:hidden">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                            <div key={i} className="absolute left-0 right-0 border-b-2 border-dashed border-red-400/40 pointer-events-none z-0" style={{ top: `${i * 297}mm` }}>
                                <span className="absolute right-2 bottom-0 text-[10px] text-red-400/60 font-bold">✂️ Fin de page {i}</span>
                            </div>
                        ))}
                    </div>
                    {renderBlocksInOrder()}
                </div>
            </div>

            {/* Styles supplémentaires pour l'impression du mode Preview */}
            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 15mm; }
                    body { background: white !important; margin: 0; padding: 0; overflow: visible !important; }
                    .break-inside-avoid { page-break-inside: avoid; break-inside: avoid; }
                }
            `}</style>
        </div>
    );
};

export default PrintPreviewWeb;
