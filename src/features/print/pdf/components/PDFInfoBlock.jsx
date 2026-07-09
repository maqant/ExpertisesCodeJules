import React from 'react';
import { Text } from '@react-pdf/renderer';
import { pdfStyles as styles } from '../pdfStyles';
import PDFSection from './PDFSection';

const PDFInfoBlock = ({ id, title, data }) => {
  if (!data || !data.formData) return null;
  const { formData } = data;

  return (
    <PDFSection id={id} title={title}>
      <Text style={[styles.text, { fontWeight: 'bold' }]}>
        Sinistre du {formData.dateSinistre ? new Date(formData.dateSinistre).toLocaleDateString('fr-FR') : '...'}
      </Text>
      <Text style={styles.text}>Compagnie : {formData.nomCie}</Text>
      <Text style={styles.text}>Contrat : {formData.nomContrat}</Text>
      <Text style={styles.text}>N° Police : {formData.numPolice}</Text>
      {formData.numeroPVPolice && <Text style={styles.text}>N° PV Police : {formData.numeroPVPolice}</Text>}
      <Text style={styles.text}>N° Sinistre Cie : {formData.numSinistreCie}</Text>
    </PDFSection>
  );
};

export default PDFInfoBlock;
