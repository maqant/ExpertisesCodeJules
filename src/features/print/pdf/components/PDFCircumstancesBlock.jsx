import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';

const PDFCircumstancesBlock = ({ data, styleBlock }) => {
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

            {data.timeline && data.timeline.length > 0 ? (
                <View style={{ marginTop: 5 }}>
                    {data.timeline.map((item) => {
                        const isFile = item.type === 'file';
                        return (
                            <View key={item.id} style={{
                                padding: 8,
                                marginBottom: 8,
                                backgroundColor: isFile ? '#eff6ff' : '#fffbeb',
                                borderLeftWidth: 3,
                                borderLeftColor: isFile ? '#3b82f6' : '#f59e0b',
                                borderRadius: 2
                            }} wrap={false}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                    <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#64748b', marginRight: 5 }}>{item.date}</Text>
                                    <View style={{ borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2 }}>
                                        <Text style={{ fontSize: 6, fontWeight: 'bold', color: '#475569' }}>
                                            {isFile ? 'DOCUMENT' : 'NOTE'}
                                        </Text>
                                    </View>
                                </View>
                                {isFile ? (
                                    <Text style={{ fontWeight: 'bold', color: '#1e3a8a', fontSize: adaptedStyle.fontSize || 9 }}>
                                        {item.fileName}
                                    </Text>
                                ) : (
                                    <Text style={{ color: '#1e293b', fontSize: adaptedStyle.fontSize || 9, lineHeight: 1.4 }}>
                                        {item.content}
                                    </Text>
                                )}
                            </View>
                        );
                    })}
                </View>
            ) : (
                <View wrap={false}>
                    <Text style={{ lineHeight: 1.4 }}>{data.texte}</Text>
                    {data.rapportCauseAnnexe && (
                        <Text style={{ fontSize: (adaptedStyle.fontSize || 9) * 0.85, color: '#64748b', fontStyle: 'italic', marginTop: 4 }}>
                            {data.rapportCauseAnnexe}
                        </Text>
                    )}
                </View>
            )}
        </View>
    );
};

export default PDFCircumstancesBlock;
