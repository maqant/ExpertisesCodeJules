import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';
import { DENSITY } from '../pdfStyles';

const PDFCircumstancesBlock = ({ data, styleBlock }) => {
    if (!data) return null;

    const adaptedStyle = adaptBlockStyle(styleBlock);

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
            {data.title ? (
                <Text style={titleStyle} minPresenceAhead={30}>{data.title}</Text>
            ) : null}

            {data.timeline && data.timeline.length > 0 ? (
                <View style={{ marginTop: 2 }}>
                    {data.timeline.map((item) => {
                        const isFile = item.type === 'file';
                        return (
                            <View key={item.id} style={{
                                padding: 6,
                                marginBottom: 6,
                                backgroundColor: isFile ? '#f8fafc' : '#ffffff',
                                borderLeftWidth: 3,
                                borderLeftColor: isFile ? '#3b82f6' : '#f59e0b',
                                borderTopWidth: 1,
                                borderRightWidth: 1,
                                borderBottomWidth: 1,
                                borderColor: '#e2e8f0',
                                borderRadius: 3
                            }} wrap={false}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                                    {item.date ? <Text style={{ fontSize: 7, fontWeight: 'bold', color: '#64748b', marginRight: 5 }}>{item.date}</Text> : null}
                                    <View style={{ borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#ffffff', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2 }}>
                                        <Text style={{ fontSize: 6, fontWeight: 'bold', color: '#475569' }}>
                                            {isFile ? 'DOCUMENT' : 'NOTE'}
                                        </Text>
                                    </View>
                                </View>
                                {isFile ? (
                                    <Text style={{ fontWeight: 'bold', color: '#1e3a8a', fontSize: adaptedStyle.fontSize || DENSITY.fontBase }}>
                                        {item.fileName || 'Document sans nom'}
                                    </Text>
                                ) : (
                                    <Text style={{ color: '#1e293b', fontSize: adaptedStyle.fontSize || DENSITY.fontBase, lineHeight: DENSITY.lineHeight }}>
                                        {item.content || ''}
                                    </Text>
                                )}
                            </View>
                        );
                    })}
                </View>
            ) : (
                <View wrap>
                    <Text style={{ lineHeight: DENSITY.lineHeight }}>{data.formDataCause || data.texte || ''}</Text>
                    {data.paginationDocRapportCause ? (
                        <Text style={{ fontSize: DENSITY.fontSmall, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>
                            {data.paginationDocRapportCause}
                        </Text>
                    ) : null}
                </View>
            )}
        </View>
    );
};

export default PDFCircumstancesBlock;
