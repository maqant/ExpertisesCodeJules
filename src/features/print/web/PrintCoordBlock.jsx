import React from 'react';
import PrintReportSection from './PrintReportSection';

const PrintCoordBlock = ({ data, styleBlock }) => {
    if (!data) return null;

    return (
        <PrintReportSection styleBlock={styleBlock}>
            {data.title && (
                <p className="font-bold underline mb-2" style={{ fontSize: `${(styleBlock?.fontSize || 12) + 2}px` }}>
                    {data.title}
                </p>
            )}
            <p className="break-words"><strong>Adresse :</strong> {data.adresse}</p>
            <p className="break-words"><strong>Franchise applicable :</strong> {data.franchise}</p>
            <p className="break-words"><strong>Pertes indirectes :</strong> {data.pertesIndirectes}</p>
            <p className="break-words"><strong>Expert :</strong> {data.expert}</p>
            {data.mailExpertiseAnnexe && (
                <p className="break-words text-[0.85em] text-slate-500 italic mt-1">{data.mailExpertiseAnnexe}</p>
            )}
            {data.contradictoire && (
                <div className="ml-4 mt-2 border-l-2 border-slate-800 pl-3">
                    <p className="italic underline mb-1 break-words">Expertise contradictoire avec :</p>
                    <p className="break-words"><strong>Cie :</strong> {data.contradictoire.cie}</p>
                    <p className="break-words"><strong>Expert :</strong> {data.contradictoire.expert}</p>
                    <p className="break-words"><strong>Pour le compte de :</strong> {data.contradictoire.compteDe}</p>
                </div>
            )}
        </PrintReportSection>
    );
};

export default PrintCoordBlock;
