import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle, adaptSpacerHeight } from '../pdfStyleAdapter';
import { DENSITY } from '../pdfStyles';

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
            {data.texte ? (
                <Text style={{ lineHeight: DENSITY.lineHeight }}>{data.texte}</Text>
            ) : null}
        </View>
    );
};

export default PDFCustomBlock;
