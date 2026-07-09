import React from 'react';
import PrintReportSection from './PrintReportSection';

const PrintImagesBlock = ({ data, styleBlock, layout }) => {
    if (!data) return null;

    return (
        <PrintReportSection styleBlock={styleBlock}>
            {data.title && (
                <p className="font-bold underline mb-2 break-inside-avoid" style={{ fontSize: `${(styleBlock?.fontSize || 12) + 2}px` }}>
                    {data.title}
                </p>
            )}
            <div className={`grid gap-4 mt-2 ${
                layout === '3-cols' ? 'grid-cols-3' : 
                layout === '1-col' ? 'grid-cols-1 max-w-2xl mx-auto' : 
                'grid-cols-2'
            }`}>
                {data.images.map((img, i) => (
                    <div key={img.id} className={`break-inside-avoid bg-white p-2 border border-slate-200 rounded shadow-sm ${
                        layout === '1-col' ? 'max-w-xl mx-auto w-full' : ''
                    }`}>
                        <div className={`relative ${
                            layout === '3-cols' ? 'h-32' : 
                            layout === '1-col' ? 'h-64' : 
                            'h-48'
                        } mb-2 bg-slate-100 rounded overflow-hidden`}>
                            <img src={img.dataUrl} alt={`Photo ${i+1}`} className="w-full h-full object-contain" />
                        </div>
                        {img.caption && <p className="text-center italic text-slate-600 leading-tight mt-1 px-1">{img.caption}</p>}
                    </div>
                ))}
            </div>
        </PrintReportSection>
    );
};

export default PrintImagesBlock;
