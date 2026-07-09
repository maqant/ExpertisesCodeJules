import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';

const PDFAnnexesLibresBlock = ({ data, styleBlock }) => {
    // Si pas de données (fallback gracieux sans crash)
    if (!data) {
        return null;
    }

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
        <View style={containerStyle} wrap={false}>
            {data.title && (
                <Text style={titleStyle}>{data.title}</Text>
            )}
            
            {data.annexes && data.annexes.length > 0 ? (
                <View style={{ marginTop: 4 }}>
                    {data.annexes.map((annexe, i) => (
                        <View key={i} style={{ marginBottom: 4 }}>
                            <Text style={{ fontWeight: 'bold' }}>{annexe.nom || `Annexe ${i+1}`}</Text>
                            {annexe.description && <Text style={{ color: '#475569', fontSize: (adaptedStyle.fontSize || 9) * 0.9 }}>{annexe.description}</Text>}
                        </View>
                    ))}
                </View>
            ) : (
                <Text style={{ fontStyle: 'italic', color: '#94a3b8' }}>
                    Aucune annexe supplémentaire.
                </Text>
            )}
        </View>
    );
};

export default PDFAnnexesLibresBlock;
