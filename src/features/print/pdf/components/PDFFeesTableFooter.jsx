import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { pdfStyles as styles } from '../pdfStyles';

const PDFFeesTableFooter = ({ totalFraisFormatted }) => {
  return (
    <View style={styles.tableRow} wrap={false}>
      <Text style={[styles.tableCell, { flex: 8, textAlign: 'right', fontWeight: 'bold' }]}>
        TOTAL DE LA RÉCLAMATION
      </Text>
      <Text style={[styles.tableCell, styles.amountCell, { fontWeight: 'bold' }]}>
        {totalFraisFormatted} €
      </Text>
    </View>
  );
};

export default PDFFeesTableFooter;
