import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';
import { DENSITY } from '../pdfStyles';

const PDFAnnexesLibresBlock = ({ data, styleBlock }) => {
    // Si pas de données (fallback gracieux sans crash)
    if (!data || !data.annexes || data.annexes.length === 0) {
        return null;
    }

    const adaptedStyle = adaptBlockStyle(styleBlock);

    const containerStyle = {
        marginBottom: DENSITY.blockGap,
        ...adaptedStyle,
        fontSize: adaptedStyle.fontSize || 9,
    };

    const titleStyle = {
        fontWeight: 'bold',
        textDecoration: 'underline',
        marginBottom: DENSITY.sectionTitleGap,
        fontSize: (adaptedStyle.fontSize || 9) + 1.5,
    };

    return (
        <View style={containerStyle}>
            <View wrap={false}>
                {data.title && (
                    <Text style={titleStyle}>{data.title}</Text>
                )}
                <View style={{ marginTop: 2, marginBottom: DENSITY.itemGap }}>
                    <Text style={{ fontWeight: 'bold' }}>{data.annexes[0].nom || `Annexe 1`}</Text>
                    {data.annexes[0].description && <Text style={{ color: '#475569', fontSize: (adaptedStyle.fontSize || 9) * 0.9 }}>{data.annexes[0].description}</Text>}
                </View>
            </View>

            {data.annexes.length > 1 ? (
                <View>
                    {data.annexes.slice(1).map((annexe, i) => (
                        <View key={i + 1} style={{ marginBottom: DENSITY.itemGap }}>
                            <Text style={{ fontWeight: 'bold' }}>{annexe.nom || `Annexe ${i + 2}`}</Text>
                            {annexe.description && <Text style={{ color: '#475569', fontSize: (adaptedStyle.fontSize || 9) * 0.9 }}>{annexe.description}</Text>}
                        </View>
                    ))}
                </View>
            ) : null}
        </View>
    );
};

export default PDFAnnexesLibresBlock;
