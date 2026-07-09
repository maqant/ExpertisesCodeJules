import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { pdfStyles as styles } from '../pdfStyles';
import PDFSection from './PDFSection';

const PDFFeesTableRow = ({ exp, index }) => {
  // Règle critique: wrap={false} pour empêcher la coupure au milieu d'une ligne
  return (
    <View style={styles.tableRow} wrap={false}>
      <Text style={[styles.tableCell, { flex: 0.5, textAlign: 'center' }]}>{index}</Text>
      <Text style={[styles.tableCell, { flex: 1.5 }]}>{exp.prestataire}</Text>
      <Text style={[styles.tableCell, { flex: 1.5 }]}>{exp.type} {exp.ref ? `/ ${exp.ref}` : ''}</Text>
      <View style={[styles.tableCell, styles.descriptionCell]}>
        <Text>{exp.desc}</Text>
        {exp.annexReference && (
          <Text style={styles.annexReference}>{exp.annexReference}</Text>
        )}
      </View>
      <Text style={[styles.tableCell, { flex: 1.5 }]}>{exp.compteDeFormatted}</Text>
      <View style={[styles.tableCell, styles.amountCell]}>
        {exp.montant ? (
          <>
            <Text>{parseFloat((exp.montant || '0').toString().replace(',', '.')).toFixed(2)} €</Text>
            {exp.isFranchise ? (
              <Text style={{ fontSize: 7, color: '#6b21a8' }}>FRANCHISE</Text>
            ) : (
              <Text style={{ fontSize: 7, color: '#64748b' }}>{exp.typeMontant}</Text>
            )}
          </>
        ) : null}
      </View>
    </View>
  );
};

export default PDFFeesTableRow;
