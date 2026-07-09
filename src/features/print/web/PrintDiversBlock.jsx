import React from 'react';
import PrintReportSection from './PrintReportSection';

const PrintDiversBlock = ({ data, styleBlock }) => {
    if (!data) return null;

    return (
        <PrintReportSection styleBlock={styleBlock}>
            {data.title && (
                <p className="font-bold underline mb-2 break-inside-avoid" style={{ fontSize: `${(styleBlock?.fontSize || 12) + 2}px` }}>
                    {data.title}
                </p>
            )}
            <p className="whitespace-pre-wrap break-words break-inside-avoid">
                {data.texte}
            </p>
        </PrintReportSection>
    );
};

export default PrintDiversBlock;
