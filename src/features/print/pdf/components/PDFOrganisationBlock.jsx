import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';
import { DENSITY } from '../pdfStyles';

const PDFOrganisationBlock = ({ data, styleBlock, metadata }) => {
    if (!data) return null;

    const adaptedStyle = adaptBlockStyle(styleBlock);
    const orgaAdvancedMode = metadata?.orgaAdvancedMode;

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

    const occupantsList = data.occupantsHierarchy || data.occupants || [];

    return (
        <View style={containerStyle} wrap>
            {data.title ? <Text style={titleStyle} minPresenceAhead={30}>{data.title}</Text> : null}

            <View style={{ marginTop: 2 }}>
                {occupantsList.map((o) => (
                    <View key={o.id} style={{
                        marginBottom: 3,
                        padding: o.isResponsible ? 4 : 2,
                        backgroundColor: o.isResponsible ? '#fff7ed' : '#f8fafc',
                        borderWidth: 1,
                        borderColor: o.isResponsible ? '#fed7aa' : '#e2e8f0',
                        borderRadius: 3
                    }} wrap={false}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', marginLeft: o.depth === 1 ? 20 : 0 }}>
                            <Text style={{ width: 60, fontWeight: 'bold' }}>{o.etage}</Text>
                            <Text style={{ width: 140, color: '#334155' }}>- {o.statut}</Text>
                            <Text style={{ flex: 1, lineHeight: DENSITY.lineHeight }}>
                                <Text>: </Text>
                                <Text style={{ fontWeight: 'bold' }}>{o.formattedNomPrenom || o.nomComplet || ''}</Text>
                                {o.isResponsible ? (
                                    <Text style={{ fontSize: (adaptedStyle.fontSize || DENSITY.fontBase) * 0.85, color: '#ea580c', marginLeft: 5 }}> [RESPONSABLE]</Text>
                                ) : null}
                                {o.iban ? <Text style={{ fontSize: (adaptedStyle.fontSize || DENSITY.fontBase) * 0.85, color: '#64748b', fontStyle: 'italic', marginLeft: 5 }}> (IBAN: {o.iban})</Text> : null}
                                {o.tel ? <Text style={{ fontSize: (adaptedStyle.fontSize || DENSITY.fontBase) * 0.9, marginLeft: 5 }}> (Tel: {o.tel})</Text> : null}
                                {orgaAdvancedMode && o.email ? <Text style={{ fontSize: (adaptedStyle.fontSize || DENSITY.fontBase) * 0.9, marginLeft: 5 }}> (Email: {o.email})</Text> : null}
                            </Text>
                        </View>

                        {orgaAdvancedMode && (o.rc === 'Oui' || o.secAssurance === 'Oui') ? (
                            <View style={{
                                marginLeft: (o.depth === 1 ? 20 : 0) + 200,
                                marginTop: 2,
                                borderLeftWidth: 2,
                                borderLeftColor: '#cbd5e1',
                                paddingLeft: 6,
                                width: '80%'
                            }}>
                                {o.rc === 'Oui' ? (
                                    <View style={{ flexDirection: 'row', marginBottom: 1 }}>
                                        <Text style={{ width: '35%', fontStyle: 'italic', color: '#475569', fontSize: (adaptedStyle.fontSize || DENSITY.fontBase) * 0.9 }}>Assurance RC Familiale</Text>
                                        <Text style={{ flex: 1, fontStyle: 'italic', color: '#475569', fontSize: (adaptedStyle.fontSize || DENSITY.fontBase) * 0.9 }}>: {o.rcPolice ? `Police ${o.rcPolice}` : 'Non précisé'}</Text>
                                    </View>
                                ) : null}
                                {o.secAssurance === 'Oui' ? (
                                    <View style={{ flexDirection: 'row', marginBottom: 1 }}>
                                        <Text style={{ width: '35%', fontStyle: 'italic', color: '#475569', fontSize: (adaptedStyle.fontSize || DENSITY.fontBase) * 0.9 }}>Autre assurance ({o.secType || 'Type'})</Text>
                                        <Text style={{ flex: 1, fontStyle: 'italic', color: '#475569', fontSize: (adaptedStyle.fontSize || DENSITY.fontBase) * 0.9 }}>: {o.secCie || 'Compagnie non précisée'} {o.secPolice ? `(Police: ${o.secPolice})` : ''}</Text>
                                    </View>
                                ) : null}
                            </View>
                        ) : null}
                    </View>
                ))}
                
                {occupantsList.length === 0 ? (
                    <Text style={{ fontStyle: 'italic', color: '#94a3b8' }}>Aucune partie impliquée.</Text>
                ) : null}
            </View>

            {data.intervenants && data.intervenants.length > 0 ? (
                <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#e2e8f0' }} wrap={false}>
                    <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Autres intervenants :</Text>
                    {data.intervenants.map(inter => (
                        <Text key={inter.id} style={{ marginLeft: 15, marginBottom: 2, lineHeight: DENSITY.lineHeight }}>
                            <Text style={{ fontWeight: 'bold' }}>{inter.nom || ''} {inter.prenom || ''}</Text>
                            {inter.role ? <Text style={{ fontStyle: 'italic' }}> — {inter.role}</Text> : null}
                            {inter.societe ? <Text> ({inter.societe})</Text> : null}
                            {inter.tel ? <Text style={{ fontSize: (adaptedStyle.fontSize || DENSITY.fontBase) * 0.9, marginLeft: 5 }}> (Tél: {inter.tel})</Text> : null}
                            {inter.email ? <Text style={{ fontSize: (adaptedStyle.fontSize || DENSITY.fontBase) * 0.9, marginLeft: 5 }}> (Email: {inter.email})</Text> : null}
                        </Text>
                    ))}
                </View>
            ) : null}
        </View>
    );
};

export default PDFOrganisationBlock;
