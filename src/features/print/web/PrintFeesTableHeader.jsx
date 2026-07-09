import React from 'react';

const PrintFeesTableHeader = () => {
    return (
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
    );
};

export default PrintFeesTableHeader;
