import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';

const PDFCoordBlock = ({ data, styleBlock }) => {
    if (!data) return null;

    const formData = data.formData || {};
    const adaptedStyle = adaptBlockStyle(styleBlock);
    
    const containerStyle = {
        marginBottom: 15,
        ...adaptedStyle,
        fontSize: adaptedStyle.fontSize || 9,
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
            
            {formData.adresse && <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Adresse :</Text> {formData.adresse}</Text>}
            {formData.franchise && <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Franchise applicable :</Text> {formData.franchise}</Text>}
            {formData.pertesIndirectes && <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Pertes indirectes :</Text> {formData.pertesIndirectes}</Text>}
            {formData.expertInfos && <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Expert :</Text> {formData.expertInfos}</Text>}
            {formData.expert && !formData.expertInfos && <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Expert :</Text> {formData.expert}</Text>}
            
            {data.paginationDocMailExpertise && (
                <Text style={{ ...textStyle, fontSize: (adaptedStyle.fontSize || 9) * 0.85, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>
                    {data.paginationDocMailExpertise}
                </Text>
            )}

            {formData.isContradictoire && (
                <View style={{ marginLeft: 15, marginTop: 5, borderLeftWidth: 2, borderLeftColor: '#1e293b', paddingLeft: 10 }}>
                    <Text style={{ fontStyle: 'italic', textDecoration: 'underline', marginBottom: 3 }}>Expertise contradictoire avec :</Text>
                    {formData.cieContradictoire && <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Cie :</Text> {formData.cieContradictoire}</Text>}
                    {formData.expertContradictoire && <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Expert :</Text> {formData.expertContradictoire}</Text>}
                    {formData.compteDeContradictoire && <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Pour le compte de :</Text> {formData.compteDeContradictoire}</Text>}
                </View>
            )}
        </View>
    );
};

export default PDFCoordBlock;
