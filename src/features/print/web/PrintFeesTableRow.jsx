import React from 'react';

const PrintFeesTableRow = ({ exp }) => {
    return (
        <tr className="break-inside-avoid">
            <td className="border border-slate-400 p-1 text-center align-top">{exp.index}</td>
            <td className="border border-slate-400 p-1 break-words align-top">{exp.prestataire}</td>
            <td className="border border-slate-400 p-1 break-words align-top text-[0.9em]">
                {exp.type} {exp.ref ? `/ ${exp.ref}` : ''}
            </td>
            <td className="border border-slate-400 p-1 break-words align-top">
                {exp.desc}
                {exp.annexReference && (
                    <span className="print-fee-annex-reference block text-[0.8em] text-slate-500 mt-1 italic">
                        {exp.annexReference}
                    </span>
                )}
            </td>
            <td className="border border-slate-400 p-1 break-words align-top">{exp.compteDeCourt}</td>
            <td className="border border-slate-400 p-1 text-right font-bold align-top leading-tight">
                {exp.montantFormate ? (
                    <>
                        <div className="whitespace-nowrap">{exp.montantFormate} €</div>
                        {exp.isFranchise ? (
                            <div className="text-[0.75em] px-1.5 py-0.5 rounded-full text-white inline-block mt-0.5 bg-purple-800 uppercase tracking-wide">
                                FRANCHISE
                            </div>
                        ) : (
                            <div className="text-[0.75em] font-normal opacity-80 uppercase">{exp.typeMontant}</div>
                        )}
                    </>
                ) : ''}
            </td>
        </tr>
    );
};

export default PrintFeesTableRow;
