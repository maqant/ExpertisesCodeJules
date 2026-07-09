import React from 'react';

const PrintSignaturesBlock = ({ reportData, styleBlock }) => {
    if (!reportData || !reportData.metadata) return null;

    const { signExpert, author } = reportData.metadata;

    return (
        <div className="mt-8 pt-4 flex justify-between break-inside-avoid" style={{ 
            fontSize: `${styleBlock?.fontSize || 12}px`, 
            color: styleBlock?.color || '#0f172a', 
            fontFamily: styleBlock?.fontFamily || 'Arial' 
        }}>
            {signExpert && (
                <div className="w-1/3 text-center">
                    <p>Pour l'expert,</p>
                    <p className="font-bold mt-1 uppercase">{author}</p>
                </div>
            )}
            <div className="w-1/3 text-center">
                {/* Réservé pour la signature de l'assuré si besoin */}
            </div>
        </div>
    );
};

export default PrintSignaturesBlock;
