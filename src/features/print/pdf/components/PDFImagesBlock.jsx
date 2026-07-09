import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';
import { pdfStyles as styles } from '../pdfStyles';
import PDFSection from './PDFSection';

const PDFImagesBlock = ({ id, title, data }) => {
  if (!data || !data.occupantsWithPhotos || data.occupantsWithPhotos.length === 0) return null;

  return (
    <PDFSection id={id} title={title}>
      {data.occupantsWithPhotos.map(occ => (
        <View key={occ.id} style={{ marginBottom: 10 }} wrap={false}>
          <Text style={styles.text}>Photos de {occ.nom}</Text>
          {occ.annexReference && <Text style={styles.annexReference}>{occ.annexReference}</Text>}
          {occ.resolvedImages && occ.resolvedImages.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
              {occ.resolvedImages.map((imgUrl, i) => (
                <Image key={i} src={imgUrl} style={{ width: 100, height: 100, objectFit: 'cover' }} />
              ))}
            </View>
          )}
        </View>
      ))}
    </PDFSection>
  );
};

export default PDFImagesBlock;
