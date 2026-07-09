import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';
import { DENSITY } from '../pdfStyles';

const PDFCoordBlock = ({ data, styleBlock }) => {
    if (!data) return null;

    const formData = data.formData || {};
    const adaptedStyle = adaptBlockStyle(styleBlock);
    
    const containerStyle = {
        marginBottom: DENSITY.blockGap,
        ...adaptedStyle,
        fontSize: adaptedStyle.fontSize || DENSITY.fontBase,
    };

    const textStyle = {
        marginBottom: DENSITY.lineGap,
        lineHeight: DENSITY.lineHeight,
    };

    const titleStyle = {
        fontWeight: 'bold',
        textDecoration: 'underline',
        marginBottom: DENSITY.sectionTitleGap,
        fontSize: adaptedStyle.fontSize ? adaptedStyle.fontSize + 2 : DENSITY.fontTitle,
    };

    return (
        <View style={containerStyle} wrap>
            {data.title ? <Text style={titleStyle} minPresenceAhead={30}>{data.title}</Text> : null}
            
            {formData.adresse ? <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Adresse :</Text> {formData.adresse}</Text> : null}
            {formData.franchise ? <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Franchise applicable :</Text> {formData.franchise}</Text> : null}
            {formData.pertesIndirectes ? <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Pertes indirectes :</Text> {formData.pertesIndirectes}</Text> : null}
            {formData.expertInfos ? <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Expert :</Text> {formData.expertInfos}</Text> : null}
            {(formData.expert && !formData.expertInfos) ? <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Expert :</Text> {formData.expert}</Text> : null}
            
            {data.paginationDocMailExpertise ? (
                <Text style={{ ...textStyle, fontSize: DENSITY.fontSmall, color: '#64748b', fontStyle: 'italic', marginTop: 2 }}>
                    {data.paginationDocMailExpertise}
                </Text>
            ) : null}

            {formData.isContradictoire ? (
                <View style={{ marginLeft: DENSITY.subBlockIndent, marginTop: 3, borderLeftWidth: 2, borderLeftColor: '#cbd5e1', paddingLeft: 6 }} wrap={false}>
                    <Text style={{ fontStyle: 'italic', textDecoration: 'underline', marginBottom: 2 }}>Expertise contradictoire avec :</Text>
                    {formData.cieContradictoire ? <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Cie :</Text> {formData.cieContradictoire}</Text> : null}
                    {formData.expertContradictoire ? <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Expert :</Text> {formData.expertContradictoire}</Text> : null}
                    {formData.compteDeContradictoire ? <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Pour le compte de :</Text> {formData.compteDeContradictoire}</Text> : null}
                </View>
            ) : null}
        </View>
    );
};

export default PDFCoordBlock;
