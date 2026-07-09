import React from 'react';
import PrintReportSection from './PrintReportSection';

const PrintInfoBlock = ({ type, data, styleBlock }) => {
    if (!data) return null;

    return (
        <PrintReportSection styleBlock={styleBlock}>
            {data.title && (
                <p className="font-bold underline mb-2" style={{ fontSize: `${(styleBlock?.fontSize || 12) + 2}px` }}>
                    {data.title}
                </p>
            )}

            {type === 'coord' && (
                <>
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
                </>
            )}

            {type === 'infos' && (
                <>
                    <p className="break-words font-bold mb-1">
                        {data.sinistreDu}, {data.declareLe} {data.declarant}{' '}
                        {data.declarationAnnexe && (
                            <span className="text-[0.8em] text-slate-500 italic font-normal ml-1">{data.declarationAnnexe}</span>
                        )}
                    </p>
                    <p className="break-words"><strong>Compagnie :</strong> {data.nomCie}</p>
                    <p className="break-words">
                        <strong>Contrat :</strong> {data.nomContrat}{' '}
                        {data.condPartAnnexe && (
                            <span className="text-[0.8em] text-slate-500 italic font-normal ml-1">{data.condPartAnnexe}</span>
                        )}
                    </p>
                    <p className="break-words"><strong>N° Police :</strong> {data.numPolice}</p>
                    {data.numeroPVPolice && (
                        <p className="break-words">
                            <strong>N° PV Police :</strong> {data.numeroPVPolice}{' '}
                            {data.pvPoliceAnnexe && (
                                <span className="text-[0.8em] text-slate-500 italic font-normal ml-1">{data.pvPoliceAnnexe}</span>
                            )}
                        </p>
                    )}
                    {data.numConditionsGenerales && (
                        <p className="break-words">
                            <strong>N° Cond. Générales :</strong> {data.numConditionsGenerales}{' '}
                            {data.condGenAnnexe && (
                                <span className="text-[0.8em] text-slate-500 italic font-normal ml-1">{data.condGenAnnexe}</span>
                            )}
                        </p>
                    )}
                    <p className="break-words"><strong>N° Sinistre Cie :</strong> {data.numSinistreCie}</p>
                    {data.references && data.references.length > 0 && (
                        <div>
                            {data.references.map(r => (
                                <p key={r.id} className="break-words">
                                    <strong>{r.nom} {r.nom ? ':' : ''}</strong> {r.ref}
                                </p>
                            ))}
                        </div>
                    )}
                </>
            )}
        </PrintReportSection>
    );
};

export default PrintInfoBlock;
