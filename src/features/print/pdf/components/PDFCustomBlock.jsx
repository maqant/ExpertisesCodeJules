import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle, adaptSpacerHeight } from '../pdfStyleAdapter';
import { DENSITY, pdfStyles } from '../pdfStyles';

const PDFCustomBlock = ({ data, styleBlock }) => {
    if (!data) return null;

    const adaptedStyle = adaptBlockStyle(styleBlock);

    // Si c'est juste un espaceur (texte vide, titre vide, pas de bordure), on rend une View vide plafonnée
    if (!data.title && !data.texte && !styleBlock?.border) {
        // La Sidebar envoie parfois l'espacement dans styleBlock.height, ou marginTop
        // On va utiliser adaptSpacerHeight sur ce qui est fourni
        const spacerH = adaptSpacerHeight(styleBlock?.height || styleBlock?.marginTop || 12);
        return <View style={{ height: spacerH, ...adaptedStyle }} />;
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
            {data.texte ? (
                <Text style={pdfStyles.bodyText}>{data.texte}</Text>
            ) : null}
        </View>
    );
};

export default PDFCustomBlock;
