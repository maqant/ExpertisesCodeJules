import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';

const PDFCoordBlock = ({ data, styleBlock }) => {
    if (!data) return null;

    const adaptedStyle = adaptBlockStyle(styleBlock);
    
    const containerStyle = {
        marginBottom: 15,
        ...adaptedStyle,
        fontSize: adaptedStyle.fontSize || 9, // par défaut 12px -> 9pt
    };

    const textStyle = {
        marginBottom: 3,
        lineHeight: 1.4,
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
            
            {data.adresse && <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Adresse :</Text> {data.adresse}</Text>}
            {data.franchise && <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Franchise applicable :</Text> {data.franchise}</Text>}
            {data.pertesIndirectes && <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Pertes indirectes :</Text> {data.pertesIndirectes}</Text>}
            {data.expert && <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Expert :</Text> {data.expert}</Text>}
            
            {data.mailExpertiseAnnexe && (
                <Text style={{ ...textStyle, fontSize: (adaptedStyle.fontSize || 9) * 0.85, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>
                    {data.mailExpertiseAnnexe}
                </Text>
            )}

            {data.contradictoire && (
                <View style={{ marginLeft: 15, marginTop: 5, borderLeftWidth: 2, borderLeftColor: '#1e293b', paddingLeft: 10 }}>
                    <Text style={{ fontStyle: 'italic', textDecoration: 'underline', marginBottom: 3 }}>Expertise contradictoire avec :</Text>
                    {data.contradictoire.cie && <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Cie :</Text> {data.contradictoire.cie}</Text>}
                    {data.contradictoire.expert && <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Expert :</Text> {data.contradictoire.expert}</Text>}
                    {data.contradictoire.compteDe && <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Pour le compte de :</Text> {data.contradictoire.compteDe}</Text>}
                </View>
            )}
        </View>
    );
};

export default PDFCoordBlock;
