import React from 'react';
import { View, Text } from '@react-pdf/renderer';

const PDFMissingBlock = ({ blockKey }) => {
    return (
        <View style={{
            marginVertical: 10,
            padding: 10,
            borderWidth: 2,
            borderColor: '#ef4444',
            backgroundColor: '#fee2e2',
            borderRadius: 4
        }} wrap={false}>
            <Text style={{
                color: '#991b1b',
                fontWeight: 'bold',
                fontSize: 10
            }}>
                ⚠ BLOC NON RENDU : {blockKey} — audit de parité
            </Text>
        </View>
    );
};

export default PDFMissingBlock;
