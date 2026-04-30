import React, { useContext } from 'react';
import { ExpertiseContext } from '../context/ExpertiseContext';

const PrintPreview = () => {
    const context = useContext(ExpertiseContext);
    if (!context) return null;

    const {
        setIsPreviewMode, formData, blockTitles, references, occupants, expenses,
        blocksVisible, customBlocks, positions, styles, showSubtotals, orgaAdvancedMode,
        getSortedBlocks, getPaginationInfo
    } = context;

    const totalFrais = expenses.reduce((acc, curr) => {
        const val = parseFloat((curr.montant || '0').toString().replace(',', '.'));
        return acc + (isNaN(val) ? 0 : val);
    }, 0);

    const fmtOccName = (o) => o.nom ? (o.etage && o.etage.trim() !== '' ? `${o.etage} - ${o.nom}` : o.nom) : '';

    const dettesParPersonne = expenses.reduce((acc, exp) => {
        const p = exp.compteDe || 'Non attribué';
        if (!acc[p]) acc[p] = { HTVA: 0, TVAC: 0, Forfait: 0, lignes: [] };
        const val = parseFloat((exp.montant || '0').toString().replace(',', '.'));
        const safeVal = isNaN(val) ? 0 : val;
        if (exp.typeMontant === 'HTVA') acc[p].HTVA += safeVal;
        else if (exp.typeMontant === 'TVAC') acc[p].TVAC += safeVal;
        else if (exp.typeMontant === 'Forfait') acc[p].Forfait += safeVal;
        acc[p].lignes.push(exp);
        return acc;
    }, {});

    const formatShortCompteDe = (compteDeStr) => {
        if (!compteDeStr || typeof compteDeStr !== 'string') return '';
        
        // Isoler le nom complet (sans l'étage s'il est préfixé)
        const namePart = compteDeStr.includes(' - ') ? compteDeStr.split(' - ').slice(1).join(' - ').trim() : compteDeStr.trim();
        
        // Chercher l'occupant en comparant avec "Nom Prénom"
        const occupant = occupants.find(o => {
            const fullName = `${o.nom || ''} ${o.prenom || ''}`.trim();
            return fullName === namePart || (o.nom && namePart.includes(o.nom));
        });
        
        if (occupant) {
            // On a trouvé la personne : on ne garde STRICTEMENT que son nom de famille (o.nom)
            const nomAffiche = occupant.nom || namePart.split(' ')[0];
            if (occupant.etage && occupant.etage.trim() !== '') {
                return `${nomAffiche} (${occupant.etage.trim()})`;
            }
            return nomAffiche;
        }
        
        // Fallback (ex: "COMMUNS")
        return namePart.split(' ')[0];
    };

    const renderBlocksInOrder = () => {
        const orderedKeys = getSortedBlocks();
        return orderedKeys.map(key => {
            if (key === 'titre') return (
                <div key="titre" className="mb-6 break-inside-avoid relative z-10" style={{ fontSize: `${styles.titre.fontSize}px`, color: styles.titre.color, fontFamily: styles.titre.fontFamily, textAlign: styles.titre.textAlign }}>
                    <div className={`${styles.titre.border ? 'border-2 border-current p-4 rounded' : ''} bg-white`}>
                        <p className="font-bold uppercase break-words">Expertise du {formData.dateExp ? new Date(formData.dateExp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) + (formData.heureExp ? ` à ${formData.heureExp.replace(':', 'h')}` : '') : '...'} {formData.refPechard ? `- ${formData.refPechard}` : ''} {formData.nomResidence ? `- ${formData.nomResidence}` : ''}</p>
                    </div>
                </div>
            );
            if (key === 'coord') return (
                <div key="coord" className="mb-6 break-inside-avoid relative z-10" style={{ fontSize: `${styles.coord.fontSize}px`, color: styles.coord.color, fontFamily: styles.coord.fontFamily, textAlign: styles.coord.textAlign }}>
                    <div className={`${styles.coord.border ? 'border-2 border-current p-3 rounded' : ''} bg-white`}>
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
                    </div>
                </div>
            );
            if (key === 'infos') return (
                <div key="infos" className="mb-6 break-inside-avoid relative z-10" style={{ fontSize: `${styles.infos.fontSize}px`, color: styles.infos.color, fontFamily: styles.infos.fontFamily, textAlign: styles.infos.textAlign }}>
                    <div className={`${styles.infos.border ? 'border-2 border-current p-3 rounded' : ''} bg-white`}>
                        {blockTitles.infos && <p className="font-bold underline mb-2" style={{ fontSize: `${styles.infos.fontSize + 2}px` }}>{blockTitles.infos}</p>}
                        <p className="break-words font-bold mb-1">Sinistre du {formData.dateSinistre ? new Date(formData.dateSinistre).toLocaleDateString('fr-FR') : '...'}, déclaré au Bureau Pechard le {formData.dateDeclaration ? new Date(formData.dateDeclaration).toLocaleDateString('fr-FR') : '...'} par {formData.declarant || '...'} {getPaginationInfo('doc_mail_declaration') && <span className="text-[0.8em] text-slate-500 italic font-normal ml-1">{getPaginationInfo('doc_mail_declaration').text}</span>}</p>
                        <p className="break-words"><strong>Compagnie :</strong> {formData.nomCie}</p>
                        <p className="break-words"><strong>Contrat :</strong> {formData.nomContrat} {getPaginationInfo('doc_cond_part') && <span className="text-[0.8em] text-slate-500 italic font-normal ml-1">{getPaginationInfo('doc_cond_part').text}</span>}</p>
                        <p className="break-words"><strong>N° Police :</strong> {formData.numPolice}</p>
                        {formData.numConditionsGenerales && <p className="break-words"><strong>N° Cond. Générales :</strong> {formData.numConditionsGenerales} {getPaginationInfo('doc_cond_gen') && <span className="text-[0.8em] text-slate-500 italic font-normal ml-1">{getPaginationInfo('doc_cond_gen').text}</span>}</p>}
                        <p className="break-words"><strong>N° Sinistre Cie :</strong> {formData.numSinistreCie}</p>
                        {references.length > 0 && <div>{references.map(r => <p key={r.id} className="break-words"><strong>{r.nom} {r.nom ? ':' : ''}</strong> {r.ref}</p>)}</div>}
                    </div>
                </div>
            );
            if (key === 'cause') return (
                <div key="cause" className="mb-6 break-inside-avoid relative z-10" style={{ fontSize: `${styles.cause.fontSize}px`, color: styles.cause.color, fontFamily: styles.cause.fontFamily, textAlign: styles.cause.textAlign }}>
                    <div className={`${styles.cause.border ? 'border-2 border-current p-3 rounded' : ''} bg-white`}>
                        {blockTitles.cause && <p className="font-bold underline mb-1" style={{ fontSize: `${styles.cause.fontSize + 2}px` }}>{blockTitles.cause}</p>}
                        <p className="whitespace-pre-wrap break-words">{formData.cause} {getPaginationInfo('doc_rapport_cause') && <span className="block text-[0.8em] text-slate-500 italic font-normal mt-1">{getPaginationInfo('doc_rapport_cause').text}</span>}</p>
                    </div>
                </div>
            );
            if (key === 'orga') return (
                <div key="orga" className="mb-6 break-inside-avoid relative z-10" style={{ fontSize: `${styles.orga.fontSize}px`, color: styles.orga.color, fontFamily: styles.orga.fontFamily, textAlign: styles.orga.textAlign }}>
                    <div className={`${styles.orga.border ? 'border-2 border-current p-3 rounded' : ''} bg-white`}>
                        {blockTitles.orga && <p className="font-bold underline mb-2" style={{ fontSize: `${styles.orga.fontSize + 2}px` }}>{blockTitles.orga}</p>}
                        <ul className="list-none space-y-2">
                            {occupants.map(o => (
                                <li key={o.id} className="leading-snug break-inside-avoid">
                                    <div className={`grid grid-cols-[80px_190px_auto] gap-2 items-baseline ${o.statut === 'Locataire' ? 'ml-12 text-slate-700' : ''}`}>
                                        <strong className="break-words">{o.etage || '-'}</strong>
                                        <span className="text-slate-800 break-words">- {o.statut}</span>
                                        <span className="break-words">: <strong>{`${o.nom || '___'} ${o.prenom || ''}`.trim()}</strong> {o.tel ? <span className="ml-1 text-[0.9em]">(Tel: {o.tel})</span> : ''} {orgaAdvancedMode && o.email ? <span className="ml-1 text-[0.9em]">(Email: {o.email})</span> : ''}</span>
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
                    </div>
                </div>
            );
            if (key === 'frais') return (
                <div key="frais" className="mb-6 relative z-10" style={{ fontSize: `${styles.frais.fontSize}px`, color: styles.frais.color, fontFamily: styles.frais.fontFamily, textAlign: styles.frais.textAlign }}>
                    <div className={`${styles.frais.border ? 'border-2 border-current p-3 rounded' : ''} bg-white`}>
                        {blockTitles.frais && <p className="font-bold underline mb-2 break-inside-avoid" style={{ fontSize: `${styles.frais.fontSize + 2}px` }}>{blockTitles.frais}</p>}
                        <table className="w-full border-collapse mb-2 text-left break-inside-avoid table-fixed border border-slate-400" style={{ fontSize: `${styles.frais.fontSize}px` }}>
                            <thead className="bg-slate-100">
                                <tr>
                                    <th className="border border-slate-400 p-1 w-8 text-center">#</th>
                                    <th className="border border-slate-400 p-1 w-[15%]">Prestataire</th>
                                    <th className="border border-slate-400 p-1 w-[12%]">Type/Réf</th>
                                    <th className="border border-slate-400 p-1">Description</th>
                                    <th className="border border-slate-400 p-1 w-[18%]">Compte de</th>
                                    <th className="border border-slate-400 p-1 w-[105px] text-right">Montant</th>
                                </tr>
                            </thead>
                            <tbody>
                                {expenses.map((exp, index) => {
                                    const pagInfo = getPaginationInfo(exp.id);
                                    return (
                                        <tr key={exp.id} className="break-inside-avoid">
                                            <td className="border border-slate-400 p-1 text-center align-top">{index + 1}</td>
                                            <td className="border border-slate-400 p-1 break-words align-top">{exp.prestataire}</td>
                                            <td className="border border-slate-400 p-1 break-words align-top text-[0.9em]">{exp.type} {exp.ref ? `/ ${exp.ref}` : ''}</td>
                                            <td className="border border-slate-400 p-1 break-words align-top">{exp.desc} {pagInfo && <span className="block text-[0.8em] text-slate-500 mt-1 italic">{pagInfo.text}</span>}</td>
                                            <td className="border border-slate-400 p-1 break-words align-top">{formatShortCompteDe(exp.compteDe)}</td>
                                            <td className="border border-slate-400 p-1 text-right font-bold align-top leading-tight">
                                                {exp.montant ? (
                                                    <>
                                                        <div className="whitespace-nowrap">{exp.montant} €</div>
                                                        <div className="text-[0.75em] font-normal opacity-80 uppercase">{exp.typeMontant}</div>
                                                    </>
                                                ) : ''}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {expenses.length > 0 && <tr className="bg-slate-50 font-bold break-inside-avoid"><td colSpan="5" className="border border-slate-400 p-1.5 text-right uppercase text-[0.85em] tracking-tight">TOTAL DE LA RÉCLAMATION</td><td className="border border-slate-400 p-1.5 text-right whitespace-nowrap text-indigo-900 align-top">{totalFrais.toFixed(2).replace('.', ',')} €</td></tr>}
                                {expenses.length === 0 && <tr><td colSpan="6" className="border border-slate-400 p-2 text-center italic opacity-50">Aucun frais encodé</td></tr>}
                            </tbody>
                        </table>
                        {showSubtotals && Object.keys(dettesParPersonne).length > 0 && (
                            <div className="mt-4 pt-3 border-t border-slate-300 text-slate-700 break-inside-avoid" style={{ fontSize: `${styles.frais.fontSize}px` }}>
                                <p className="font-bold mb-2">Décompte par partie impliquée (HTVA) :</p>
                                <ul className="list-none m-0 p-0 space-y-1">
                                    {Object.entries(dettesParPersonne).map(([personne, data]) => (
                                        <li key={personne} className="flex justify-between w-2/3">
                                            <span>- {formatShortCompteDe(personne)}</span>
                                            <span className="font-bold">{data.HTVA.toFixed(2).replace('.', ',')} €</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            );
            if (key === 'frais_liste') {
                if (showSubtotals && Object.keys(dettesParPersonne).length > 0) {
                    return (
                        <div key="frais_liste" className="mb-6 break-inside-avoid relative z-10" style={{ fontSize: `${styles.frais_liste?.fontSize || 12}px`, color: styles.frais_liste?.color || '#000', fontFamily: styles.frais_liste?.fontFamily || 'Arial', textAlign: 'left' }}>
                            <div className={`${styles.frais_liste?.border ? 'border-2 border-current p-3 rounded' : ''} bg-white text-slate-700`}>
                                <p className="font-bold mb-0">Détail des justificatifs par partie</p>
                                <p className="text-[0.85em] text-slate-500 italic mb-2">Inclut l'intégralité des pièces reçues, y compris les éléments non retenus ou hors garanties.</p>
                                <div className="space-y-4">
                                    {Object.entries(dettesParPersonne).map(([personne, data]) => {
                                        const matchOcc = occupants.find(o => fmtOccName(o) === personne);
                                        const isExpertClient = matchOcc?.contreExpert;
                                        return (
                                            <div key={personne} className="bg-slate-50 p-2 rounded border border-slate-200 break-inside-avoid">
                                                <div className="flex justify-between items-baseline mb-1">
                                                    <h4 className="font-bold underline">{formatShortCompteDe(personne)} {isExpertClient ? <span className="text-green-700 text-[0.8em] font-normal no-underline ml-1">(Expert client : {matchOcc.nomContreExpert || 'Non précisé'})</span> : ''}</h4>
                                                    <div className="text-[0.9em] font-bold text-slate-600 space-x-3">
                                                        {data.HTVA > 0 && <span>HTVA : {data.HTVA.toFixed(2).replace('.', ',')} €</span>}
                                                        {data.TVAC > 0 && <span>TVAC : {data.TVAC.toFixed(2).replace('.', ',')} €</span>}
                                                        {data.Forfait > 0 && <span>Forfait : {data.Forfait.toFixed(2).replace('.', ',')} €</span>}
                                                    </div>
                                                </div>
                                                <ul className="list-disc pl-5 text-[0.9em] space-y-1 mt-1">
                                                    {data.lignes.map((l, i) => (
                                                        <li key={i}>
                                                            {l.prestataire} - {l.desc} ({l.montant || '0'} € {l.typeMontant})
                                                            {l.avisCouverture === 'Non' && <span className="ml-1 not-italic font-bold text-red-600 text-[0.85em]">[Pas de couverture]</span>}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                }
                return null;
            }
            if (key === 'photos') {
                const occupantsWithPhotos = occupants.filter(o => context.attachedPhotos && context.attachedPhotos[o.id] && context.attachedPhotos[o.id].length > 0);
                return (
                    <div key="photos" className="mb-6 break-inside-avoid relative z-10" style={{ fontSize: `${styles.photos?.fontSize || 12}px`, color: styles.photos?.color || '#0f172a', fontFamily: styles.photos?.fontFamily || 'Arial', textAlign: styles.photos?.textAlign || 'left' }}>
                        <div className={`${styles.photos?.border ? 'border-2 border-current p-3 rounded' : ''} bg-white`}>
                            {blockTitles.photos && <p className="font-bold underline mb-2 break-inside-avoid" style={{ fontSize: `${(styles.photos?.fontSize || 12) + 2}px` }}>{blockTitles.photos}</p>}
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
                        </div>
                    </div>
                );
            }
            if (key === 'divers') return (
                <div key="divers" className="mb-6 break-inside-avoid relative z-10" style={{ fontSize: `${styles.divers.fontSize}px`, color: styles.divers.color, fontFamily: styles.divers.fontFamily, textAlign: styles.divers.textAlign }}>
                    <div className={`${styles.divers.border ? 'border-2 border-current p-3 rounded' : ''} bg-white`}>
                        {blockTitles.divers && <p className="font-bold underline mb-1" style={{ fontSize: `${styles.divers.fontSize + 2}px` }}>{blockTitles.divers}</p>}
                        <p className="whitespace-pre-wrap break-words">{formData.divers}</p>
                    </div>
                </div>
            );
            if (key.startsWith('custom_')) {
                const block = customBlocks.find(b => b.id === key);
                if (block) return (
                    <div key={block.id} className="mb-6 break-inside-avoid relative z-10" style={{ fontSize: `${styles[block.id]?.fontSize || 12}px`, color: styles[block.id]?.color || '#000', fontFamily: styles[block.id]?.fontFamily || 'Arial', textAlign: styles[block.id]?.textAlign || 'left' }}>
                        <div className={`${styles[block.id]?.border ? 'border-2 border-current p-3 rounded' : ''} bg-white`}><p className="whitespace-pre-wrap break-words">{block.text}</p></div>
                    </div>
                );
            }
            return null;
        });
    };

    return (
        <div className="flex flex-col min-h-screen w-full bg-slate-200">
            {/* Top Toolbar (Non imprimable) */}
            <div className="print:hidden bg-slate-900 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-50">
                <div>
                    <h2 className="text-lg font-bold">👁️ Aperçu Avant Impression</h2>
                    <p className="text-xs text-slate-400">Le contenu est automatiquement paginé. Redimensionnez ou appuyez sur Imprimer pour voir le rendu exact.</p>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setIsPreviewMode(false)} className="bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded font-bold text-sm transition-colors">
                        ⬅️ Retour à l'éditeur
                    </button>
                    <button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded font-bold text-sm shadow-lg transition-colors">
                        🖨️ Lancer l'impression
                    </button>
                </div>
            </div>

            {/* A4 Container */}
            <div className="flex-1 flex justify-center py-12 print:py-0 print:block overflow-auto">
                <div className="bg-white text-slate-900 shadow-2xl print:shadow-none w-[210mm] max-w-full print:w-full min-h-[297mm] p-[15mm] mx-auto print:mx-0 print:p-0 break-words relative">
                    {/* Lignes de coupe visuelles pour l'écran */}
                    <div className="print:hidden">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                            <div key={i} className="absolute left-0 right-0 border-b-2 border-dashed border-red-400/40 pointer-events-none z-0" style={{ top: `${i * 297}mm` }}>
                                <span className="absolute right-2 bottom-0 text-[10px] text-red-400/60 font-bold">✂️ Fin de page {i}</span>
                            </div>
                        ))}
                    </div>
                    {renderBlocksInOrder()}
                </div>
            </div>

            {/* Styles supplémentaires pour l'impression du mode Preview */}
            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 15mm; }
                    body { background: white !important; margin: 0; padding: 0; overflow: visible !important; }
                    .break-inside-avoid { page-break-inside: avoid; break-inside: avoid; }
                }
            `}</style>
        </div>
    );
};

export default PrintPreview;
