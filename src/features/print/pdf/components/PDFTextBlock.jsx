import React from 'react';
import { Text } from '@react-pdf/renderer';
import { pdfStyles as styles } from '../pdfStyles';
import PDFSection from './PDFSection';

const PDFTextBlock = ({ id, title, content }) => {
  if (!content) return null;
  return (
    <PDFSection id={id} title={title}>
      <Text style={styles.text}>{content}</Text>
    </PDFSection>
  );
};

export default PDFTextBlock;
