import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';
import PDFFeesTableHeader from './PDFFeesTableHeader';
import PDFFeesTableRow from './PDFFeesTableRow';
import PDFFeesTableFooter from './PDFFeesTableFooter';
import { formatPDFAmount } from '../pdfFormatUtils';
import { DENSITY } from '../pdfStyles';

const PDFFeesTable = ({ data, styleBlock, metadata }) => {
    const lignes = data?.expenses || data?.lignes;
    if (!data || !lignes) return null;

    const adaptedStyle = adaptBlockStyle(styleBlock);
    const showSubtotals = metadata?.showSubtotals;

    const containerStyle = {
        marginBottom: DENSITY.blockGap,
        ...adaptedStyle,
        fontSize: adaptedStyle.fontSize || DENSITY.fontBase,
    };

    const titleStyle = {
        fontWeight: 'bold',
        textDecoration: 'underline',
        marginBottom: DENSITY.sectionTitleGap,
        fontSize: adaptedStyle.fontSize ? adaptedStyle.fontSize + 2 : DENSITY.fontTitle,
    };

    const totalFraisFormate = data.totalFraisFormate || formatPDFAmount(data.totalFrais);
    
    let decomptes = data.decomptes || [];
    if (decomptes.length === 0 && data.dettesParPersonne) {
        decomptes = Object.entries(data.dettesParPersonne).map(([personne, d]) => ({
            compteDeCourt: d.compteDeFormatted || personne,
            htvaFormate: formatPDFAmount(d.HTVA),
            ...d
        }));
    }

    return (
        <View style={containerStyle} wrap>
            {data.title ? (
                <Text style={titleStyle} minPresenceAhead={30}>{data.title}</Text>
            ) : null}

            <View style={{
                flexDirection: 'column',
                borderWidth: 1,
                borderColor: '#94a3b8',
                borderRightWidth: 0,
                borderBottomWidth: 0,
                marginTop: 2
            }}>
                <PDFFeesTableHeader fontSize={adaptedStyle.fontSize || DENSITY.fontBase} />
                {lignes.length > 0 ? (
                    lignes.map((exp, idx) => (
                        <PDFFeesTableRow key={exp.id || idx} exp={exp} index={idx + 1} fontSize={adaptedStyle.fontSize || DENSITY.fontBase} />
                    ))
                ) : (
                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#94a3b8', borderRightWidth: 1, borderRightColor: '#94a3b8' }} wrap={false}>
                        <Text style={{ padding: 4, flex: 1, textAlign: 'center', fontStyle: 'italic', color: '#94a3b8', fontSize: adaptedStyle.fontSize || DENSITY.fontBase }}>
                            Aucun frais encodé
                        </Text>
                    </View>
                )}
                {lignes.length > 0 ? (
                    <PDFFeesTableFooter totalFraisFormate={totalFraisFormate} fontSize={adaptedStyle.fontSize || DENSITY.fontBase} />
                ) : null}
            </View>

            {(showSubtotals && decomptes.length > 0) ? (
                <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#cbd5e1' }} wrap={false}>
                    <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Décompte par partie impliquée (HTVA) :</Text>
                    {decomptes.map((dec) => (
                        <View key={dec.compteDeCourt} style={{ flexDirection: 'row', justifyContent: 'space-between', width: '70%', marginBottom: 2 }}>
                            <Text style={{ color: '#334155' }}>- {dec.compteDeCourt}</Text>
                            <Text style={{ fontWeight: 'bold' }}>{dec.htvaFormate} €</Text>
                        </View>
                    ))}
                </View>
            ) : null}
        </View>
    );
};

export default PDFFeesTable;
