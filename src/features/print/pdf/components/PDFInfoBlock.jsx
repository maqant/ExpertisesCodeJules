import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { adaptBlockStyle } from '../pdfStyleAdapter';

const PDFInfoBlock = ({ data, styleBlock }) => {
    if (!data) return null;

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

            <Text style={{ ...textStyle, fontWeight: 'bold', marginBottom: 4 }}>
                {data.sinistreDu}, {data.declareLe} {data.declarant}{' '}
                {data.declarationAnnexe && (
                    <Text style={{ fontSize: (adaptedStyle.fontSize || 9) * 0.8, color: '#64748b', fontStyle: 'italic', fontWeight: 'normal' }}>
                        {data.declarationAnnexe}
                    </Text>
                )}
            </Text>

            <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>Compagnie :</Text> {data.nomCie}</Text>
            
            <Text style={textStyle}>
                <Text style={{ fontWeight: 'bold' }}>Contrat :</Text> {data.nomContrat}{' '}
                {data.condPartAnnexe && (
                    <Text style={{ fontSize: (adaptedStyle.fontSize || 9) * 0.8, color: '#64748b', fontStyle: 'italic' }}>
                        {data.condPartAnnexe}
                    </Text>
                )}
            </Text>
            
            <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>N° Police :</Text> {data.numPolice}</Text>
            
            {data.numeroPVPolice && (
                <Text style={textStyle}>
                    <Text style={{ fontWeight: 'bold' }}>N° PV Police :</Text> {data.numeroPVPolice}{' '}
                    {data.pvPoliceAnnexe && (
                        <Text style={{ fontSize: (adaptedStyle.fontSize || 9) * 0.8, color: '#64748b', fontStyle: 'italic' }}>
                            {data.pvPoliceAnnexe}
                        </Text>
                    )}
                </Text>
            )}
            
            {data.numConditionsGenerales && (
                <Text style={textStyle}>
                    <Text style={{ fontWeight: 'bold' }}>N° Cond. Générales :</Text> {data.numConditionsGenerales}{' '}
                    {data.condGenAnnexe && (
                        <Text style={{ fontSize: (adaptedStyle.fontSize || 9) * 0.8, color: '#64748b', fontStyle: 'italic' }}>
                            {data.condGenAnnexe}
                        </Text>
                    )}
                </Text>
            )}
            
            <Text style={textStyle}><Text style={{ fontWeight: 'bold' }}>N° Sinistre Cie :</Text> {data.numSinistreCie}</Text>
            
            {data.references && data.references.length > 0 && (
                <View style={{ marginTop: 2 }}>
                    {data.references.map(r => (
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
