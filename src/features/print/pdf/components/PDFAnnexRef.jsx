import React from 'react';
import { Text, Link } from '@react-pdf/renderer';
import { pdfStyles } from '../pdfStyles';

/**
 * Composant de référence d'annexe pour React-PDF.
 * Si data est une string, il l'affiche simplement.
 * Si data est un objet avec id et text, il l'affiche comme un lien cliquable.
 */
const PDFAnnexRef = ({ data, style }) => {
    if (!data) return null;

    const text = typeof data === 'string' ? data : data.text;
    const id = typeof data === 'string' ? null : data.id;
    
    // Fallback style au cas où aucun n'est passé
    const baseStyle = style || pdfStyles.mutedText;

    if (id) {
        return (
            <Link src={`https://expertises.local/annex/${id}`} style={{ textDecoration: 'none' }}>
                <Text style={baseStyle}>
                    {text}
                </Text>
            </Link>
        );
    }

    return (
        <Text style={baseStyle}>
            {text}
        </Text>
    );
};

export default PDFAnnexRef;
