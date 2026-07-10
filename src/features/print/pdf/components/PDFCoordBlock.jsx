import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';
import { DENSITY, pdfStyles, TYPO } from '../pdfStyles';

const PDFCoordBlock = ({ data, styleBlock }) => {
    if (!data) return null;

    const formData = data.formData || {};
    const adaptedStyle = adaptBlockStyle(styleBlock);
    
    const containerStyle = {
        marginBottom: DENSITY.blockGap,
        ...adaptedStyle,
    };

    return (
        <View style={containerStyle} wrap>
            {data.title ? (
                <Text style={pdfStyles.sectionTitle} minPresenceAhead={30}>
                    {data.title}
                </Text>
            ) : null}
            
            {formData.adresse ? (
                <Text style={pdfStyles.bodyText}>
                    <Text style={pdfStyles.bodyLabel}>Adresse :</Text> {formData.adresse}
                </Text>
            ) : null}
            
            {formData.franchise ? (
                <Text style={pdfStyles.bodyText}>
                    <Text style={pdfStyles.bodyLabel}>Franchise applicable :</Text> {formData.franchise}
                </Text>
            ) : null}
            
            {formData.pertesIndirectes ? (
                <Text style={pdfStyles.bodyText}>
                    <Text style={pdfStyles.bodyLabel}>Pertes indirectes :</Text> {formData.pertesIndirectes}
                </Text>
            ) : null}
            
            {data.expertDisplay ? (
                <Text style={pdfStyles.bodyText}>
                    <Text style={pdfStyles.bodyLabel}>Expert :</Text> {data.expertDisplay}
                </Text>
            ) : null}
            
            {data.paginationDocMailExpertise ? (
                <Text style={{ ...pdfStyles.mutedText, marginTop: 2 }}>
                    {data.paginationDocMailExpertise}
                </Text>
            ) : null}

            {formData.isContradictoire ? (
                <View style={{ marginLeft: DENSITY.subBlockIndent, marginTop: 3, borderLeftWidth: 2, borderLeftColor: '#cbd5e1', paddingLeft: 6 }} wrap={false}>
                    <Text style={{ ...TYPO.body, fontStyle: 'italic', textDecoration: 'underline', marginBottom: 2 }}>
                        Expertise contradictoire avec :
                    </Text>
                    {formData.cieContradictoire ? (
                        <Text style={pdfStyles.bodyText}>
                            <Text style={pdfStyles.bodyLabel}>Cie :</Text> {formData.cieContradictoire}
                        </Text>
                    ) : null}
                    {data.expertContradictoireDisplay ? (
                        <Text style={pdfStyles.bodyText}>
                            <Text style={pdfStyles.bodyLabel}>Expert :</Text> {data.expertContradictoireDisplay}
                        </Text>
                    ) : null}
                    {formData.compteDeContradictoire ? (
                        <Text style={pdfStyles.bodyText}>
                            <Text style={pdfStyles.bodyLabel}>Pour le compte de :</Text> {formData.compteDeContradictoire}
                        </Text>
                    ) : null}
                </View>
            ) : null}
        </View>
    );
};

export default PDFCoordBlock;
