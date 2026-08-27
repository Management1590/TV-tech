// ============================================================
// Normalized Supplier Entity Service
// ============================================================
// Suppliers are first-class entities with their own table (`suppliers`).
// Allows deduplication of supplier records across multiple items.

import { prisma } from '@/lib/prisma';
import { Supplier } from '@prisma/client';

export interface CreateSupplierInput {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export interface UpdateSupplierInput {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

export async function createSupplier(input: CreateSupplierInput): Promise<Supplier> {
  return await prisma.$transaction(async (tx) => {
    const entity = await tx.entity.create({
      data: {
        entityTypeCode: 'SUPPLIER',
        displayName: input.name,
        searchText: `${input.name} ${input.phone || ''} ${input.email || ''}`.trim(),
      },
    });

    return await tx.supplier.create({
      data: {
        entityId: entity.id,
        name: input.name,
        phone: input.phone,
        email: input.email,
        address: input.address,
        notes: input.notes,
      },
    });
  });
}

export async function getSuppliers(search?: string): Promise<Supplier[]> {
  return await prisma.supplier.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { name: 'asc' },
  });
}

export async function getSupplierById(supplierId: string): Promise<Supplier | null> {
  return await prisma.supplier.findUnique({
    where: { id: supplierId },
    include: {
      supplierRecords: {
        orderBy: { purchaseDate: 'desc' },
        include: { item: { select: { id: true, name: true } } },
      },
    },
  });
}
