import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';
import { DENSITY } from '../pdfStyles';

const PDFInfoBlock = ({ data, styleBlock, coordReferences }) => {
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

    // Note: references are in coord object, but sometimes passed as coordReferences if we can refactor PDFReportDocument. For now, we will check data.references as fallback.
    const references = data.references || coordReferences || [];

    return (
        <View style={containerStyle} wrap>
            {data.title ? <Text style={titleStyle} minPresenceAhead={30}>{data.title}</Text> : null}

            <Text style={{ ...textStyle, fontWeight: 'bold', marginBottom: 1 }}>
                {formData.dateSinistre || ''}{formData.dateSinistre && (formData.declareLe || formData.dateDeclaration) ? ', ' : ''}{formData.declareLe || formData.dateDeclaration || ''} {formData.declarant || ''}{' '}
                {data.paginationDocMailDeclaration ? (
                    <Text style={{ fontSize: DENSITY.fontSmall, color: '#64748b', fontStyle: 'italic', fontWeight: 'normal' }}>
                        {data.paginationDocMailDeclaration}
                    </Text>
                ) : null}
            </Text>

            {formData.nomCie ? <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Compagnie :</Text> {formData.nomCie}</Text> : null}
            
            {formData.nomContrat ? (
                <Text style={textStyle}>
                    <Text style={{ fontWeight: 'bold' }}>Contrat :</Text> {formData.nomContrat}{' '}
                    {data.paginationDocCondPart ? (
                        <Text style={{ fontSize: DENSITY.fontSmall, color: '#64748b', fontStyle: 'italic' }}>
                            {data.paginationDocCondPart}
                        </Text>
                    ) : null}
                </Text>
            ) : null}
            
            {formData.numPolice ? <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>N° Police :</Text> {formData.numPolice}</Text> : null}
            
            {formData.numeroPVPolice ? (
                <Text style={textStyle}>
                    <Text style={{ fontWeight: 'bold' }}>N° PV Police :</Text> {formData.numeroPVPolice}{' '}
                    {data.paginationDocPvPolice ? (
                        <Text style={{ fontSize: DENSITY.fontSmall, color: '#64748b', fontStyle: 'italic' }}>
                            {data.paginationDocPvPolice}
                        </Text>
                    ) : null}
                </Text>
            ) : null}
            
            {formData.numConditionsGenerales ? (
                <Text style={textStyle}>
                    <Text style={{ fontWeight: 'bold' }}>N° Cond. Générales :</Text> {formData.numConditionsGenerales}{' '}
                    {data.paginationDocCondGen ? (
                        <Text style={{ fontSize: DENSITY.fontSmall, color: '#64748b', fontStyle: 'italic' }}>
                            {data.paginationDocCondGen}
                        </Text>
                    ) : null}
                </Text>
            ) : null}
            
            {formData.numSinistreCie ? <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>N° Sinistre Cie :</Text> {formData.numSinistreCie}</Text> : null}
            
            {references && references.length > 0 ? (
                <View style={{ marginTop: 0 }}>
                    {references.map(r => (
                        <Text key={r.id} style={textStyle}>
                            <Text style={{ fontWeight: 'bold' }}>{r.nom ? `${r.nom} : ` : ''}</Text>{r.ref || ''}
                        </Text>
                    ))}
                </View>
            ) : null}
        </View>
    );
};

export default PDFInfoBlock;
