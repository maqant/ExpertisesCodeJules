import React, { useContext, useState, useEffect, useRef } from 'react';
import { ExpertiseContext } from '../context/ExpertiseContext';

const BlockToolbar = ({ id, disableText = false }) => {
    const context = useContext(ExpertiseContext);
    const { styles, setStyles, customBlocks, setCustomBlocks, blockWidths, toggleBlockWidth, setBlocksVisible } = context;
    const [isOpen, setIsOpen] = useState(false);
    const handleStyleChange = (id, prop, val) => setStyles(prev => ({ ...prev, [id]: { ...prev[id], [prop]: val } }));

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
                                if (sel.rangeCount > 0 && sel.toString().length > 0) {
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
                            else { setBlocksVisible(p => ({ ...p, [id]: false })); }
                        }} className="px-1 text-red-400 hover:text-red-300">🗑️</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const BlockHeaderControls = ({ id }) => {
    const { moveBlockUp, moveBlockDown } = useContext(ExpertiseContext);
    return (
        <div className="block-controls absolute top-1 left-1 flex gap-1 z-50 print:hidden opacity-0 group-hover:opacity-100 transition-opacity">
            <button onMouseDown={(e) => { e.preventDefault(); moveBlockUp(id); }} className="bg-slate-800 text-white w-6 h-6 rounded hover:bg-indigo-600 border border-slate-600" title="Monter">⬆️</button>
            <button onMouseDown={(e) => { e.preventDefault(); moveBlockDown(id); }} className="bg-slate-800 text-white w-6 h-6 rounded hover:bg-indigo-600 border border-slate-600" title="Descendre">⬇️</button>
        </div>
    );
};

