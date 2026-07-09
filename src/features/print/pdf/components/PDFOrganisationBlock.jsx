import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';

const PDFOrganisationBlock = ({ data, styleBlock, metadata }) => {
    if (!data) return null;

    const adaptedStyle = adaptBlockStyle(styleBlock);
    const orgaAdvancedMode = metadata?.orgaAdvancedMode;

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

            <View style={{ marginTop: 4 }}>
                {data.occupants && data.occupants.map((o) => (
                    <View key={o.id} style={{
                        marginBottom: 4,
                        padding: o.isResponsible ? 4 : 2,
                        backgroundColor: o.isResponsible ? '#fff7ed' : 'transparent',
                        borderWidth: o.isResponsible ? 1 : 0,
                        borderColor: '#fed7aa',
                        borderRadius: 2
                    }} wrap={false}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginLeft: o.depth === 1 ? 30 : 0 }}>
                            <Text style={{ width: 60, fontWeight: 'bold' }}>{o.etage}</Text>
                            <Text style={{ width: 140, color: '#334155' }}>- {o.statut}</Text>
                            <Text style={{ flex: 1, lineHeight: 1.3 }}>
                                <Text>: </Text>
                                <Text style={{ fontWeight: 'bold' }}>{o.nomComplet}</Text>
                                {o.isResponsible && (
                                    <Text style={{ fontSize: (adaptedStyle.fontSize || 9) * 0.8, color: '#ea580c', marginLeft: 5 }}> [RESPONSABLE]</Text>
                                )}
                                {o.iban && <Text style={{ fontSize: (adaptedStyle.fontSize || 9) * 0.85, color: '#64748b', fontStyle: 'italic', marginLeft: 5 }}> (IBAN: {o.iban})</Text>}
                                {o.tel && <Text style={{ fontSize: (adaptedStyle.fontSize || 9) * 0.9, marginLeft: 5 }}> (Tel: {o.tel})</Text>}
                                {orgaAdvancedMode && o.email && <Text style={{ fontSize: (adaptedStyle.fontSize || 9) * 0.9, marginLeft: 5 }}> (Email: {o.email})</Text>}
                            </Text>
                        </View>

                        {orgaAdvancedMode && (o.rc === 'Oui' || o.secAssurance === 'Oui') && (
                            <View style={{
                                marginLeft: (o.depth === 1 ? 30 : 0) + 200,
                                marginTop: 2,
                                borderLeftWidth: 1,
                                borderLeftColor: '#cbd5e1',
                                paddingLeft: 5,
                                width: '80%'
                            }}>
                                {o.rc === 'Oui' && (
                                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                                        <Text style={{ width: '33%', fontStyle: 'italic', color: '#334155', fontSize: (adaptedStyle.fontSize || 9) * 0.9 }}>Assurance RC Familiale</Text>
                                        <Text style={{ flex: 1, fontStyle: 'italic', color: '#334155', fontSize: (adaptedStyle.fontSize || 9) * 0.9 }}>: {o.rcPolice ? `Police ${o.rcPolice}` : 'Non précisé'}</Text>
                                    </View>
                                )}
                                {o.secAssurance === 'Oui' && (
                                    <View style={{ flexDirection: 'row', marginBottom: 2 }}>
                                        <Text style={{ width: '33%', fontStyle: 'italic', color: '#334155', fontSize: (adaptedStyle.fontSize || 9) * 0.9 }}>Autre assurance ({o.secType || 'Type'})</Text>
                                        <Text style={{ flex: 1, fontStyle: 'italic', color: '#334155', fontSize: (adaptedStyle.fontSize || 9) * 0.9 }}>: {o.secCie || 'Compagnie non précisée'} {o.secPolice ? `(Police: ${o.secPolice})` : ''}</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                ))}
                
                {data.occupants && data.occupants.length === 0 && (
                    <Text style={{ fontStyle: 'italic', color: '#94a3b8' }}>Aucune partie impliquée.</Text>
                )}
            </View>

            {data.intervenants && data.intervenants.length > 0 && (
                <View style={{ marginTop: 10, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#e2e8f0' }} wrap={false}>
                    <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Autres intervenants :</Text>
                    {data.intervenants.map(inter => (
                        <Text key={inter.id} style={{ marginLeft: 15, marginBottom: 2, lineHeight: 1.3 }}>
                            <Text style={{ fontWeight: 'bold' }}>{inter.nom} {inter.prenom}</Text>
                            {inter.role && <Text style={{ fontStyle: 'italic' }}> — {inter.role}</Text>}
                            {inter.societe && <Text> ({inter.societe})</Text>}
                            {inter.tel && <Text style={{ fontSize: (adaptedStyle.fontSize || 9) * 0.9, marginLeft: 5 }}> (Tél: {inter.tel})</Text>}
                            {inter.email && <Text style={{ fontSize: (adaptedStyle.fontSize || 9) * 0.9, marginLeft: 5 }}> (Email: {inter.email})</Text>}
                        </Text>
                    ))}
                </View>
            )}
        </View>
    );
};

export default PDFOrganisationBlock;
