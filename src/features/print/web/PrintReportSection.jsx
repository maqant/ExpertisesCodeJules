import React from 'react';

const PrintReportSection = ({ styleBlock, children, className = '' }) => {
    // Default styling if some props are missing, matching what was in PrintPreview
    const fontSize = styleBlock?.fontSize || 12;
    const color = styleBlock?.color || '#0f172a';
    const fontFamily = styleBlock?.fontFamily || 'Arial';
    const textAlign = styleBlock?.textAlign || 'left';
    
    return (
        <div className={`mb-6 break-inside-avoid relative z-10 ${className}`} style={{ fontSize: `${fontSize}px`, color, fontFamily, textAlign }}>
            <div className={`${styleBlock?.border ? 'border-2 border-current p-3 rounded' : ''} bg-white`}>
                {children}
            </div>
        </div>
    );
};

export default PrintReportSection;
