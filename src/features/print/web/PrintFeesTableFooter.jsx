import React from 'react';

const PrintFeesTableFooter = ({ totalFraisFormate, hasLignes }) => {
    return (
        <>
            {hasLignes ? (
                <tr className="bg-slate-50 font-bold break-inside-avoid">
                    <td colSpan="5" className="border border-slate-400 p-1.5 text-right uppercase text-[0.85em] tracking-tight">TOTAL DE LA RÉCLAMATION</td>
                    <td className="border border-slate-400 p-1.5 text-right whitespace-nowrap text-indigo-900 align-top">{totalFraisFormate} €</td>
                </tr>
            ) : (
                <tr>
                    <td colSpan="6" className="border border-slate-400 p-2 text-center italic opacity-50">Aucun frais encodé</td>
                </tr>
            )}
        </>
    );
};

export default PrintFeesTableFooter;
