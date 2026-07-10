import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';
import { DENSITY, pdfStyles } from '../pdfStyles';

const PDFDiversBlock = ({ data, styleBlock }) => {
    if (!data) return null;

    const adaptedStyle = adaptBlockStyle(styleBlock);

    const texteContent = data.formDataDivers || data.texte;

    // Si aucune donnée pertinente, on ne rend rien du tout (pas de gaspillage vertical)
    if (!texteContent || texteContent.trim() === '') {
        return null;
    }

    const containerStyle = {
        marginBottom: DENSITY.blockGap,
        ...adaptedStyle,
    };

    return (
        <View style={containerStyle} wrap>
            {data.title ? (
                <Text style={pdfStyles.sectionTitle} minPresenceAhead={30}>{data.title}</Text>
            ) : null}
            {texteContent ? (
                <Text style={pdfStyles.bodyText}>{texteContent}</Text>
            ) : (
                <Text style={{ ...pdfStyles.bodyText, fontStyle: 'italic', color: '#94a3b8' }}>Néant</Text>
            )}
        </View>
    );
};

export default PDFDiversBlock;
