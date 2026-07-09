import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { pdfStyles as styles } from '../pdfStyles';

const PDFFeesTableHeader = () => {
  return (
    <View style={[styles.tableRow, styles.tableHeader]} wrap={false}>
      <Text style={[styles.tableHeaderCell, { flex: 0.5, textAlign: 'center' }]}>#</Text>
      <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Prestataire</Text>
      <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Type</Text>
      <Text style={[styles.tableHeaderCell, styles.descriptionCell]}>Description</Text>
      <Text style={[styles.tableHeaderCell, { flex: 1.5 }]}>Pour le compte de</Text>
      <Text style={[styles.tableHeaderCell, styles.amountCell]}>Montant</Text>
    </View>
  );
};

export default PDFFeesTableHeader;
