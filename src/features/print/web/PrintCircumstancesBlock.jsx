import React from 'react';
import PrintReportSection from './PrintReportSection';

/**
 * Bloc "Cause et description du sinistre" — rendu Web/Preview.
 *
 * INVARIANT MÉTIER : le texte officiel rédigé (formDataCause/texte) est
 * TOUJOURS rendu. La timeline (notes/documents) est un complément optionnel
 * affiché EN DESSOUS, jamais en remplacement (désactivable via data.showTimeline === false).
 */
const PrintCircumstancesBlock = ({ data, styleBlock }) => {
    if (!data) return null;

    const officialText = data.formDataCause || data.texte || '';
    const hasTimeline =
        Array.isArray(data.timeline) &&
        data.timeline.length > 0 &&
        data.showTimeline === true;

    return (
        <PrintReportSection styleBlock={styleBlock}>
            {data.title && (
                <p className="font-bold underline mb-1" style={{ fontSize: `${(styleBlock?.fontSize || 12) + 2}px` }}>
                    {data.title}
                </p>
            )}

            {/* 1. Texte officiel rédigé — rendu INCONDITIONNEL */}
            {officialText && (
                <p className="whitespace-pre-wrap break-words">
                    {officialText}{' '}
                    {data.rapportCauseAnnexe && (
                        <span className="block text-[0.8em] text-slate-500 italic font-normal mt-1">
                            {data.rapportCauseAnnexe}
                        </span>
                    )}
                </p>
            )}

            {/* 2. Timeline complémentaire — additive, jamais destructive */}
            {hasTimeline && (
                <div className="mt-3 break-inside-avoid text-left">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-2">
                        Historique chronologique (complément)
                    </p>
                    <div className="flex flex-col gap-3">
                        {data.timeline.map((item) => (
                            <div key={item.id} className={`p-3 rounded border-l-4 ${item.type === 'file' ? 'border-blue-500 bg-blue-50/50' : 'border-amber-500 bg-amber-50/50'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-bold text-slate-500">{item.date}</span>
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded border border-slate-200 bg-white text-slate-600">
                                        {item.type === 'file' ? '📄 DOCUMENT' : '📝 NOTE'}
                                    </span>
                                </div>
                                {item.type === 'file' ? (
                                    <p className="font-bold text-blue-900 m-0">{item.fileName}</p>
                                ) : (
                                    <p className="text-slate-800 whitespace-pre-wrap m-0">{item.content}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </PrintReportSection>
    );
};

export default PrintCircumstancesBlock;
