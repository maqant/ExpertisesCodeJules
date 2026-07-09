import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { DENSITY } from '../pdfStyles';

const PDFFeesTableHeader = ({ fontSize }) => {
    const headerStyle = {
        paddingVertical: DENSITY.tableHeaderPaddingV,
        paddingHorizontal: DENSITY.cellPaddingH,
        fontSize: fontSize,
        fontWeight: 'bold',
        color: '#1e293b',
        backgroundColor: '#f1f5f9',
        borderBottomWidth: 1,
        borderBottomColor: '#94a3b8',
        borderRightWidth: 1,
        borderRightColor: '#94a3b8',
    };

    return (
        <View style={{ flexDirection: 'row' }} wrap={false} minPresenceAhead={DENSITY.keepWithNext}>
            <Text style={[headerStyle, { width: '5%', textAlign: 'center' }]}>#</Text>
            <Text style={[headerStyle, { width: '15%' }]}>Prestataire</Text>
            <Text style={[headerStyle, { width: '15%' }]}>Type</Text>
            <Text style={[headerStyle, { width: '35%' }]}>Description</Text>
            <Text style={[headerStyle, { width: '15%' }]}>Compte de</Text>
            <Text style={[headerStyle, { width: '15%', textAlign: 'right' }]}>Montant HTVA</Text>
        </View>
    );
};

export default PDFFeesTableHeader;
