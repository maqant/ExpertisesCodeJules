import React from 'react';
import PrintReportSection from './PrintReportSection';

const PrintCircumstancesBlock = ({ data, styleBlock }) => {
    if (!data) return null;

    return (
        <PrintReportSection styleBlock={styleBlock}>
            {data.title && (
                <p className="font-bold underline mb-1" style={{ fontSize: `${(styleBlock?.fontSize || 12) + 2}px` }}>
                    {data.title}
                </p>
            )}

            {data.timeline && data.timeline.length > 0 ? (
                <div className="flex flex-col gap-3 mt-2 break-inside-avoid text-left">
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
            ) : (
                <p className="whitespace-pre-wrap break-words">
                    {data.texte}{' '}
                    {data.rapportCauseAnnexe && (
                        <span className="block text-[0.8em] text-slate-500 italic font-normal mt-1">
                            {data.rapportCauseAnnexe}
                        </span>
                    )}
                </p>
            )}
        </PrintReportSection>
    );
};

export default PrintCircumstancesBlock;
