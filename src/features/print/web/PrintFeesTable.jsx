import React from 'react';
import PrintReportSection from './PrintReportSection';
import PrintFeesTableHeader from './PrintFeesTableHeader';
import PrintFeesTableRow from './PrintFeesTableRow';
import PrintFeesTableFooter from './PrintFeesTableFooter';
import { formatPDFAmount } from '../pdf/pdfFormatUtils';

const PrintFeesTable = ({ data, styleBlock, showSubtotals }) => {
    if (!data) return null;

    let decomptes = data.decomptes || [];
    if (decomptes.length === 0 && data.dettesParPersonne) {
        decomptes = Object.entries(data.dettesParPersonne).map(([personne, d]) => ({
            compteDeCourt: d.compteDeFormatted || personne,
            htvaFormate: formatPDFAmount(d.HTVA),
            totalFormate: formatPDFAmount(d.Total),
            tvacFormate: formatPDFAmount(d.TVAC),
            forfaitFormate: formatPDFAmount(d.Forfait),
            ...d
        }));
    }

    return (
        <PrintReportSection styleBlock={styleBlock} className="relative z-10">
            {data.title && (
                <p className="font-bold underline mb-2 break-inside-avoid" style={{ fontSize: `${(styleBlock?.fontSize || 12) + 2}px` }}>
                    {data.title}
                </p>
            )}
            <table className="w-full border-collapse mb-2 text-left break-inside-avoid table-fixed border border-slate-400" style={{ fontSize: `${styleBlock?.fontSize || 12}px` }}>
                <PrintFeesTableHeader />
                <tbody>
                    {data.lignes.map((exp) => (
                        <PrintFeesTableRow key={exp.id} exp={exp} />
                    ))}
                    <PrintFeesTableFooter 
                        hasLignes={data.lignes.length > 0} 
                        totalFraisFormate={data.totalFraisFormate} 
                    />
                </tbody>
            </table>
            
            {showSubtotals && decomptes.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-300 text-slate-700 break-inside-avoid" style={{ fontSize: `${styleBlock?.fontSize || 12}px` }}>
                    <p className="font-bold mb-2">Décompte par partie impliquée (total) :</p>
                    <ul className="list-none m-0 p-0 space-y-1">
                        {decomptes.map((dec) => (
                            <li key={dec.compteDeCourt} className="flex flex-col w-full mb-1">
                                <div className="flex justify-between w-2/3">
                                    <span>- {dec.compteDeCourt}</span>
                                    <span className="font-bold">{dec.totalFormate || dec.htvaFormate} €</span>
                                </div>
                                {dec.aVentilation && (
                                    <div className="text-[10px] text-slate-500 ml-4 mt-0.5">
                                        dont {[
                                            dec.HTVA ? `${dec.htvaFormate} € HTVA` : null,
                                            dec.TVAC ? `${dec.tvacFormate} € TVAC` : null,
                                            dec.Forfait ? `${dec.forfaitFormate} € forfait` : null
                                        ].filter(Boolean).join(' · ')}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </PrintReportSection>
    );
};

export default PrintFeesTable;
