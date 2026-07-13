import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';
import { DENSITY, COLORS, solidBorder, pdfStyles, TYPO } from '../pdfStyles';

const PDFOrganisationBlock = ({ data, styleBlock, orgaAdvancedMode }) => {
    if (!data) return null;

    const adaptedStyle = adaptBlockStyle(styleBlock);

    const containerStyle = {
        marginBottom: DENSITY.blockGap,
        ...adaptedStyle,
    };

    const occupantsList = data.occupantsHierarchy || data.occupants || [];

    return (
        <View style={containerStyle} wrap>
            {data.title ? <Text style={pdfStyles.sectionTitle} minPresenceAhead={30}>{data.title}</Text> : null}

            <View style={{ marginTop: 2 }}>
                {occupantsList.map((o) => (
                    <View key={o.id} style={{
                        marginBottom: DENSITY.occupantGap,
                        marginLeft: (o.depth ?? 0) * DENSITY.occupantIndent,
                        padding: o.isResponsible ? DENSITY.occupantPaddingResponsible : DENSITY.occupantPadding,
                        backgroundColor: o.isResponsible ? COLORS.cardResponsibleBg : COLORS.cardBg,
                        ...solidBorder(1, o.isResponsible ? COLORS.cardResponsibleBorder : COLORS.cardBorder),
                        borderRadius: DENSITY.borderRadius
                    }} wrap={false}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                            <Text style={{ width: 60, ...TYPO.bodyBold }}>{o.etage}</Text>
                            <Text style={{ width: 140, ...TYPO.body, color: '#334155' }}>- {o.statut}</Text>
                            <Text style={{ flex: 1, ...TYPO.body }}>
                                <Text>: </Text>
                                <Text style={{ fontWeight: 'bold' }}>{o.formattedNomPrenom || o.nomComplet || ''}</Text>
                                {o.isResponsible ? (
                                    <Text style={{ ...TYPO.small, color: '#ea580c', marginLeft: 5 }}> [RESPONSABLE]</Text>
                                ) : null}
                                {o.iban ? <Text style={{ ...TYPO.smallMuted, fontStyle: 'italic', marginLeft: 5 }}> (IBAN: {o.iban})</Text> : null}
                                {o.tel ? <Text style={{ fontSize: DENSITY.fontSmall, marginLeft: 5 }}> (Tel: {o.tel})</Text> : null}
                                {orgaAdvancedMode && o.email ? <Text style={{ fontSize: DENSITY.fontSmall, marginLeft: 5 }}> (Email: {o.email})</Text> : null}
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
                                        <Text style={{ width: '35%', ...TYPO.smallMuted, fontStyle: 'italic' }}>Assurance RC Familiale</Text>
                                        <Text style={{ flex: 1, ...TYPO.smallMuted, fontStyle: 'italic' }}>: {o.rcPolice ? `Police ${o.rcPolice}` : 'Non précisé'}</Text>
                                    </View>
                                ) : null}
                                {o.secAssurance === 'Oui' ? (
                                    <View style={{ flexDirection: 'row', marginBottom: 1 }}>
                                        <Text style={{ width: '35%', ...TYPO.smallMuted, fontStyle: 'italic' }}>Autre assurance ({o.secType || 'Type'})</Text>
                                        <Text style={{ flex: 1, ...TYPO.smallMuted, fontStyle: 'italic' }}>: {o.secCie || 'Compagnie non précisée'} {o.secPolice ? `(Police: ${o.secPolice})` : ''}</Text>
                                    </View>
                                ) : null}
                            </View>
                        ) : null}
                    </View>
                ))}
                
                {occupantsList.length === 0 ? (
                    <Text style={{ ...TYPO.smallMuted, fontStyle: 'italic' }}>Aucune partie impliquée.</Text>
                ) : null}
            </View>

            {data.intervenants && data.intervenants.length > 0 ? (
                <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#e2e8f0' }} wrap={false}>
                    <Text style={{ ...TYPO.bodyBold, marginBottom: DENSITY.lineGap }}>Autres intervenants :</Text>
                    {data.intervenants.map(inter => (
                        <Text key={inter.id} style={{ marginLeft: 15, marginBottom: 2, ...TYPO.body }}>
                            <Text style={{ fontWeight: 'bold' }}>{inter.nom || ''} {inter.prenom || ''}</Text>
                            {inter.role ? <Text style={{ fontStyle: 'italic' }}> — {inter.role}</Text> : null}
                            {inter.societe ? <Text> ({inter.societe})</Text> : null}
                            {inter.tel ? <Text style={{ fontSize: DENSITY.fontSmall, marginLeft: 5 }}> (Tél: {inter.tel})</Text> : null}
                            {inter.email ? <Text style={{ fontSize: DENSITY.fontSmall, marginLeft: 5 }}> (Email: {inter.email})</Text> : null}
                        </Text>
                    ))}
                </View>
            ) : null}
        </View>
    );
};

export default PDFOrganisationBlock;
