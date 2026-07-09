import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { pdfStyles as styles } from '../pdfStyles';
import PDFSection from './PDFSection';
import PDFFeesTableHeader from './PDFFeesTableHeader';
import PDFFeesTableRow from './PDFFeesTableRow';
import PDFFeesTableFooter from './PDFFeesTableFooter';

const PDFFeesTable = ({ id, title, data }) => {
  if (!data || !data.expenses) return null;

  return (
    <PDFSection id={id} title={title} wrap={true}>
      <View style={styles.table}>
        <PDFFeesTableHeader />
        {data.expenses.length > 0 ? (
          data.expenses.map((exp, idx) => (
            <PDFFeesTableRow key={exp.id || idx} exp={exp} index={idx + 1} />
          ))
        ) : (
          <View style={styles.tableRow} wrap={false}>
            <Text style={[styles.tableCell, { flex: 1, textAlign: 'center', fontStyle: 'italic', color: '#94a3b8' }]}>
              Aucun frais encodé
            </Text>
          </View>
        )}
        {data.expenses.length > 0 && data.totalFrais !== undefined && (
          <PDFFeesTableFooter 
            totalFraisFormatted={parseFloat(data.totalFrais).toFixed(2).replace('.', ',')} 
          />
        )}
      </View>
    </PDFSection>
  );
};

export default PDFFeesTable;
