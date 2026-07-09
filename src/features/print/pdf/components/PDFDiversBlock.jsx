import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';

const PDFDiversBlock = ({ data, styleBlock }) => {
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
        <View style={containerStyle} wrap={false}>
            {data.title && (
                <Text style={titleStyle}>{data.title}</Text>
            )}
            {data.texte && (
                <Text style={{ lineHeight: 1.4 }}>{data.texte}</Text>
            )}
        </View>
    );
};

export default PDFDiversBlock;
