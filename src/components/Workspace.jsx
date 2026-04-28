import React, { useContext, useState } from 'react';
import { ExpertiseContext } from '../context/ExpertiseContext';

const Workspace = () => {
    const context = useContext(ExpertiseContext);
    if (!context) return null;

    const {
        formData, blockTitles, references, occupants, expenses, blocksVisible,
        customBlocks, setCustomBlocks, blockWidths, styles, setStyles,
        fitBlocks, setFitBlocks, showSubtotals, orgaAdvancedMode,
        getSortedBlocks, moveBlockUp, moveBlockDown, toggleBlockWidth
    } = context;

    const totalFrais = expenses.reduce((acc, curr) => {
        const val = parseFloat((curr.montant || '0').toString().replace(',', '.'));
        return acc + (isNaN(val) ? 0 : val);
    }, 0);

    const sousTotaux = expenses.reduce((acc, curr) => {
        const val = parseFloat((curr.montant || '0').toString().replace(',', '.'));
        if (!isNaN(val) && curr.compteDe && curr.compteDe.trim() !== '') { acc[curr.compteDe] = (acc[curr.compteDe] || 0) + val; }
        return acc;
    }, {});

    const handleStyleChange = (id, prop, val) => setStyles(prev => ({ ...prev, [id]: { ...prev[id], [prop]: val } }));

    const BlockToolbar = ({ id, disableText = false }) => {
        const [isOpen, setIsOpen] = useState(false);

        return (
            <div className="block-controls absolute top-1 right-1 z-50 print:hidden opacity-0 group-hover:opacity-100 transition-opacity">
                {!isOpen ? (
                    <button 
                        onMouseDown={(e) => { e.preventDefault(); setIsOpen(true); }}
                        className="bg-slate-800 text-white w-6 h-6 flex items-center justify-center rounded shadow border border-slate-600 hover:bg-indigo-600 transition-colors"
                        title="Ouvrir les outils"
                    >
                        ⚙️
                    </button>
                ) : (
                    <div className="bg-slate-800 text-white text-[11px] rounded flex flex-col shadow-xl cursor-default border border-slate-600 p-1.5 space-y-1.5 min-w-[180px]">
                        <div className="flex justify-between items-center border-b border-slate-600 pb-1">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest pl-1">Outils</span>
                            <button onMouseDown={(e) => { e.preventDefault(); setIsOpen(false); }} className="text-slate-300 hover:text-red-400 hover:bg-slate-700 rounded-full w-4 h-4 flex items-center justify-center leading-none" title="Fermer">✕</button>
                        </div>
                        
                        {!disableText && (
                            <div className="flex items-center space-x-1" title="Style appliqué au texte SÉLECTIONNÉ">
                                <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('bold'); }} className="px-1.5 py-1 hover:bg-slate-600 font-bold rounded">B</button>
                                <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('italic'); }} className="px-1.5 py-1 hover:bg-slate-600 italic rounded">I</button>
                                <button onMouseDown={(e) => { e.preventDefault(); document.execCommand('underline'); }} className="px-1.5 py-1 hover:bg-slate-600 underline rounded">U</button>
                                <button onMouseDown={(e) => { 
                                    e.preventDefault(); const sel = window.getSelection();
                                    if(sel.rangeCount > 0 && sel.toString().length > 0) {
                                        const range = sel.getRangeAt(0); const span = document.createElement('span');
                                        span.style.border = '1px solid currentColor'; span.style.padding = '1px 3px'; span.style.borderRadius = '3px';
                                        span.appendChild(range.extractContents()); range.insertNode(span);
                                    }
                                }} className="px-1 py-1 hover:bg-slate-600 rounded border border-slate-500 ml-1 text-indigo-300 font-bold" title="Encadrer">▢</button>
                            </div>
                        )}
                        <div className="flex items-center space-x-1 border-t border-slate-600 pt-1.5">
                            {!disableText && (
                                <React.Fragment>
                                    <button onMouseDown={(e) => { e.preventDefault(); handleStyleChange(id, 'textAlign', 'left'); }} className={`px-1 py-1 hover:bg-slate-600 rounded ${styles[id]?.textAlign === 'left' ? 'text-indigo-400 bg-slate-700' : ''}`}>Gauche</button>
                                    <button onMouseDown={(e) => { e.preventDefault(); handleStyleChange(id, 'textAlign', 'justify'); }} className={`px-1 py-1 hover:bg-slate-600 rounded ${styles[id]?.textAlign === 'justify' ? 'text-indigo-400 bg-slate-700' : ''}`}>Justifié</button>
                                </React.Fragment>
                            )}
                            <button onMouseDown={(e) => { e.preventDefault(); handleStyleChange(id, 'border', !styles[id]?.border); }} className={`px-1.5 py-0.5 rounded border ${styles[id]?.border ? 'bg-indigo-600 border-indigo-400' : 'border-slate-500 hover:bg-slate-700'}`}>Bordure</button>
                            {!disableText && (
                                <React.Fragment>
                                    <div className="px-1 flex items-center"><input type="color" value={styles[id]?.color || '#000'} onChange={(e) => handleStyleChange(id, 'color', e.target.value)} className="w-4 h-4 p-0 border-none cursor-pointer bg-transparent" /></div>
                                    <input type="number" value={styles[id]?.fontSize || 12} onChange={(e) => handleStyleChange(id, 'fontSize', parseInt(e.target.value) || 12)} className="w-10 bg-slate-700 text-white px-1 py-0.5 rounded text-[10px] outline-none text-center border border-slate-600" min="8" max="32" />
                                </React.Fragment>
                            )}
                            <button onMouseDown={(e) => { 
                                e.preventDefault(); 
                                if (id.startsWith('custom_')) { setCustomBlocks(customBlocks.filter(b => b.id !== id)); } 
                                else { context.setBlocksVisible(p => ({ ...p, [id]: false })); }
                            }} className="px-1 text-red-400 hover:text-red-300">🗑️</button>
                        </div>
                        <div className="border-t border-slate-600 pt-1.5 mt-1 flex gap-1">
                            <button onMouseDown={(e) => { e.preventDefault(); toggleBlockWidth(id); }} className="flex-1 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px]">
                                {blockWidths[id] === '50%' ? 'Passer à 100%' : 'Passer à 50%'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const BlockHeaderControls = ({ id }) => (
        <div className="block-controls absolute top-1 left-1 flex gap-1 z-50 print:hidden opacity-0 group-hover:opacity-100 transition-opacity">
            <button onMouseDown={(e) => { e.preventDefault(); moveBlockUp(id); }} className="bg-slate-800 text-white w-6 h-6 rounded hover:bg-indigo-600 border border-slate-600" title="Monter">⬆️</button>
            <button onMouseDown={(e) => { e.preventDefault(); moveBlockDown(id); }} className="bg-slate-800 text-white w-6 h-6 rounded hover:bg-indigo-600 border border-slate-600" title="Descendre">⬇️</button>
        </div>
    );

    const BlockContainer = ({ id, children }) => {
        const isHalf = blockWidths[id] === '50%';
        return (
            <div id={`block-${id}`} className={`relative group hover:ring-2 hover:ring-indigo-400/30 p-2 ${isHalf ? 'w-1/2' : 'w-full mb-4'}`}>
                <BlockHeaderControls id={id} />
                <BlockToolbar id={id} />
                <div style={{ fontSize: `${styles[id]?.fontSize || 12}px`, color: styles[id]?.color || '#000', fontFamily: styles[id]?.fontFamily || 'Arial', textAlign: styles[id]?.textAlign || 'left' }}>
                    <div className={`pt-6 ${styles[id]?.border ? 'border-2 border-current p-3 rounded' : ''} outline-none focus:ring-2 focus:ring-indigo-300`} contentEditable suppressContentEditableWarning>
                        {children}
                    </div>
                </div>
            </div>
        );
    };

    const renderBlocksInOrder = () => {
        const orderedKeys = getSortedBlocks();
        return orderedKeys.map(key => {
            if (key === 'titre') return (
                <BlockContainer key="titre" id="titre">
                    <p className="font-bold uppercase break-words">Expertise du {formData.dateExp ? new Date(formData.dateExp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + (formData.heureExp ? ` à ${formData.heureExp.replace(':', 'h')}` : '') : '...'} {formData.refPechard ? `- ${formData.refPechard}` : ''} {formData.nomResidence ? `- ${formData.nomResidence}` : ''}</p>
                </BlockContainer>
            );
            if (key === 'coord') return (
                <BlockContainer key="coord" id="coord">
                    {blockTitles.coord && <p className="font-bold underline mb-2" style={{fontSize: `${styles.coord.fontSize + 2}px`}}>{blockTitles.coord}</p>}
                    <p className="break-words"><strong>Adresse :</strong> {formData.adresse}</p>
                    <p className="break-words"><strong>Franchise applicable :</strong> {formData.franchise}</p>
                    <p className="break-words"><strong>Pertes indirectes :</strong> {formData.pertesIndirectes}</p>
                    <p className="break-words"><strong>Expert :</strong> {formData.bureau ? formData.bureau + ' - ' : ''}{formData.expertInfos}</p>
                    {formData.isContradictoire && (
                        <div className="ml-4 mt-2 border-l-2 border-slate-800 pl-3">
                            <p className="italic underline mb-1 break-words">Expertise contradictoire avec :</p>
                            <p className="break-words"><strong>Cie :</strong> {formData.cieContradictoire}</p>
                            <p className="break-words"><strong>Expert :</strong> {formData.bureauContradictoire ? formData.bureauContradictoire + ' - ' : ''}{formData.expertContradictoire}</p>
                            <p className="break-words"><strong>Pour le compte de :</strong> {formData.compteDeContradictoire}</p>
                        </div>
                    )}
                </BlockContainer>
            );
            if (key === 'infos') return (
                <BlockContainer key="infos" id="infos">
                    {blockTitles.infos && <p className="font-bold underline mb-2" style={{fontSize: `${styles.infos.fontSize + 2}px`}}>{blockTitles.infos}</p>}
                    <p className="break-words font-bold mb-1">Sinistre du {formData.dateSinistre ? new Date(formData.dateSinistre).toLocaleDateString('fr-FR') : '...'}, déclaré au Bureau Pechard le {formData.dateDeclaration ? new Date(formData.dateDeclaration).toLocaleDateString('fr-FR') : '...'} par {formData.declarant || '...'}</p>
                    <p className="break-words"><strong>Compagnie :</strong> {formData.nomCie}</p>
                    <p className="break-words"><strong>Contrat :</strong> {formData.nomContrat}</p>
                    <p className="break-words"><strong>N° Police :</strong> {formData.numPolice}</p>
                    <p className="break-words"><strong>N° Sinistre Cie :</strong> {formData.numSinistreCie}</p>
                    {references.length > 0 && <div>{references.map(r => <p key={r.id} className="break-words"><strong>{r.nom} {r.nom ? ':' : ''}</strong> {r.ref}</p>)}</div>}
                </BlockContainer>
            );
            if (key === 'cause') return (
                <BlockContainer key="cause" id="cause">
                    {blockTitles.cause && <p className="font-bold underline mb-1" style={{fontSize: `${styles.cause.fontSize + 2}px`}}>{blockTitles.cause}</p>}
                    <p className="whitespace-pre-wrap break-words">{formData.cause}</p>
                </BlockContainer>
            );
            if (key === 'orga') return (
                <BlockContainer key="orga" id="orga">
                    {blockTitles.orga && <p className="font-bold underline mb-2" style={{fontSize: `${styles.orga.fontSize + 2}px`}}>{blockTitles.orga}</p>}
                    <ul className="list-none space-y-2">
                        {occupants.map(o => (
                            <li key={o.id} className="leading-snug break-inside-avoid">
                                <div className={`grid grid-cols-[80px_190px_auto] gap-2 items-baseline ${o.statut === 'Locataire' ? 'ml-12 text-slate-700' : ''}`}>
                                    <strong className="break-words">{o.etage || '-'}</strong>
                                    <span className="text-slate-800 break-words">- {o.statut}</span>
                                    <span className="break-words">: <strong>{o.nom || '___'}</strong> {o.tel ? <span className="ml-1 text-[0.9em]">(Tel: {o.tel})</span> : ''} {orgaAdvancedMode && o.email ? <span className="ml-1 text-[0.9em]">(Email: {o.email})</span> : ''}</span>
                                </div>
                                {orgaAdvancedMode && (o.rc === 'Oui' || o.secAssurance === 'Oui') && (
                                    <div className={`ml-[280px] ${o.statut === 'Locataire' ? 'pl-12' : ''}`}>
                                        <table className="mt-1 border-l-2 border-slate-300 pl-2 text-[0.9em] italic opacity-90 text-slate-800 w-[95%]"><tbody>
                                            {o.rc === 'Oui' && <tr><td className="w-1/3 py-0.5 align-top break-words">Assurance RC Familiale</td><td className="py-0.5 align-top font-medium break-words">: {o.rcPolice ? `Police ${o.rcPolice}` : 'Non précisé'}</td></tr>}
                                            {o.secAssurance === 'Oui' && <tr><td className="w-1/3 py-0.5 align-top break-words">Autre assurance ({o.secType || 'Type'})</td><td className="py-0.5 align-top font-medium break-words">: {o.secCie || 'Compagnie non précisée'} {o.secPolice ? `(Police: ${o.secPolice})` : ''}</td></tr>}
                                        </tbody></table>
                                    </div>
                                )}
                            </li>
                        ))}
                        {occupants.length === 0 && <li className="italic opacity-50">Aucune partie impliquée.</li>}
                    </ul>
                </BlockContainer>
            );
            if (key === 'frais') return (
                <BlockContainer key="frais" id="frais">
                    {blockTitles.frais && <p className="font-bold underline mb-2 break-inside-avoid" style={{fontSize: `${styles.frais.fontSize + 2}px`}}>{blockTitles.frais}</p>}
                    <table className="w-full border-collapse mb-2 text-left break-inside-avoid table-fixed" style={{fontSize: `${styles.frais.fontSize}px`}}>
                        <thead className="bg-slate-100"><tr><th className="border border-slate-400 p-2 w-12">#</th><th className="border border-slate-400 p-2 w-1/5">Prestataire</th><th className="border border-slate-400 p-2 w-1/6">Type/Réf</th><th className="border border-slate-400 p-2">Description</th><th className="border border-slate-400 p-2 w-1/5">Compte de</th><th className="border border-slate-400 p-2 w-24 text-right">Montant</th></tr></thead>
                        <tbody>
                            {expenses.map((exp, index) => <tr key={exp.id} className="break-inside-avoid"><td className="border border-slate-400 p-2 text-center">{index + 1}</td><td className="border border-slate-400 p-2 break-words">{exp.prestataire}</td><td className="border border-slate-400 p-2 break-words">{exp.type} {exp.ref ? `/ ${exp.ref}` : ''}</td><td className="border border-slate-400 p-2 break-words">{exp.desc}</td><td className="border border-slate-400 p-2 break-words">{exp.compteDe}</td><td className="border border-slate-400 p-2 text-right font-bold whitespace-nowrap">{exp.montant ? `${exp.montant} € (${exp.typeMontant})` : ''}</td></tr>)}
                            {expenses.length > 0 && <tr className="bg-slate-50 font-bold break-inside-avoid"><td colSpan="5" className="border border-slate-400 p-2 text-right uppercase text-[0.9em]">Total</td><td className="border border-slate-400 p-2 text-right whitespace-nowrap">{totalFrais.toFixed(2).replace('.', ',')} €</td></tr>}
                            {expenses.length === 0 && <tr><td colSpan="6" className="border border-slate-400 p-2 text-center italic opacity-50">Aucun frais encodé</td></tr>}
                        </tbody>
                    </table>
                    {showSubtotals && Object.keys(sousTotaux).length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-300 text-slate-700 break-inside-avoid" style={{ fontSize: `${styles.frais.fontSize}px` }}>
                            <p className="font-bold mb-2">Décompte par partie impliquée (HTVA) :</p>
                            <ul className="list-none m-0 p-0 space-y-1">
                                {Object.entries(sousTotaux).map(([personne, total]) => <li key={personne} className="flex justify-between w-2/3"><span>- {personne}</span><span className="font-bold">{total.toFixed(2).replace('.', ',')} €</span></li>)}
                            </ul>
                        </div>
                    )}
                </BlockContainer>
            );
            if (key === 'divers') return (
                <BlockContainer key="divers" id="divers">
                    {blockTitles.divers && <p className="font-bold underline mb-1" style={{fontSize: `${styles.divers.fontSize + 2}px`}}>{blockTitles.divers}</p>}
                    <p className="whitespace-pre-wrap break-words">{formData.divers}</p>
                </BlockContainer>
            );
            if (key.startsWith('custom_')) {
                const block = customBlocks.find(b => b.id === key);
                if(block) return (
                    <BlockContainer key={block.id} id={block.id}>
                        <p className="whitespace-pre-wrap break-words">{block.text}</p>
                    </BlockContainer>
                );
            }
            return null;
        });
    };

    return (
        <div id="workspace-container" className="flex-1 overflow-auto bg-slate-200 flex justify-center py-12 print:py-0 print:block">
            <div id="a4-page" className="bg-white text-slate-900 shadow-2xl print:shadow-none w-[210mm] max-w-full print:w-full min-h-[297mm] h-max p-[15mm] mx-auto print:mx-0 print:p-0 break-words flex flex-wrap content-start">
                {renderBlocksInOrder()}
            </div>
            {/* Styles supplémentaires pour l'impression */}
            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 15mm; }
                    body { background: white !important; margin: 0; padding: 0; overflow: visible !important; }
                    .break-inside-avoid { page-break-inside: avoid; break-inside: avoid; }
                    /* On force les colonnes 50% à rester en ligne à l'impression si besoin, Tailwind 'w-1/2' s'en charge. */
                }
            `}</style>
        </div>
    );
};

export default Workspace;
