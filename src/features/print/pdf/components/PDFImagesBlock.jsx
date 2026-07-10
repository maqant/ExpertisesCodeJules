import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';
import { DENSITY, pdfStyles, TYPO } from '../pdfStyles';
import PDFAnnexRef from './PDFAnnexRef';

const PDFImagesBlock = ({ data, styleBlock }) => {
    if (!data) return null;

    let imagesToRender = data.images || [];

    const adaptedStyle = adaptBlockStyle(styleBlock);
    const containerStyle = {
        marginBottom: DENSITY.blockGap,
        ...adaptedStyle,
    };

    // Si on a explicitement des images à rendre (ex: bloc personnalisé "photos"), on les rend
    if (imagesToRender.length > 0) {
        return (
            <View style={containerStyle} wrap>
                {data.title ? <Text style={pdfStyles.sectionTitle} minPresenceAhead={40}>{data.title}</Text> : null}

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 4 }}>
                    {imagesToRender.map((img, i) => (
                        <View key={img.id} style={{
                            width: '48%',
                            marginBottom: 10,
                            backgroundColor: '#ffffff',
                            padding: 4,
                            borderWidth: 1,
                            borderColor: '#e2e8f0',
                            borderRadius: 3
                        }} wrap={false}>
                            <View style={{
                                height: 120, // slightly smaller height for density
                                backgroundColor: '#f1f5f9',
                                borderRadius: 2,
                                marginBottom: 4
                            }}>
                                {img.dataUrl ? (
                                    <Image src={img.dataUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                ) : null}
                            </View>
                            {img.caption ? (
                                <Text style={{ ...TYPO.smallMuted, textAlign: 'center', fontStyle: 'italic' }}>
                                    {img.caption}
                                </Text>
                            ) : null}
                        </View>
                    ))}
                </View>
            </View>
        );
    }

    // Sinon, on se contente de lister les occupants avec leurs références d'annexe
    if (data.occupantsWithPhotos && data.occupantsWithPhotos.length > 0) {
        return (
            <View style={containerStyle} wrap>
                {data.title ? <Text style={pdfStyles.sectionTitle} minPresenceAhead={40}>{data.title}</Text> : null}
                <View style={{ marginTop: 2 }}>
                    {data.occupantsWithPhotos.map(occ => (
                        <View key={occ.id} style={{ marginBottom: 4 }}>
                            <Text style={{ ...pdfStyles.bodyText, fontWeight: 'bold' }}>
                                - Photos de {occ.nom || ''} {occ.annexReference ? (
                                    <PDFAnnexRef data={occ.annexReference} style={{ ...pdfStyles.mutedText, fontStyle: 'italic' }} />
                                ) : null}
                            </Text>
                        </View>
                    ))}
                </View>
            </View>
        );
    }

    return null;
};

export default PDFImagesBlock;
