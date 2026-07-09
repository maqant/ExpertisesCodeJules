import { StyleSheet } from '@react-pdf/renderer';

export const pdfStyles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 15,
    color: '#0f172a',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#1e293b',
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 10,
    textAlign: 'center',
  },
  text: {
    fontSize: 10,
    color: '#334155',
    lineHeight: 1.5,
    marginBottom: 5,
  },
  mutedText: {
    fontSize: 9,
    color: '#64748b',
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
    width: 'auto',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRightWidth: 0,
    borderBottomWidth: 0,
    marginTop: 10,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableHeader: {
    backgroundColor: '#f8fafc',
  },
  tableHeaderCell: {
    padding: 5,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1e293b',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  tableCell: {
    padding: 5,
    fontSize: 10,
    color: '#334155',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  descriptionCell: {
    flex: 3,
  },
  amountCell: {
    flex: 1,
    textAlign: 'right',
  },
  annexReference: {
    fontSize: 8,
    fontStyle: 'italic',
    color: '#64748b',
  },
  tocContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tocTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#0f172a',
  },
  tocDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    marginVertical: 5,
  },
  tocItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingLeft: 10,
  },
  tocLink: {
    fontSize: 11,
    color: '#2563eb',
    textDecoration: 'none',
  }
});
