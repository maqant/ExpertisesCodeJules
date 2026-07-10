import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';
import { DENSITY, TYPO } from '../pdfStyles';

const PDFReportHeader = ({ data, styleBlock }) => {
    if (!data || !data.formData) return null;

    const adaptedStyle = adaptBlockStyle(styleBlock);
    
    const containerStyle = {
        marginBottom: DENSITY.headerGap,
        color: adaptedStyle.color || '#0f172a',
        textAlign: adaptedStyle.textAlign || 'left',
    };

    const innerStyle = {
        ...adaptedStyle,
        backgroundColor: '#ffffff'
    };

    // Use formData.dateEmission or a fallback
    const dateFormatted = data.formData.dateEmission || `Émis le ${new Date().toLocaleDateString('fr-FR')}`;

    return (
        <View wrap={false} style={containerStyle}>
            <View style={innerStyle}>
                <Text style={{ ...TYPO.bodyBold, textTransform: 'uppercase', fontSize: 10 }}>
                    {dateFormatted}
                </Text>
            </View>
        </View>
    );
};

export default PDFReportHeader;
