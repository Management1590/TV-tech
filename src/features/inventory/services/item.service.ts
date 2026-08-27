// ============================================================
// Item Domain Entity Service
// ============================================================
// Manages folder-INDEPENDENT Item entities.
// URL: /inventory/items/[itemId]
// On Creation: Registers in Entity Registry + Creates FolderItem link to target folder.

import { prisma } from '@/lib/prisma';
import { Item, QuantityMode } from '@prisma/client';
import { linkItemToFolder } from './folder-item.service';
import { ensureEntityType } from '@/lib/ensure-entity-types';

export interface CreateItemInput {
  name: string;
  folderId: string; // Initial folder to link item to
  location?: string;
  quantityMode?: QuantityMode;
  quantity?: number;
  isOutOfStock?: boolean;
  notes?: string;
  createdById?: string;
}

export interface UpdateItemInput {
  name?: string;
  location?: string;
  quantityMode?: QuantityMode;
  notes?: string;
}

/**
 * Creates an independent Item domain entity, registers it in the Entity Registry,
 * initializes ItemStockSettings, and auto-links it to the specified initial folder.
 */
export async function createItem(input: CreateItemInput): Promise<Item> {
  const quantityMode = input.quantityMode || QuantityMode.NUMERIC;
  const initialQuantity = quantityMode === QuantityMode.NUMERIC ? (input.quantity ?? 0) : null;
  const isOutOfStock = quantityMode === QuantityMode.UNKNOWN ? (input.isOutOfStock || false) : (initialQuantity === 0);

  // 1. Transaction: Create Entity + Item + ItemStockSettings
  const item = await prisma.$transaction(async (tx) => {
    await ensureEntityType('ITEM', tx);
    const entity = await tx.entity.create({
      data: {
        entityTypeCode: 'ITEM',
        displayName: input.name,
        searchText: `${input.name} ${input.location || ''} ${input.notes || ''}`.trim(),
        createdBy: input.createdById,
      },
    });

    const newItem = await tx.item.create({
      data: {
        entityId: entity.id,
        name: input.name,
        location: input.location,
        quantityMode,
        quantity: initialQuantity,
        isOutOfStock,
        notes: input.notes,
        createdById: input.createdById,
      },
    });

    // Initialize stock settings analytics record
    await tx.itemStockSettings.create({
      data: {
        itemId: newItem.id,
        minimumStock: 0,
        needToPurchase: false,
      },
    });

    return newItem;
  }, { timeout: 15000, maxWait: 10000 });

  // 2. Link item to target folder via FolderItem junction
  await linkItemToFolder(input.folderId, item.id, input.createdById);

  return item;
}

/**
 * Fetches folder-independent Item details including stock settings and linked folders.
 */
export async function getItemById(itemId: string) {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    include: {
      entity: true,
      stockSettings: true,
      folderItems: {
        include: {
          folder: {
            select: { id: true, name: true, materializedPath: true },
          },
        },
      },
      supplierRecords: {
        orderBy: { createdAt: 'desc' },
        include: { supplier: true },
      },
    },
  });

  if (!item) {
    throw new Error(`Item ${itemId} not found`);
  }

  return item;
}

/**
 * Updates Item fields (name, location, notes). Does NOT alter folder links.
 */
export async function updateItem(itemId: string, input: UpdateItemInput): Promise<Item> {
  const updatedItem = await prisma.item.update({
    where: { id: itemId },
    data: {
      name: input.name,
      location: input.location,
      quantityMode: input.quantityMode,
      notes: input.notes,
    },
  });

  // Update display name in Entity registry
  if (input.name) {
    await prisma.entity.update({
      where: { id: updatedItem.entityId },
      data: { displayName: input.name },
    });
  }

  return updatedItem;
}

/**
 * Destructively deletes an Item entity, cascading to FolderItems, SupplierRecords, StockMovements, etc.
 * Admin confirmation required in UI.
 */
export async function deleteItem(itemId: string): Promise<void> {
  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, entityId: true },
  });

  if (!item) return;

  await prisma.$transaction(async (tx) => {
    // Delete entity record (cascades to Item)
    await tx.entity.delete({
      where: { id: item.entityId },
    });
  });
}
