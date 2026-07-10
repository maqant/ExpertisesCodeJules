import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';
import { DENSITY, pdfStyles } from '../pdfStyles';

const PDFInfoBlock = ({ data, styleBlock, coordReferences }) => {
    if (!data) return null;

    const formData = data.formData || {};
    const adaptedStyle = adaptBlockStyle(styleBlock);

    const containerStyle = {
        marginBottom: DENSITY.blockGap,
        ...adaptedStyle,
    };

    // Note: references are in coord object, but sometimes passed as coordReferences if we can refactor PDFReportDocument. For now, we will check data.references as fallback.
    const references = data.references || coordReferences || [];

    return (
        <View style={containerStyle} wrap>
            {data.title ? (
                <Text style={pdfStyles.sectionTitle} minPresenceAhead={30}>
                    {data.title}
                </Text>
            ) : null}

            <Text style={{ ...pdfStyles.bodyText, fontWeight: 'bold' }}>
                {formData.dateSinistre || ''}{formData.dateSinistre && (formData.declareLe || formData.dateDeclaration) ? ', ' : ''}{formData.declareLe || formData.dateDeclaration || ''} {formData.declarant || ''}{' '}
                {data.paginationDocMailDeclaration ? (
                    <Text style={pdfStyles.mutedText}>
                        {data.paginationDocMailDeclaration}
                    </Text>
                ) : null}
            </Text>

            {formData.nomCie ? (
                <Text style={pdfStyles.bodyText}>
                    <Text style={pdfStyles.bodyLabel}>Compagnie :</Text> {formData.nomCie}
                </Text>
            ) : null}
            
            {formData.nomContrat ? (
                <Text style={pdfStyles.bodyText}>
                    <Text style={pdfStyles.bodyLabel}>Contrat :</Text> {formData.nomContrat}{' '}
                    {data.paginationDocCondPart ? (
                        <Text style={pdfStyles.mutedText}>
                            {data.paginationDocCondPart}
                        </Text>
                    ) : null}
                </Text>
            ) : null}
            
            {formData.numPolice ? (
                <Text style={pdfStyles.bodyText}>
                    <Text style={pdfStyles.bodyLabel}>N° Police :</Text> {formData.numPolice}
                </Text>
            ) : null}
            
            {formData.numeroPVPolice ? (
                <Text style={pdfStyles.bodyText}>
                    <Text style={pdfStyles.bodyLabel}>N° PV Police :</Text> {formData.numeroPVPolice}{' '}
                    {data.paginationDocPvPolice ? (
                        <Text style={pdfStyles.mutedText}>
                            {data.paginationDocPvPolice}
                        </Text>
                    ) : null}
                </Text>
            ) : null}
            
            {formData.numConditionsGenerales ? (
                <Text style={pdfStyles.bodyText}>
                    <Text style={pdfStyles.bodyLabel}>N° Cond. Générales :</Text> {formData.numConditionsGenerales}{' '}
                    {data.paginationDocCondGen ? (
                        <Text style={pdfStyles.mutedText}>
                            {data.paginationDocCondGen}
                        </Text>
                    ) : null}
                </Text>
            ) : null}
            
            {formData.numSinistreCie ? (
                <Text style={pdfStyles.bodyText}>
                    <Text style={pdfStyles.bodyLabel}>N° Sinistre Cie :</Text> {formData.numSinistreCie}
                </Text>
            ) : null}
            
            {references && references.length > 0 ? (
                <View style={{ marginTop: 2 }}>
                    {references.map(r => (
                        <Text key={r.id} style={pdfStyles.bodyText}>
                            <Text style={pdfStyles.bodyLabel}>{r.nom ? `${r.nom} : ` : ''}</Text>{r.ref || ''}
                        </Text>
                    ))}
                </View>
            ) : null}
        </View>
    );
};

export default PDFInfoBlock;
