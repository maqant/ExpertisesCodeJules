import React, { useState } from 'react';

const DropZone = ({ onFiles, label = "Glisser ici", accept = "*", className = "", onDragFinish }) => {
    const [isOver, setIsOver] = useState(false);
    return (
        <div 
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsOver(false); if (onDragFinish) onDragFinish(); }}
            onDrop={async (e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                setIsOver(false); 
                if (onDragFinish) onDragFinish(); 
                if (e.dataTransfer.files) {
                    const { cloneFilesEagerly } = await import('../services/utils/aiHelpers.js');
                    const safeFiles = await cloneFilesEagerly(e.dataTransfer.files);
                    onFiles(safeFiles);
                } 
            }}
            className={`relative z-[60] px-3 py-1.5 w-auto rounded border-2 border-dashed flex items-center justify-center transition-all cursor-pointer ${isOver ? 'border-indigo-400 bg-indigo-500 text-white scale-105' : 'border-indigo-500/50 hover:border-indigo-400 bg-indigo-900/80'} ${className}`}
            title="Glisser-déposer vos fichiers ici"
            onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.accept = accept;
                input.onchange = (e) => onFiles(Array.from(e.target.files));
                input.click();
            }}
        >
            <span className={`text-xs font-bold ${isOver ? 'text-white' : 'text-indigo-200'}`}>{label}</span>
        </div>
    );
};

export default DropZone;
