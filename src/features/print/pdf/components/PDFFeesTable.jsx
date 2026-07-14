import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';
import PDFFeesTableHeader from './PDFFeesTableHeader';
import PDFFeesTableRow from './PDFFeesTableRow';
import PDFFeesTableFooter from './PDFFeesTableFooter';
import { formatPDFAmount } from '../pdfFormatUtils';
import { DENSITY, pdfStyles, TYPO } from '../pdfStyles';

const PDFFeesTable = ({ data, styleBlock, showSubtotals }) => {
    const lignes = data?.expenses || data?.lignes;
    if (!data || !lignes) return null;

    const adaptedStyle = adaptBlockStyle(styleBlock);

    const containerStyle = {
        marginBottom: DENSITY.blockGap,
        ...adaptedStyle,
    };

    const totalFraisFormate = data.totalFraisFormate || formatPDFAmount(data.totalFrais);
    
    let decomptes = data.decomptes || [];
    if (decomptes.length === 0 && data.dettesParPersonne) {
        decomptes = Object.entries(data.dettesParPersonne).map(([personne, d]) => ({
            compteDeCourt: d.compteDeFormatted || personne,
            htvaFormate: formatPDFAmount(d.HTVA),
            totalFormate: formatPDFAmount(d.Total),
            tvacFormate: formatPDFAmount(d.TVAC),
            forfaitFormate: formatPDFAmount(d.Forfait),
            ...d
        }));
    }

    return (
        <View style={containerStyle} wrap>
            {data.title ? (
                <Text style={pdfStyles.sectionTitle} minPresenceAhead={30}>{data.title}</Text>
            ) : null}

            <View style={{
                flexDirection: 'column',
                borderWidth: 1,
                borderColor: '#94a3b8',
                borderRightWidth: 0,
                borderBottomWidth: 0,
                marginTop: 2
            }}>
                <PDFFeesTableHeader />
                {lignes.length > 0 ? (
                    lignes.map((exp, idx) => (
                        <PDFFeesTableRow key={exp.id || idx} exp={exp} index={idx + 1} />
                    ))
                ) : (
                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#94a3b8', borderRightWidth: 1, borderRightColor: '#94a3b8' }} wrap={false}>
                        <Text style={{ padding: 4, flex: 1, textAlign: 'center', fontStyle: 'italic', color: '#94a3b8', ...TYPO.tableCell }}>
                            Aucun frais encodé
                        </Text>
                    </View>
                )}
                {lignes.length > 0 ? (
                    <PDFFeesTableFooter totalFraisFormate={totalFraisFormate} />
                ) : null}
            </View>

            {(showSubtotals && decomptes.length > 0) ? (
                <View style={{ marginTop: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#cbd5e1' }} wrap={false}>
                    <Text style={{ ...TYPO.bodyBold, marginBottom: 4 }}>Décompte par partie impliquée (total) :</Text>
                    {decomptes.map((dec) => (
                        <View key={dec.compteDeCourt} style={{ flexDirection: 'column', width: '100%', marginBottom: 4 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '70%' }}>
                                <Text style={{ ...TYPO.body, color: '#334155' }}>- {dec.compteDeCourt}</Text>
                                <Text style={{ ...TYPO.bodyBold }}>{dec.totalFormate} €</Text>
                            </View>
                            {dec.aVentilation && (
                                <Text style={{ ...TYPO.caption, color: '#64748b', marginLeft: 10, marginTop: 1 }}>
                                    dont {[
                                        dec.HTVA ? `${dec.htvaFormate} € HTVA` : null,
                                        dec.TVAC ? `${dec.tvacFormate} € TVAC` : null,
                                        dec.Forfait ? `${dec.forfaitFormate} € forfait` : null
                                    ].filter(Boolean).join(' · ')}
                                </Text>
                            )}
                        </View>
                    ))}
                </View>
            ) : null}
        </View>
    );
};

export default PDFFeesTable;
