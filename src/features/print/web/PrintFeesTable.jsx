import React from 'react';
import PrintReportSection from './PrintReportSection';
import PrintFeesTableHeader from './PrintFeesTableHeader';
import PrintFeesTableRow from './PrintFeesTableRow';
import PrintFeesTableFooter from './PrintFeesTableFooter';

const PrintFeesTable = ({ data, styleBlock, showSubtotals }) => {
    if (!data) return null;

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
            
            {showSubtotals && data.decomptes && data.decomptes.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-300 text-slate-700 break-inside-avoid" style={{ fontSize: `${styleBlock?.fontSize || 12}px` }}>
                    <p className="font-bold mb-2">Décompte par partie impliquée (HTVA) :</p>
                    <ul className="list-none m-0 p-0 space-y-1">
                        {data.decomptes.map((dec) => (
                            <li key={dec.compteDeCourt} className="flex justify-between w-2/3">
                                <span>- {dec.compteDeCourt}</span>
                                <span className="font-bold">{dec.htvaFormate} €</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </PrintReportSection>
    );
};

export default PrintFeesTable;
