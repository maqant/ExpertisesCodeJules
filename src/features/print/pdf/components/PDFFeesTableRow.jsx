import React from 'react';
import { View, Text, Link } from '@react-pdf/renderer';

const PDFFeesTableRow = ({ exp, index, fontSize }) => {
    const cellStyle = {
        padding: 4,
        fontSize: fontSize,
        color: '#334155',
        borderBottomWidth: 1,
        borderBottomColor: '#94a3b8',
        borderRightWidth: 1,
        borderRightColor: '#94a3b8',
    };

    return (
        <View style={{ flexDirection: 'row' }} wrap={false}>
            <Text style={[cellStyle, { width: '5%', textAlign: 'center' }]}>{index}</Text>
            <Text style={[cellStyle, { width: '15%' }]}>{exp.prestataire}</Text>
            <Text style={[cellStyle, { width: '15%' }]}>{exp.type} {exp.ref ? `/ ${exp.ref}` : ''}</Text>
            
            <View style={[cellStyle, { width: '35%' }]}>
                <Text style={{ lineHeight: 1.3 }}>{exp.desc}</Text>
                {exp.annexReference && (
                    <Link src={`https://expertises.local/annex/${exp.id}`} style={{ textDecoration: 'none' }}>
                        <Text style={{ fontSize: fontSize * 0.8, fontStyle: 'italic', color: '#2563eb', marginTop: 2 }}>{exp.annexReference}</Text>
                    </Link>
                )}
            </View>
            
            <Text style={[cellStyle, { width: '15%' }]}>{exp.compteDeFormatted}</Text>
            
            <View style={[cellStyle, { width: '15%', textAlign: 'right' }]}>
                {exp.montant ? (
                    <View>
                        <Text>{exp.montantFormate || parseFloat((exp.montant || '0').toString().replace(',', '.')).toFixed(2)} €</Text>
                        {exp.isFranchise ? (
                            <Text style={{ fontSize: fontSize * 0.7, color: '#7e22ce', fontWeight: 'bold' }}>FRANCHISE</Text>
                        ) : (
                            <Text style={{ fontSize: fontSize * 0.7, color: '#64748b' }}>{exp.typeMontant}</Text>
                        )}
                    </View>
                ) : null}
            </View>
        </View>
    );
};

export default PDFFeesTableRow;
