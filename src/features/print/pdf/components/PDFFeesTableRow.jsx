import React from 'react';
import { View, Text, Link } from '@react-pdf/renderer';
import { formatPDFAmount } from '../pdfFormatUtils';
import { DENSITY } from '../pdfStyles';

const PDFFeesTableRow = ({ exp, index, fontSize }) => {
    const cellStyle = {
        paddingVertical: DENSITY.cellPaddingV,
        paddingHorizontal: DENSITY.cellPaddingH,
        fontSize: fontSize,
        color: '#1e293b',
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
                <Text style={{ lineHeight: DENSITY.lineHeight }}>{exp.desc}</Text>
                {exp.annexReference ? (
                    <Link src={`https://expertises.local/annex/${exp.id}`} style={{ textDecoration: 'none' }}>
                        <Text style={{ fontSize: fontSize * 0.85, fontStyle: 'italic', color: '#64748b', marginTop: 1 }}>
                            {exp.annexReference}
                        </Text>
                    </Link>
                ) : null}
            </View>
            
            <Text style={[cellStyle, { width: '15%' }]}>{exp.compteDeFormatted}</Text>
            
            <View style={[cellStyle, { width: '15%', textAlign: 'right' }]}>
                {exp.montant || exp.montant === 0 ? (
                    <View>
                        <Text style={{ fontWeight: 'bold' }}>{exp.montantFormate || formatPDFAmount(exp.montant)} €</Text>
                        {exp.isFranchise ? (
                            <Text style={{ fontSize: fontSize * 0.75, color: '#7e22ce', fontWeight: 'bold', marginTop: 1 }}>FRANCHISE</Text>
                        ) : (
                            <Text style={{ fontSize: fontSize * 0.75, color: '#64748b', marginTop: 1 }}>{exp.typeMontant}</Text>
                        )}
                    </View>
                ) : null}
            </View>
        </View>
    );
};

export default PDFFeesTableRow;

