import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';

const PDFInfoBlock = ({ data, styleBlock, coordReferences }) => {
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

    // Note: references are in coord object, but sometimes passed as coordReferences if we can refactor PDFReportDocument. For now, we will check data.references as fallback.
    const references = data.references || coordReferences || [];

    return (
        <View style={containerStyle} wrap={false}>
            {data.title && (
                <Text style={titleStyle}>{data.title}</Text>
            )}

            <Text style={{ ...textStyle, fontWeight: 'bold', marginBottom: 4 }}>
                {formData.dateSinistre}, {formData.declareLe || formData.dateDeclaration} {formData.declarant}{' '}
                {data.paginationDocMailDeclaration && (
                    <Text style={{ fontSize: (adaptedStyle.fontSize || 9) * 0.8, color: '#64748b', fontStyle: 'italic', fontWeight: 'normal' }}>
                        {data.paginationDocMailDeclaration}
                    </Text>
                )}
            </Text>

            {formData.nomCie && <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Compagnie :</Text> {formData.nomCie}</Text>}
            
            {formData.nomContrat && (
                <Text style={textStyle}>
                    <Text style={{ fontWeight: 'bold' }}>Contrat :</Text> {formData.nomContrat}{' '}
                    {data.paginationDocCondPart && (
                        <Text style={{ fontSize: (adaptedStyle.fontSize || 9) * 0.8, color: '#64748b', fontStyle: 'italic' }}>
                            {data.paginationDocCondPart}
                        </Text>
                    )}
                </Text>
            )}
            
            {formData.numPolice && <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>N° Police :</Text> {formData.numPolice}</Text>}
            
            {formData.numeroPVPolice && (
                <Text style={textStyle}>
                    <Text style={{ fontWeight: 'bold' }}>N° PV Police :</Text> {formData.numeroPVPolice}{' '}
                    {data.paginationDocPvPolice && (
                        <Text style={{ fontSize: (adaptedStyle.fontSize || 9) * 0.8, color: '#64748b', fontStyle: 'italic' }}>
                            {data.paginationDocPvPolice}
                        </Text>
                    )}
                </Text>
            )}
            
            {formData.numConditionsGenerales && (
                <Text style={textStyle}>
                    <Text style={{ fontWeight: 'bold' }}>N° Cond. Générales :</Text> {formData.numConditionsGenerales}{' '}
                    {data.paginationDocCondGen && (
                        <Text style={{ fontSize: (adaptedStyle.fontSize || 9) * 0.8, color: '#64748b', fontStyle: 'italic' }}>
                            {data.paginationDocCondGen}
                        </Text>
                    )}
                </Text>
            )}
            
            {formData.numSinistreCie && <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>N° Sinistre Cie :</Text> {formData.numSinistreCie}</Text>}
            
            {references && references.length > 0 && (
                <View style={{ marginTop: 2 }}>
                    {references.map(r => (
                        <Text key={r.id} style={textStyle}>
                            <Text style={{ fontWeight: 'bold' }}>{r.nom} {r.nom ? ':' : ''}</Text> {r.ref}
                        </Text>
                    ))}
                </View>
            )}
        </View>
    );
};

export default PDFInfoBlock;
