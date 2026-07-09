import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';

const PDFImagesBlock = ({ data, styleBlock }) => {
    if (!data) return null;

    const adaptedStyle = adaptBlockStyle(styleBlock);

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

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10 }}>
                {data.images && data.images.map((img, i) => (
                    <View key={img.id} style={{
                        width: '48%',
                        marginBottom: 15,
                        backgroundColor: '#ffffff',
                        padding: 6,
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                        borderRadius: 3
                    }} wrap={false}>
                        <View style={{
                            height: 140, // équivalent h-48
                            backgroundColor: '#f1f5f9',
                            borderRadius: 2,
                            marginBottom: 6
                        }}>
                            {img.dataUrl && (
                                <Image src={img.dataUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                            )}
                        </View>
                        {img.caption && (
                            <Text style={{ textAlign: 'center', fontStyle: 'italic', color: '#475569', fontSize: (adaptedStyle.fontSize || 9) * 0.9, lineHeight: 1.2 }}>
                                {img.caption}
                            </Text>
                        )}
                    </View>
                ))}
            </View>
        </View>
    );
};

export default PDFImagesBlock;
