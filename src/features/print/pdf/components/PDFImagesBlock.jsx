import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';
import { DENSITY } from '../pdfStyles';

const PDFImagesBlock = ({ data, styleBlock }) => {
    if (!data) return null;

    let imagesToRender = data.images || [];

    if (imagesToRender.length === 0 && data.occupantsWithPhotos) {
        data.occupantsWithPhotos.forEach(occ => {
            if (occ.resolvedImages) {
                occ.resolvedImages.forEach((url, idx) => {
                    imagesToRender.push({
                        id: `${occ.id}-${idx}`,
                        dataUrl: url,
                        caption: `Photos concernant ${occ.nom || ''}`
                    });
                });
            }
        });
    }

    const adaptedStyle = adaptBlockStyle(styleBlock);

    if (imagesToRender.length === 0) {
        return null;
    }

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

    return (
        <View style={containerStyle} wrap>
            {data.title ? <Text style={titleStyle} minPresenceAhead={40}>{data.title}</Text> : null}

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
                            <Text style={{ textAlign: 'center', fontStyle: 'italic', color: '#475569', fontSize: (adaptedStyle.fontSize || DENSITY.fontBase) * 0.9, lineHeight: 1.2 }}>
                                {img.caption}
                            </Text>
                        ) : null}
                    </View>
                ))}
            </View>
        </View>
    );
};

export default PDFImagesBlock;
