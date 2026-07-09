import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { pdfStyles as styles } from '../pdfStyles';

const PDFSection = ({ id, title, children, wrap = true }) => {
  return (
    <View id={id} style={styles.section} wrap={wrap}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {children}
    </View>
  );
};

export default PDFSection;
