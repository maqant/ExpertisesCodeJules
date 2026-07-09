import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';

const PDFFeesDetailBlock = ({ data, styleBlock, showSubtotals }) => {
    if (!data) return null;
    if (!showSubtotals || !data.decomptes || data.decomptes.length === 0) return null;

    const adaptedStyle = adaptBlockStyle(styleBlock);

    const containerStyle = {
        marginBottom: 15,
        ...adaptedStyle,
        fontSize: adaptedStyle.fontSize || 9,
    };

    return (
        <View style={containerStyle} wrap>
            <View style={{
                backgroundColor: '#ffffff',
                borderWidth: styleBlock?.border ? 2 : 0,
                borderColor: adaptedStyle.color || '#000000',
                padding: styleBlock?.border ? 8 : 0,
                borderRadius: 3
            }}>
                <Text style={{ fontWeight: 'bold' }}>Détail des justificatifs par partie</Text>
                <Text style={{ fontSize: (adaptedStyle.fontSize || 9) * 0.85, color: '#64748b', fontStyle: 'italic', marginBottom: 8 }}>
                    Inclut l'intégralité des pièces reçues, y compris les éléments non retenus ou hors garanties.
                </Text>

                <View style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {data.decomptes.map((dec, i) => (
                        <View key={i} style={{
                            backgroundColor: '#f8fafc',
                            padding: 6,
                            borderRadius: 2,
                            borderWidth: 1,
                            borderColor: '#e2e8f0'
                        }} wrap={false}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                                    <Text style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{dec.compteDeCourt}</Text>
                                    {dec.isExpertClient && (
                                        <Text style={{ color: '#15803d', fontSize: (adaptedStyle.fontSize || 9) * 0.8, marginLeft: 5 }}>
                                            (Expert client : {dec.nomContreExpert || 'Non précisé'})
                                        </Text>
                                    )}
                                </View>
                                
                                <View style={{ flexDirection: 'row', fontWeight: 'bold', color: '#475569', fontSize: (adaptedStyle.fontSize || 9) * 0.9 }}>
                                    {dec.htvaNum > 0 && <Text style={{ marginLeft: 10 }}>HTVA : {dec.htvaFormate} €</Text>}
                                    {dec.tvacNum > 0 && <Text style={{ marginLeft: 10 }}>TVAC : {dec.tvacFormate} €</Text>}
                                    {dec.forfaitNum > 0 && <Text style={{ marginLeft: 10 }}>Forfaits : {dec.forfaitFormate} €</Text>}
                                    {dec.franchiseNum !== 0 && (
                                        <Text style={{ color: '#6b21a8', marginLeft: 10 }}>Franchise : {dec.franchiseFormate} €</Text>
                                    )}
                                </View>
                            </View>

                            <View style={{ paddingLeft: 10, marginTop: 2 }}>
                                {dec.lignes && dec.lignes.map((l, j) => (
                                    <View key={j} style={{ flexDirection: 'row', marginBottom: 2 }}>
                                        <Text style={{ marginRight: 5 }}>•</Text>
                                        <Text style={{ flex: 1, lineHeight: 1.3 }}>
                                            {l.prestataire} - {l.desc} ({l.montantFormate || '0'} € {l.typeMontantBrut || l.typeMontant})
                                            {l.avisCouverture === 'Non' && (
                                                <Text style={{ color: '#dc2626', fontWeight: 'bold', fontSize: (adaptedStyle.fontSize || 9) * 0.85, marginLeft: 5 }}>
                                                    {' '}[Pas de couverture]
                                                </Text>
                                            )}
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
