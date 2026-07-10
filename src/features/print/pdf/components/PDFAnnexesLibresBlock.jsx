import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';
import { DENSITY, pdfStyles, TYPO } from '../pdfStyles';

const PDFAnnexesLibresBlock = ({ data, styleBlock }) => {
    // Si pas de données (fallback gracieux sans crash)
    if (!data || !data.annexes || data.annexes.length === 0) {
        return null;
    }

    const adaptedStyle = adaptBlockStyle(styleBlock);

    const containerStyle = {
        marginBottom: DENSITY.blockGap,
        ...adaptedStyle,
    };

    return (
        <View style={containerStyle}>
            <View wrap={false}>
                {data.title && (
                    <Text style={pdfStyles.sectionTitle}>{data.title}</Text>
                )}
                <View style={{ marginTop: 4, marginBottom: DENSITY.itemGap }}>
                    <Text style={{ ...TYPO.bodyBold }}>{data.annexes[0].nom || `Annexe 1`}</Text>
                    {data.annexes[0].description && (
                        <Text style={{ ...TYPO.smallMuted }}>{data.annexes[0].description}</Text>
                    )}
                </View>
            </View>

            {data.annexes.length > 1 ? (
                <View>
                    {data.annexes.slice(1).map((annexe, i) => (
                        <View key={i + 1} style={{ marginBottom: DENSITY.itemGap }}>
                            <Text style={{ ...TYPO.bodyBold }}>{annexe.nom || `Annexe ${i + 2}`}</Text>
                            {annexe.description && (
                                <Text style={{ ...TYPO.smallMuted }}>{annexe.description}</Text>
                            )}
                        </View>
                    ))}
                </View>
            ) : null}
        </View>
    );
};

export default PDFAnnexesLibresBlock;
