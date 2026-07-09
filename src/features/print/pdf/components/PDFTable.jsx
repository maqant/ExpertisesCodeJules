import React from 'react';
import { View } from '@react-pdf/renderer';
import { pdfStyles as styles } from '../pdfStyles';

const PDFTable = ({ children }) => {
  return <View style={styles.table}>{children}</View>;
};

export default PDFTable;
