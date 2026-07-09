import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';
import { pdfStyles as baseStyles } from '../pdfStyles';

const PDFReportHeader = ({ data, styleBlock }) => {
    if (!data) return null;

    const adaptedStyle = adaptBlockStyle(styleBlock);
    
    // Web component styles:
    // fontSize: styleBlock?.fontSize || 12 (px -> pt handled by adapter)
    // color: styleBlock?.color || '#0f172a'
    // fontFamily: styleBlock?.fontFamily || 'Arial'
    // textAlign: styleBlock?.textAlign || 'left'

    const containerStyle = {
        marginBottom: 15,
        fontSize: adaptedStyle.fontSize || 9, // 12px * 0.75
        color: adaptedStyle.color || '#0f172a',
        textAlign: adaptedStyle.textAlign || 'left',
    };

    const innerStyle = {
        ...adaptedStyle,
        backgroundColor: '#ffffff'
    };

    return (
        <View wrap={false} style={containerStyle}>
            <View style={innerStyle}>
                <Text style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>
                    {data.dateFormatted}
                </Text>
            </View>
        </View>
    );
};

export default PDFReportHeader;
