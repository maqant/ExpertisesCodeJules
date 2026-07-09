import React from 'react';
import { View, Text } from '@react-pdf/renderer';

const PDFFeesTableFooter = ({ totalFraisFormate, fontSize }) => {
    const cellStyle = {
        padding: 6,
        fontSize: fontSize,
        fontWeight: 'bold',
        color: '#0f172a',
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#94a3b8',
        borderRightWidth: 1,
        borderRightColor: '#94a3b8',
    };

    return (
        <View style={{ flexDirection: 'row' }} wrap={false}>
            <Text style={[cellStyle, { width: '85%', textAlign: 'right' }]}>TOTAL DE LA RÉCLAMATION HTVA</Text>
            <Text style={[cellStyle, { width: '15%', textAlign: 'right' }]}>{totalFraisFormate} €</Text>
        </View>
    );
};

export default PDFFeesTableFooter;
