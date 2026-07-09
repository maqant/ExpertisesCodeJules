import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';
import PDFFeesTableHeader from './PDFFeesTableHeader';
import PDFFeesTableRow from './PDFFeesTableRow';
import PDFFeesTableFooter from './PDFFeesTableFooter';

const PDFFeesTable = ({ data, styleBlock, metadata }) => {
    if (!data || !data.lignes) return null;

    const adaptedStyle = adaptBlockStyle(styleBlock);
    const showSubtotals = metadata?.showSubtotals;

    const containerStyle = {
        marginBottom: 15,
        ...adaptedStyle,
        fontSize: adaptedStyle.fontSize || 9,
    };

    const titleStyle = {
        fontWeight: 'bold',
        textDecoration: 'underline',
        marginBottom: 6,
        fontSize: (adaptedStyle.fontSize || 9) + 1.5,
    };

    return (
        <View style={containerStyle} wrap>
            {data.title && (
                <Text style={titleStyle} wrap={false}>{data.title}</Text>
            )}

            <View style={{
                flexDirection: 'column',
                borderWidth: 1,
                borderColor: '#94a3b8',
                borderRightWidth: 0,
                borderBottomWidth: 0,
                marginTop: 5
            }}>
                <PDFFeesTableHeader fontSize={adaptedStyle.fontSize || 9} />
                {data.lignes.length > 0 ? (
                    data.lignes.map((exp, idx) => (
                        <PDFFeesTableRow key={exp.id || idx} exp={exp} index={idx + 1} fontSize={adaptedStyle.fontSize || 9} />
                    ))
                ) : (
                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#94a3b8', borderRightWidth: 1, borderRightColor: '#94a3b8' }} wrap={false}>
                        <Text style={{ padding: 4, flex: 1, textAlign: 'center', fontStyle: 'italic', color: '#94a3b8', fontSize: adaptedStyle.fontSize || 9 }}>
                            Aucun frais encodé
                        </Text>
                    </View>
                )}
                {data.lignes.length > 0 && (
                    <PDFFeesTableFooter totalFraisFormate={data.totalFraisFormate} fontSize={adaptedStyle.fontSize || 9} />
                )}
            </View>

            {showSubtotals && data.decomptes && data.decomptes.length > 0 && (
                <View style={{ marginTop: 15, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#cbd5e1' }} wrap={false}>
                    <Text style={{ fontWeight: 'bold', marginBottom: 6 }}>Décompte par partie impliquée (HTVA) :</Text>
                    {data.decomptes.map((dec) => (
                        <View key={dec.compteDeCourt} style={{ flexDirection: 'row', justifyContent: 'space-between', width: '70%', marginBottom: 3 }}>
                            <Text style={{ color: '#334155' }}>- {dec.compteDeCourt}</Text>
                            <Text style={{ fontWeight: 'bold' }}>{dec.htvaFormate} €</Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
};

export default PDFFeesTable;
