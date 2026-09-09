// ============================================================
// MODERN ELECTRONICS — A4 Purchase List PDF Template
// ============================================================
// Rendered server-side using @react-pdf/renderer.
// Features official letterhead branding, item table, and ₹ formatting.

import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1f2937',
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
    borderBottomStyle: 'solid',
    paddingBottom: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  companySub: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 2,
  },
  titleBlock: {
    marginBottom: 16,
  },
  documentTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
  },
  metaText: {
    fontSize: 9,
    color: '#4b5563',
    marginTop: 2,
  },
  table: {
    width: '100%',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tableHeader: {
    backgroundColor: '#f3f4f6',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    fontWeight: 'bold',
    padding: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    padding: 8,
  },
  colNo: { width: '8%', fontWeight: 'bold' },
  colItem: { width: '42%' },
  colDesc: { width: '35%', color: '#4b5563' },
  colQty: { width: '15%', textAlign: 'center', fontWeight: 'bold' },

  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
    textAlign: 'center',
    fontSize: 8,
    color: '#9ca3af',
  },
});

export interface PurchasePdfProps {
  listTitle: string;
  listId: string;
  createdAt: string;
  notes?: string;
  items: Array<{
    name: string;
    description?: string;
    quantity: number;
  }>;
}

export const PurchasePdfTemplate: React.FC<PurchasePdfProps> = ({
  listTitle,
  listId,
  createdAt,
  notes,
  items,
}) => {
  const totalUnits = items.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <Document title={`Purchase_Requirement_${listId}`}>
      <Page size="A4" style={styles.page}>
        {/* Letterhead Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.companyName}>MODERN ELECTRONICS</Text>
            <Text style={styles.companySub}>TV Repair Shop & Spare Parts Operating System</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1f2937' }}>REQUIRED PARTS ORDER</Text>
            <Text style={styles.metaText}>Ref: #{listId.substring(0, 8).toUpperCase()}</Text>
            <Text style={styles.metaText}>Date: {createdAt}</Text>
          </View>
        </View>

        {/* Title Block */}
        <View style={styles.titleBlock}>
          <Text style={styles.documentTitle}>{listTitle}</Text>
          {notes ? <Text style={styles.metaText}>Notes: {notes}</Text> : null}
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colNo}>#</Text>
            <Text style={styles.colItem}>Required Item / Spare Part</Text>
            <Text style={styles.colDesc}>Description / Specifications</Text>
            <Text style={styles.colQty}>Quantity</Text>
          </View>

          {items.map((item, idx) => (
            <View style={styles.tableRow} key={idx}>
              <Text style={styles.colNo}>{idx + 1}</Text>
              <Text style={styles.colItem}>{item.name}</Text>
              <Text style={styles.colDesc}>{item.description || '—'}</Text>
              <Text style={styles.colQty}>{item.quantity} Units</Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={{ marginTop: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 9, color: '#6b7280' }}>Total Line Items: {items.length}</Text>
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#1e40af' }}>Total Quantity: {totalUnits} Units</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>MODERN ELECTRONICS • Authorized Spare Parts Purchase Requirement • TV Tech OS</Text>
        </View>
      </Page>
    </Document>
  );
};
