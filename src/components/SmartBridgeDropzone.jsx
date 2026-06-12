// v5.9.4 - Smart Bridge (Step 1)
import React, { useState } from 'react';

const SmartBridgeDropzone = ({ onFileDrop }) => {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);
            if (onFileDrop) {
                onFileDrop(files[0]);
            }
        }
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border border-dashed rounded p-2 flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isDragOver 
                    ? 'border-indigo-400 bg-indigo-500/20 text-indigo-300 scale-[1.02]' 
                    : 'border-slate-600 bg-slate-800/50 text-slate-400 hover:border-indigo-500/50 hover:bg-slate-800'
            }`}
        >
            <span className="text-xl pointer-events-none">🌉</span>
            <div className="flex flex-col items-start pointer-events-none text-left">
                <p className="text-[10px] font-bold text-white uppercase tracking-wider leading-tight">Smart Bridge</p>
                <p className="text-[9px] leading-tight">Glissez un mail (.msg) pour trouver le dossier</p>
            </div>
        </div>
    );
};

export default SmartBridgeDropzone;
