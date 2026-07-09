import React from 'react';
import PrintReportSection from './PrintReportSection';

const PrintOrganisationBlock = ({ data, styleBlock, orgaAdvancedMode }) => {
    if (!data) return null;

    return (
        <PrintReportSection styleBlock={styleBlock}>
            {data.title && (
                <p className="font-bold underline mb-2" style={{ fontSize: `${(styleBlock?.fontSize || 12) + 2}px` }}>
                    {data.title}
                </p>
            )}

            <ul className="list-none space-y-2">
                {data.occupants.map(o => (
                    <li key={o.id} className={`leading-snug break-inside-avoid p-1 rounded ${o.isResponsible ? 'bg-orange-50 border border-orange-200' : ''}`}>
                        <div className={`grid grid-cols-[80px_190px_auto] gap-2 items-baseline ${o.depth === 1 ? 'ml-12 text-slate-700' : ''}`}>
                            <strong className="break-words">{o.etage}</strong>
                            <span className="text-slate-800 break-words">- {o.statut}</span>
                            <span className="break-words">
                                : <strong>{o.nomComplet}</strong>
                                {o.isResponsible && <span className="ml-2 text-[10px] font-bold text-orange-600 bg-orange-100 px-1 py-0.5 rounded uppercase">Responsable</span>}
                                {o.iban && <span className="ml-1 text-[10px] italic text-slate-500">(IBAN: {o.iban})</span>}{' '}
                                {o.tel && <span className="ml-1 text-[0.9em]">(Tel: {o.tel})</span>}{' '}
                                {orgaAdvancedMode && o.email && <span className="ml-1 text-[0.9em]">(Email: {o.email})</span>}
                            </span>
                        </div>
                        {orgaAdvancedMode && (o.rc === 'Oui' || o.secAssurance === 'Oui') && (
                            <div className={`ml-[280px] ${o.depth === 1 ? 'pl-12' : ''}`}>
                                <table className="mt-1 border-l-2 border-slate-300 pl-2 text-[0.9em] italic opacity-90 text-slate-800 w-[95%]">
                                    <tbody>
                                        {o.rc === 'Oui' && (
                                            <tr>
                                                <td className="w-1/3 py-0.5 align-top break-words">Assurance RC Familiale</td>
                                                <td className="py-0.5 align-top font-medium break-words">: {o.rcPolice ? `Police ${o.rcPolice}` : 'Non précisé'}</td>
                                            </tr>
                                        )}
                                        {o.secAssurance === 'Oui' && (
                                            <tr>
                                                <td className="w-1/3 py-0.5 align-top break-words">Autre assurance ({o.secType || 'Type'})</td>
                                                <td className="py-0.5 align-top font-medium break-words">: {o.secCie || 'Compagnie non précisée'} {o.secPolice ? `(Police: ${o.secPolice})` : ''}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </li>
                ))}
                {data.occupants.length === 0 && <li className="italic opacity-50">Aucune partie impliquée.</li>}
            </ul>

            {data.intervenants.length > 0 && (
                <div className="mt-3 pt-2 border-t border-slate-200">
                    <p className="font-bold text-[0.95em] mb-1">Autres intervenants :</p>
                    <ul className="list-none space-y-1">
                        {data.intervenants.map(inter => (
                            <li key={inter.id} className="leading-snug ml-4">
                                <strong>{inter.nom} {inter.prenom}</strong>
                                {inter.role && <span className="italic"> — {inter.role}</span>}
                                {inter.societe && <span> ({inter.societe})</span>}
                                {inter.tel && <span className="ml-2 text-[0.9em]">(Tél: {inter.tel})</span>}
                                {inter.email && <span className="ml-2 text-[0.9em]">(Email: {inter.email})</span>}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </PrintReportSection>
    );
};

export default PrintOrganisationBlock;
