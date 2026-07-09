import React from 'react';
import { Text } from '@react-pdf/renderer';
import { pdfStyles as styles } from '../pdfStyles';
import PDFSection from './PDFSection';

const PDFAnnexesBlock = ({ id, title, data }) => {
  if (!data) return null;
  // En attendant une structure d'annexes standard
  return (
    <PDFSection id={id} title={title}>
      <Text style={styles.text}>Contenu des annexes...</Text>
    </PDFSection>
  );
};

export default PDFAnnexesBlock;
