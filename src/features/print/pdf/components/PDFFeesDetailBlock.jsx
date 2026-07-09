import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';
import { formatPDFAmount } from '../pdfFormatUtils';
import { DENSITY } from '../pdfStyles';

const PDFFeesDetailBlock = ({ data, styleBlock, showSubtotals }) => {
    if (!data) return null;

    let decomptes = data.decomptes || [];
    if (decomptes.length === 0 && data.dettesParPersonne) {
        decomptes = Object.entries(data.dettesParPersonne).map(([personne, d]) => ({
            compteDeCourt: d.compteDeFormatted || personne,
            htvaFormate: formatPDFAmount(d.HTVA),
            tvacFormate: formatPDFAmount(d.TVAC),
            forfaitFormate: formatPDFAmount(d.Forfait),
            franchiseFormate: formatPDFAmount(d.Franchise),
            htvaNum: d.HTVA || 0,
            tvacNum: d.TVAC || 0,
            forfaitNum: d.Forfait || 0,
            franchiseNum: d.Franchise || 0,
            ...d
        }));
    }

    if (!showSubtotals || decomptes.length === 0) return null;

    const adaptedStyle = adaptBlockStyle(styleBlock);

    const containerStyle = {
        marginBottom: DENSITY.blockGap,
        ...adaptedStyle,
        fontSize: adaptedStyle.fontSize || DENSITY.fontBase,
    };

    return (
        <View style={containerStyle} wrap>
            <View style={{
                backgroundColor: '#ffffff',
                borderWidth: styleBlock?.border ? 1 : 0,
                borderColor: '#cbd5e1',
                padding: styleBlock?.border ? DENSITY.borderedPadding : 0,
                borderRadius: DENSITY.borderRadius
            }}>
                <Text style={{ fontWeight: 'bold', fontSize: (adaptedStyle.fontSize || DENSITY.fontBase) + 1, marginBottom: 1 }}>Détail des justificatifs par partie</Text>
                <Text style={{ fontSize: (adaptedStyle.fontSize || DENSITY.fontBase) * 0.85, color: '#64748b', fontStyle: 'italic', marginBottom: 4 }}>
                    Inclut l'intégralité des pièces reçues, y compris les éléments non retenus ou hors garanties.
                </Text>

                <View style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {decomptes.map((dec, i) => (
                        <View key={i} style={{
                            backgroundColor: '#f8fafc',
                            padding: 4,
                            borderRadius: 2,
                            borderWidth: 1,
                            borderColor: '#e2e8f0'
                        }} wrap={false}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                    <Text style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{dec.compteDeCourt}</Text>
                                    {dec.isExpertClient ? (
                                        <Text style={{ color: '#15803d', fontSize: (adaptedStyle.fontSize || DENSITY.fontBase) * 0.8, marginLeft: 5 }}>
                                            (Expert client : {dec.nomContreExpert || 'Non précisé'})
                                        </Text>
                                    ) : null}
                                </View>
                                
                                <View style={{ flexDirection: 'row', fontWeight: 'bold', color: '#475569', fontSize: (adaptedStyle.fontSize || DENSITY.fontBase) * 0.9 }}>
                                    {dec.htvaNum > 0 ? <Text style={{ marginLeft: 6 }}>HTVA : {dec.htvaFormate} €</Text> : null}
                                    {dec.tvacNum > 0 ? <Text style={{ marginLeft: 6 }}>TVAC : {dec.tvacFormate} €</Text> : null}
                                    {dec.forfaitNum > 0 ? <Text style={{ marginLeft: 6 }}>Forfaits : {dec.forfaitFormate} €</Text> : null}
                                    {dec.franchiseNum !== 0 ? (
                                        <Text style={{ color: '#6b21a8', marginLeft: 6 }}>Franchise : {dec.franchiseFormate} €</Text>
                                    ) : null}
                                </View>
                            </View>

                            <View style={{ paddingLeft: 6, marginTop: 2 }}>
                                {dec.lignes && dec.lignes.map((l, j) => (
                                    <View key={j} style={{ flexDirection: 'row', marginBottom: 2 }} wrap={false}>
                                        <Text style={{ marginRight: 4 }}>•</Text>
                                        <Text style={{ flex: 1, lineHeight: DENSITY.lineHeight }}>
                                            {l.prestataire} - {l.desc} ({l.montantFormate || formatPDFAmount(l.montant) || '0'} € {l.typeMontantBrut || l.typeMontant})
                                            {l.avisCouverture === 'Non' ? (
                                                <Text style={{ color: '#dc2626', fontWeight: 'bold', fontSize: (adaptedStyle.fontSize || DENSITY.fontBase) * 0.85, marginLeft: 3 }}>
                                                    {' '}[Pas de couverture]
                                                </Text>
                                            ) : null}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
};

export default PDFFeesDetailBlock;
