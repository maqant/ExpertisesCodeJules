import React from 'react';
import PrintReportSection from './PrintReportSection';

const PrintAnnexesBlock = ({ data, styleBlock }) => {
    if (!data) return null;

    return (
        <PrintReportSection styleBlock={styleBlock}>
            {data.title && (
                <p className="font-bold underline mb-2 break-inside-avoid" style={{ fontSize: `${(styleBlock?.fontSize || 12) + 2}px` }}>
                    {data.title}
                </p>
            )}
            <ul className="list-disc pl-5 m-0 text-slate-800">
                {data.fichiers.map(f => (
                    <li key={f.id} className="mb-1 leading-snug break-inside-avoid">
                        <strong>{f.nom}</strong>
                        {f.hasPages ? <span className="ml-1 text-[0.8em] text-slate-500 italic">({f.pages} page{f.pages > 1 ? 's' : ''})</span> : ''}
                    </li>
                ))}
            </ul>
        </PrintReportSection>
    );
};

export default PrintAnnexesBlock;
