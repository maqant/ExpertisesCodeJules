import React from 'react';
import PrintReportSection from './PrintReportSection';

const PrintReportHeader = ({ data, styleBlock }) => {
    if (!data) return null;
    
    const fontSize = styleBlock?.fontSize || 12;
    const color = styleBlock?.color || '#0f172a';
    const fontFamily = styleBlock?.fontFamily || 'Arial';
    const textAlign = styleBlock?.textAlign || 'left';
    
    return (
        <div className="mb-6 break-inside-avoid relative z-10" style={{ fontSize: `${fontSize}px`, color, fontFamily, textAlign }}>
            <div className={`${styleBlock?.border ? 'border-2 border-current p-4 rounded' : ''} bg-white`}>
                <p className="font-bold uppercase break-words">{data.dateFormatted}</p>
            </div>
        </div>
    );
};

export default PrintReportHeader;