// Lignes de coupure de page (dashed indicators, ignorées par html2canvas)
const PageBreakLines = () => {
    const [lineYPositions, setLineYPositions] = useState([]);
    useEffect(() => {
        const update = () => {
            const el = document.getElementById('a4-page');
            if (!el) return;
            const heightMm = el.scrollHeight * 25.4 / 96;
            const count = Math.max(0, Math.ceil(heightMm / 297) - 1); // on ne trace pas de ligne après la dernière page
            setLineYPositions(Array.from({ length: count }, (_, i) => 297 * (i + 1)));
        };
        update();
        const el = document.getElementById('a4-page');
        if (!el) return;
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);
    return (
        <>
            {lineYPositions.map((yMm, i) => (
                <div
                    key={i}
                    data-html2canvas-ignore="true"
                    className="page-break-indicator absolute left-0 right-0 pointer-events-none z-40 print:hidden"
                    style={{ top: `${yMm}mm` }}
                >
                    <div className="border-t-2 border-dashed border-blue-400/80 relative">
                        <span className="absolute left-0 -top-4 bg-blue-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-br shadow whitespace-nowrap">
                            ✂ Fin page {i + 1}
                        </span>
                        <span className="absolute right-0 -top-4 bg-blue-400/80 text-white text-[9px] px-2 py-0.5 rounded-bl whitespace-nowrap">
                            Début page {i + 2} ↓
                        </span>
                    </div>
                </div>
            ))}
        </>
    );
};

const BlockContainer = ({ id, children }) => {
    const { blockWidths, styles, setStyles } = useContext(ExpertiseContext);
    const isHalf = blockWidths[id] === '50%';
    const marginMm = styles[id]?.marginBottom || 0;
    const adjustMargin = (delta) => {
        setStyles(p => ({ ...p, [id]: { ...p[id], marginBottom: Math.max(0, (p[id]?.marginBottom || 0) + delta) } }));
    };
    return (
        <div
            id={`block-${id}`}
            className={`relative group hover:ring-2 hover:ring-indigo-400/30 p-2 ${isHalf ? 'w-1/2' : 'w-full'}`}
            style={{ marginBottom: marginMm > 0 ? `${marginMm}mm` : '1rem' }}
        >
            <BlockHeaderControls id={id} />
            <BlockToolbar id={id} />
            <div style={{ fontSize: `${styles[id]?.fontSize || 12}px`, color: styles[id]?.color || '#000', fontFamily: styles[id]?.fontFamily || 'Arial', textAlign: styles[id]?.textAlign || 'left' }}>
                <div className={`pt-6 ${styles[id]?.border ? 'border-2 border-current p-3 rounded' : ''} outline-none focus:ring-2 focus:ring-indigo-300`} contentEditable suppressContentEditableWarning>
                    {children}
                </div>
            </div>
            {/* Contrôle de marge inférieure — pousse les blocs du dessous */}
            <div
                className="block-controls absolute -bottom-3.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity print:hidden z-50 flex items-center gap-1 bg-slate-800/95 border border-slate-600 rounded-full px-2 py-0.5 shadow-lg"
                data-html2canvas-ignore="true"
            >
                <button onMouseDown={(e) => { e.preventDefault(); adjustMargin(-5); }} className="text-slate-300 hover:text-red-400 font-bold text-sm leading-none w-4 text-center">−</button>
                <span className="text-[9px] text-slate-300 font-mono min-w-[30px] text-center">
                    {marginMm > 0 ? `↕ ${marginMm}mm` : '↕'}
                </span>
                <button onMouseDown={(e) => { e.preventDefault(); adjustMargin(+5); }} className="text-slate-300 hover:text-green-400 font-bold text-sm leading-none w-4 text-center">+</button>
            </div>
        </div>
    );
};

const Workspace = () => {
    const context = useContext(ExpertiseContext);
    if (!context) return null;

    const {
        formData, blockTitles, references, occupants, expenses, blocksVisible,
        customBlocks, setCustomBlocks, blockWidths, styles, setStyles, setBlockOrder, setBlocksVisible,
        fitBlocks, setFitBlocks, showSubtotals,
        getSortedBlocks, moveBlockUp, moveBlockDown, toggleBlockWidth, getPaginationInfo
    } = context;

    const fmtOccName = (o) => o.nom ? (o.etage && o.etage.trim() !== '' ? `${o.etage} - ${o.nom}` : o.nom) : '';

    const findOccByCompteDe = (compteDe) => {
        if (!compteDe) return null;
        return occupants.find(o => fmtOccName(o) === compteDe);
    };

    const isExpenseExcludedFromMain = (exp) => {
        if (exp.avisCouverture === 'Non') return true;
        const matchedOcc = findOccByCompteDe(exp.compteDe);
        if (matchedOcc && matchedOcc.contreExpert) return true;
        return false;
    };

    const mainExpenses = expenses.filter(exp => !isExpenseExcludedFromMain(exp));

    const totalFrais = mainExpenses.reduce((acc, curr) => {
        const val = parseFloat((curr.montant || '0').toString().replace(',', '.'));
        return acc + (isNaN(val) ? 0 : val);
    }, 0);

    const dettesParPersonne = expenses.reduce((acc, exp) => {
        const pName = exp.compteDe && exp.compteDe.trim() !== '' ? exp.compteDe : 'Non attribué';
        if (!acc[pName]) acc[pName] = { HTVA: 0, TVAC: 0, Forfait: 0, lignes: [] };
        acc[pName].lignes.push(exp);
        const val = parseFloat((exp.montant || '0').toString().replace(',', '.'));
        if (!isNaN(val)) {
            acc[pName][exp.typeMontant || 'HTVA'] += val;
        }
        return acc;
    }, {});



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
                    {blockTitles.coord && <p className="font-bold underline mb-2" style={{ fontSize: `${styles.coord.fontSize + 2}px` }}>{blockTitles.coord}</p>}
                    <p className="break-words"><strong>Adresse :</strong> {formData.adresse}</p>
                    <p className="break-words"><strong>Franchise applicable :</strong> {formData.franchise}</p>
                    <p className="break-words"><strong>Pertes indirectes :</strong> {formData.pertesIndirectes}</p>
                    <p className="break-words"><strong>Expert :</strong> {formData.bureau ? formData.bureau + ' - ' : ''}{formData.expertInfos}</p>
                    {getPaginationInfo('doc_mail_expertise') && <p className="break-words text-[0.85em] text-slate-500 italic mt-1">{getPaginationInfo('doc_mail_expertise').text}</p>}
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
                    {blockTitles.infos && <p className="font-bold underline mb-2" style={{ fontSize: `${styles.infos.fontSize + 2}px` }}>{blockTitles.infos}</p>}
                    <p className="break-words font-bold mb-1">Sinistre du {formData.dateSinistre ? new Date(formData.dateSinistre).toLocaleDateString('fr-FR') : '...'}, déclaré au Bureau Pechard le {formData.dateDeclaration ? new Date(formData.dateDeclaration).toLocaleDateString('fr-FR') : '...'} par {formData.declarant || '...'} {getPaginationInfo('doc_mail_declaration') && <span className="text-[0.8em] text-slate-500 italic font-normal ml-1">{getPaginationInfo('doc_mail_declaration').text}</span>}</p>
                    <p className="break-words"><strong>Compagnie :</strong> {formData.nomCie}</p>
                    <p className="break-words"><strong>Contrat :</strong> {formData.nomContrat}</p>
                    <p className="break-words"><strong>N° Police :</strong> {formData.numPolice} {getPaginationInfo('doc_cond_part') && <span className="text-[0.8em] text-slate-500 italic font-normal ml-1">{getPaginationInfo('doc_cond_part').text}</span>}</p>
                    {formData.numConditionsGenerales && <p className="break-words"><strong>N° Cond. Générales :</strong> {formData.numConditionsGenerales} {getPaginationInfo('doc_cond_gen') && <span className="text-[0.8em] text-slate-500 italic font-normal ml-1">{getPaginationInfo('doc_cond_gen').text}</span>}</p>}
                    <p className="break-words"><strong>N° Sinistre Cie :</strong> {formData.numSinistreCie}</p>
                    {references.length > 0 && <div>{references.map(r => <p key={r.id} className="break-words"><strong>{r.nom} {r.nom ? ':' : ''}</strong> {r.ref}</p>)}</div>}
                </BlockContainer>
            );
            if (key === 'cause') return (
                <BlockContainer key="cause" id="cause">
                    {blockTitles.cause && <p className="font-bold underline mb-1" style={{ fontSize: `${styles.cause.fontSize + 2}px` }}>{blockTitles.cause}</p>}
                    <p className="whitespace-pre-wrap break-words">{formData.cause} {getPaginationInfo('doc_rapport_cause') && <span className="block text-[0.8em] text-slate-500 italic font-normal mt-1">{getPaginationInfo('doc_rapport_cause').text}</span>}</p>
                </BlockContainer>
            );
            if (key === 'orga') return (
                <BlockContainer key="orga" id="orga">
                    {blockTitles.orga && <p className="font-bold underline mb-2" style={{ fontSize: `${styles.orga.fontSize + 2}px` }}>{blockTitles.orga}</p>}
                    <ul className="list-none space-y-2">
                        {occupants.map(o => (
                            <li key={o.id} className="leading-snug break-inside-avoid">
                                <div className={`grid grid-cols-[80px_190px_auto] gap-2 items-baseline ${o.statut === 'Locataire' ? 'ml-12 text-slate-700' : ''}`}>
                                    <strong className="break-words">{o.etage || '-'}</strong>
                                    <span className="text-slate-800 break-words">- {o.statut}</span>
                                    <span className="break-words">: <strong>{o.nom || '___'}</strong> {o.tel ? <span className="ml-1 text-[0.9em]">(Tel: {o.tel})</span> : ''} {o.showDetails && o.email ? <span className="ml-1 text-[0.9em]">(Email: {o.email})</span> : ''}</span>
                                </div>
                                {(o.contreExpert || o.hasContact || o.showDetails) && (
                                    <div className={`${o.statut === 'Locataire' ? 'ml-12' : ''}`} style={{marginLeft: o.statut !== 'Locataire' ? '272px' : undefined, paddingLeft: o.statut === 'Locataire' ? '272px' : undefined}}>
                                        <table className="mt-1 border-l-2 border-slate-300 pl-2 text-[0.9em] italic opacity-90 text-slate-800 w-[95%]"><tbody>
                                            {o.contreExpert && <tr><td className="w-1/3 py-0.5 align-top break-words">Expert client</td><td className="py-0.5 align-top font-medium break-words">: {o.nomContreExpert || 'Non précisé'}</td></tr>}
                                            {o.hasContact && (o.contactNom || o.contactTel) && <tr><td className="w-1/3 py-0.5 align-top break-words">Contact</td><td className="py-0.5 align-top font-medium break-words">: {o.contactNom || ''}{o.contactNom && o.contactTel ? ' - ' : ''}{o.contactTel || ''}</td></tr>}
                                            {o.showDetails && o.iban && <tr><td className="w-1/3 py-0.5 align-top break-words">IBAN</td><td className="py-0.5 align-top font-medium break-words">: {o.iban}</td></tr>}
                                            {o.showDetails && o.rc === 'Oui' && <tr><td className="w-1/3 py-0.5 align-top break-words">Assurance RC Familiale</td><td className="py-0.5 align-top font-medium break-words">: {o.rcPolice ? `Police ${o.rcPolice}` : 'Non précisé'}</td></tr>}
                                            {o.showDetails && o.secAssurance === 'Oui' && <tr><td className="w-1/3 py-0.5 align-top break-words">Autre assurance ({o.secType || 'Type'})</td><td className="py-0.5 align-top font-medium break-words">: {o.secCie || 'Compagnie non précisée'} {o.secPolice ? `(Police: ${o.secPolice})` : ''}</td></tr>}
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
                    {blockTitles.frais && <p className="font-bold underline mb-2 break-inside-avoid" style={{ fontSize: `${styles.frais.fontSize + 2}px` }}>{blockTitles.frais}</p>}
                    <table className="w-full border-collapse mb-2 text-left break-inside-avoid table-fixed" style={{ fontSize: `${styles.frais.fontSize}px` }}>
                        <thead className="bg-slate-100"><tr><th className="border border-slate-400 p-2 w-12">#</th><th className="border border-slate-400 p-2 w-1/5">Prestataire</th><th className="border border-slate-400 p-2 w-1/6">Type/Réf</th><th className="border border-slate-400 p-2">Description</th><th className="border border-slate-400 p-2 w-1/5">Compte de</th><th className="border border-slate-400 p-2 w-24 text-right">Montant</th></tr></thead>
                        <tbody>
                            {mainExpenses.map((exp, index) => {
                                const pagInfo = getPaginationInfo(exp.id);
                                return (
                                    <tr key={exp.id} className="break-inside-avoid"><td className="border border-slate-400 p-2 text-center">{index + 1}</td><td className="border border-slate-400 p-2 break-words">{exp.prestataire}</td><td className="border border-slate-400 p-2 break-words">{exp.type} {exp.ref ? `/ ${exp.ref}` : ''}</td><td className="border border-slate-400 p-2 break-words">{exp.desc} {exp.avisCouverture === 'Autre' && exp.noteCouverture && <span className="block text-[0.8em] text-orange-600 mt-0.5 italic">Observation : {exp.noteCouverture}</span>} {pagInfo && <span className="block text-[0.8em] text-slate-500 mt-1 italic">{pagInfo.text}</span>}</td><td className="border border-slate-400 p-2 break-words">{exp.compteDe}</td><td className="border border-slate-400 p-2 text-right font-bold whitespace-nowrap">{exp.montant ? `${exp.montant} € (${exp.typeMontant})` : ''}</td></tr>
                                );
                            })}
                            {mainExpenses.length > 0 && <tr className="bg-slate-50 font-bold break-inside-avoid"><td colSpan="5" className="border border-slate-400 p-2 text-right uppercase text-[0.9em]">Total de la réclamation</td><td className="border border-slate-400 p-2 text-right whitespace-nowrap">{totalFrais.toFixed(2).replace('.', ',')} €</td></tr>}
                            {mainExpenses.length === 0 && <tr><td colSpan="6" className="border border-slate-400 p-2 text-center italic opacity-50">Aucun frais couvert encodé</td></tr>}
                        </tbody>
                    </table>
                </BlockContainer>
            );
            if (key === 'frais_liste') return showSubtotals && Object.keys(dettesParPersonne).length > 0 ? (
                <BlockContainer key="frais_liste" id="frais_liste">
                    <div className="text-slate-700" style={{ fontSize: `${styles.frais_liste?.fontSize || 12}px` }}>
                        <p className="font-bold mb-2">Liste devis/facture/demande de forfait reçus, non-couverts et non-pertinents inclus :</p>
                        <div className="space-y-4">
                            {Object.entries(dettesParPersonne).map(([personne, data]) => {
                                const matchOcc = occupants.find(o => fmtOccName(o) === personne);
                                const isExpertClient = matchOcc?.contreExpert;
                                return (
                                    <div key={personne} className="bg-slate-50 p-2 rounded border border-slate-200 break-inside-avoid">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <h4 className="font-bold underline">{personne} {isExpertClient ? <span className="text-green-700 text-[0.8em] font-normal no-underline ml-1">(Expert client : {matchOcc.nomContreExpert || 'Non précisé'})</span> : ''}</h4>
                                            <div className="text-[0.9em] font-bold text-slate-600 space-x-3">
                                                {data.HTVA > 0 && <span>HTVA : {data.HTVA.toFixed(2).replace('.', ',')} €</span>}
                                                {data.TVAC > 0 && <span>TVAC : {data.TVAC.toFixed(2).replace('.', ',')} €</span>}
                                                {data.Forfait > 0 && <span>Forfait : {data.Forfait.toFixed(2).replace('.', ',')} €</span>}
                                            </div>
                                        </div>
                                        <ul className="list-disc pl-5 text-[0.9em] space-y-1 mt-1">
                                            {data.lignes.map((l, i) => {
                                                const isExcluded = isExpenseExcludedFromMain(l);
                                                const pagInfo = isExcluded ? getPaginationInfo(l.id) : null;
                                                const occForLine = findOccByCompteDe(l.compteDe);
                                                const lineIsExpertClient = occForLine?.contreExpert;
                                                return (
                                                    <li key={i}>
                                                        {l.prestataire} - {l.desc} ({l.montant || '0'} € {l.typeMontant})
                                                        {isExcluded && pagInfo && <span className="text-[0.8em] text-slate-500 ml-1 italic">{pagInfo.text}</span>}
                                                        {l.avisCouverture === 'Non' && <span className="ml-1 not-italic font-bold text-red-600 text-[0.85em]">[Pas de couverture{l.noteCouverture ? ` : ${l.noteCouverture}` : ''}]</span>}
                                                        {l.avisCouverture === 'Autre' && l.noteCouverture && <span className="ml-1 italic text-orange-600 text-[0.85em]">Observation : {l.noteCouverture}</span>}
                                                        {lineIsExpertClient && <span className="ml-1 not-italic font-bold text-green-700 text-[0.85em]">Pas repris dans notre réclamation : copropriétaire est assisté par un expert-client</span>}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </BlockContainer>
            ) : null;

            if (key === 'photos') {
                const occupantsWithPhotos = occupants.filter(o => context.attachedPhotos && context.attachedPhotos[o.id] && context.attachedPhotos[o.id].length > 0);
                return (
                    <BlockContainer key="photos" id="photos">
                        {blockTitles.photos && <p className="font-bold underline mb-2 break-inside-avoid" style={{ fontSize: `${styles.photos?.fontSize || 12}px` }}>{blockTitles.photos}</p>}
                        {occupantsWithPhotos.length > 0 ? (
                            <ul className="list-disc pl-5">
                                {occupantsWithPhotos.map(occ => {
                                    const pagInfo = getPaginationInfo('doc_photos_occ_' + occ.id);
                                    return (
                                        <li key={occ.id} className="mb-1" style={{fontSize: `${styles.photos?.fontSize || 12}px`}}>
                                            Photos de {occ.nom} {pagInfo && <span className="text-[0.8em] text-slate-500 italic ml-1">{pagInfo.text}</span>}
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="italic opacity-50" style={{fontSize: `${styles.photos?.fontSize || 12}px`}}>Aucune photo rattachée au rapport.</p>
                        )}
                    </BlockContainer>
                );
            }
            if (key === 'divers') return (
                <BlockContainer key="divers" id="divers">
                    {blockTitles.divers && <p className="font-bold underline mb-1" style={{ fontSize: `${styles.divers.fontSize + 2}px` }}>{blockTitles.divers}</p>}
                    <p className="whitespace-pre-wrap break-words">{formData.divers}</p>
                </BlockContainer>
            );
            if (key.startsWith('custom_')) {
                const block = customBlocks.find(b => b.id === key);
                if (block) return (
                    <BlockContainer key={block.id} id={block.id}>
                        <p className="whitespace-pre-wrap break-words">{block.text}</p>
                    </BlockContainer>
                );
            }
            if (key.startsWith('spacer_')) {
                const heightMm = styles[key]?.spacerHeight || 20;
                return (
                    <div key={key} id={`block-${key}`} className="relative group w-full print:hidden" style={{ height: `${heightMm}mm` }} data-html2canvas-ignore="true">
                        <div className="block-controls absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                            <div className="bg-white/90 border-2 border-dashed border-slate-400 rounded-lg px-3 py-1.5 flex items-center gap-3 text-xs text-slate-600 shadow">
                                <button onMouseDown={(e) => { e.preventDefault(); setStyles(p => ({ ...p, [key]: { ...p[key], spacerHeight: Math.max(5, (p[key]?.spacerHeight || 20) - 5) } })); }} className="hover:bg-slate-200 w-6 h-6 rounded font-bold text-base flex items-center justify-center">−</button>
                                <span className="font-mono text-slate-700 font-bold">{heightMm}mm</span>
                                <button onMouseDown={(e) => { e.preventDefault(); setStyles(p => ({ ...p, [key]: { ...p[key], spacerHeight: (p[key]?.spacerHeight || 20) + 5 } })); }} className="hover:bg-slate-200 w-6 h-6 rounded font-bold text-base flex items-center justify-center">+</button>
                                <span className="text-slate-400 text-[10px]">↕ espaceur</span>
                                <button onMouseDown={(e) => { e.preventDefault(); setBlockOrder(p => p.filter(k => k !== key)); setBlocksVisible(p => { const n = {...p}; delete n[key]; return n; }); }} className="text-red-400 hover:text-red-600 ml-1">✕</button>
                            </div>
                        </div>
                        <div className="absolute inset-0 border-t border-b border-dashed border-slate-300/60 pointer-events-none" />
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[9px] text-slate-300 font-mono opacity-0 group-hover:opacity-100">{heightMm}mm</div>
                    </div>
                );
            }
            return null;
        });
    };

    return (
        <div id="workspace-container" className="flex-1 overflow-auto bg-slate-200 flex justify-center py-12 print:py-0 print:block">
            <div id="a4-page" className="relative bg-white text-slate-900 shadow-2xl print:shadow-none w-[210mm] max-w-full print:w-full min-h-[297mm] h-max p-[15mm] mx-auto print:mx-0 print:p-0 break-words flex flex-wrap content-start">
                {renderBlocksInOrder()}
                <PageBreakLines />
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
