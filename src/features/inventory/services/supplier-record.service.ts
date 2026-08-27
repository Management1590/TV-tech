// ============================================================
// Append-Only Supplier Record & Short Code Service
// ============================================================
// Manages permanent historical price records for items.
// Rules:
// 1. Price records are APPEND-ONLY. Prices are never overwritten.
// 2. Auto-generates unique 4-character short code (e.g. "A9F2").
// 3. Registers in Entity Registry for universal search by code.

import { prisma } from '@/lib/prisma';
import { SupplierRecord } from '@prisma/client';
import crypto from 'crypto';

export interface CreateSupplierRecordInput {
  itemId: string;
  supplierId?: string;
  supplierName: string;
  costPrice?: number;
  sellingPrice?: number;
  purchaseDate?: Date;
  remarks?: string;
  createdById?: string;
}

const CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude visually ambiguous chars (0,1,O,I)

/**
 * Generates a unique 4-character alphanumeric short code.
 * ~1.68 million possible combinations (32^4).
 */
export async function generateUniqueShortCode(): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    let code = '';
    const bytes = crypto.randomBytes(4);
    for (let i = 0; i < 4; i++) {
      code += CHARS[bytes[i] % CHARS.length];
    }

    // Check collision in database
    const existing = await prisma.supplierRecord.findUnique({
      where: { shortCode: code },
      select: { id: true },
    });

    if (!existing) {
      return code;
    }
    attempts++;
  }
  throw new Error('Failed to generate unique 4-character short code after 10 attempts');
}

/**
 * Creates an append-only supplier price record for an item with a unique short code.
 */
export async function createSupplierRecord(
  input: CreateSupplierRecordInput
): Promise<SupplierRecord> {
  const shortCode = await generateUniqueShortCode();

  return await prisma.$transaction(async (tx) => {
    // 1. Create Entity Registry entry
    const entity = await tx.entity.create({
      data: {
        entityTypeCode: 'SUPPLIER_RECORD',
        displayName: `${input.supplierName} - ${shortCode}`,
        searchText: `${input.supplierName} ${shortCode} ${input.remarks || ''}`.trim(),
        createdBy: input.createdById,
      },
    });

    // 2. Create append-only SupplierRecord
    const record = await tx.supplierRecord.create({
      data: {
        entityId: entity.id,
        itemId: input.itemId,
        supplierId: input.supplierId || null,
        supplierName: input.supplierName,
        costPrice: input.costPrice != null ? input.costPrice : null,
        sellingPrice: input.sellingPrice != null ? input.sellingPrice : null,
        purchaseDate: input.purchaseDate || new Date(),
        remarks: input.remarks,
        shortCode,
        createdById: input.createdById,
      },
    });

    // 3. Register in SearchIndex for O(1) short code lookup
    await tx.searchIndex.create({
      data: {
        entityId: entity.id,
        entityType: 'SUPPLIER_RECORD',
        title: input.supplierName,
        subtitle: `Code: #${shortCode}`,
        searchText: `${input.supplierName} ${shortCode}`,
        shortCode,
      },
    });

    return record;
  });
}

/**
 * Looks up a supplier price record by its 4-character short code.
 */
export async function getSupplierRecordByShortCode(code: string) {
  const cleanCode = code.trim().toUpperCase().replace(/^#/, '');

  return await prisma.supplierRecord.findUnique({
    where: { shortCode: cleanCode },
    include: {
      item: {
        select: {
          id: true,
          name: true,
          quantity: true,
          quantityMode: true,
          isOutOfStock: true,
        },
      },
      supplier: true,
    },
  });
}
