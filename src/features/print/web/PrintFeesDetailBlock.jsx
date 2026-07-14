import React from 'react';
import { formatPDFAmount } from '../pdf/pdfFormatUtils';

const PrintFeesDetailBlock = ({ data, styleBlock, showSubtotals }) => {
    if (!data) return null;

    let decomptes = data.decomptes || [];
    if (decomptes.length === 0 && data.dettesParPersonne) {
        decomptes = Object.entries(data.dettesParPersonne).map(([personne, d]) => ({
            compteDeCourt: d.compteDeFormatted || personne,
            htvaFormate: formatPDFAmount(d.HTVA),
            tvacFormate: formatPDFAmount(d.TVAC),
            forfaitFormate: formatPDFAmount(d.Forfait),
            franchiseFormate: formatPDFAmount(d.Franchise),
            htvaNum: d.HTVA || 0,
            tvacNum: d.TVAC || 0,
            forfaitNum: d.Forfait || 0,
            franchiseNum: d.Franchise || 0,
            ...d
        }));
    }

    if (!showSubtotals || decomptes.length === 0) return null;

    return (
        <div className="mb-6 break-inside-avoid relative z-10" style={{ fontSize: `${styleBlock?.fontSize || 12}px`, color: styleBlock?.color || '#000', fontFamily: styleBlock?.fontFamily || 'Arial', textAlign: 'left' }}>
            <div className={`${styleBlock?.border ? 'border-2 border-current p-3 rounded' : ''} bg-white text-slate-700`}>
                <p className="font-bold mb-0">Détail des justificatifs par partie</p>
                <p className="text-[0.85em] text-slate-500 italic mb-2">Inclut l'intégralité des pièces reçues, y compris les éléments non retenus ou hors garanties.</p>
                <div className="space-y-4">
                    {decomptes.map((dec) => (
                        <div key={dec.compteDeCourt} className="bg-slate-50 p-2 rounded border border-slate-200 break-inside-avoid">
                            <div className="flex justify-between items-baseline mb-1">
                                <h4 className="font-bold underline">
                                    {dec.compteDeCourt} 
                                    {dec.isExpertClient && <span className="text-green-700 text-[0.8em] font-normal no-underline ml-1">(Expert client : {dec.nomContreExpert || 'Non précisé'})</span>}
                                </h4>
                                <div className="text-[0.9em] font-bold text-slate-600 space-x-3">
                                    {dec.htvaNum > 0 && <span>HTVA : {dec.htvaFormate} €</span>}
                                    {dec.tvacNum > 0 && <span>TVAC : {dec.tvacFormate} €</span>}
                                    {dec.forfaitNum > 0 && <span>Forfaits accordés : {dec.forfaitFormate} €</span>}
                                    {dec.franchiseNum !== 0 && <span className="text-purple-800 font-black">Franchise contractuelle : {dec.franchiseFormate} €</span>}
                                </div>
                            </div>
                            <ul className="list-disc pl-5 text-[0.9em] space-y-1 mt-1">
                                {dec.lignes.map((l, i) => (
                                    <li key={i}>
                                        {l.prestataire} - {l.desc} ({l.montantFormate || '0'} € {l.typeMontantBrut || l.typeMontant})
                                        {l.avisCouverture === 'Non' && <span className="ml-1 not-italic font-bold text-red-600 text-[0.85em]">[Pas de couverture]</span>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PrintFeesDetailBlock;
