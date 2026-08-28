// ============================================================
// TV Tech OS — Item CRUD Server Actions
// ============================================================

'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { matchesOrderedPattern, calculateMatchScore } from '@/features/search/services/search.service';
import { cloudinary } from '@/lib/cloudinary';
import { createMediaAttachment } from '@/features/media/services/media.service';
import { captureDailySnapshot } from '@/features/analytics/services/inventory-analytics.service';
import { MediaType, StorageProvider } from '@prisma/client';

function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I,O,0,1 to avoid confusion
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createItemAction(data: {
  name: string;
  folderId: string;
  location?: string;
  notes?: string;
  quantityMode?: 'NUMERIC' | 'UNKNOWN';
  quantity?: number;
  supplierName?: string;
  costPrice?: number;
  sellingPrice?: number;
  parameterValues?: Array<{
    parameterDefinitionId: string;
    valueText?: string | null;
    valueNumber?: number | null;
    valueBoolean?: boolean | null;
    valueDate?: string | null;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, error: 'Permission denied. Admin access required.' };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Entity
      const entity = await tx.entity.create({
        data: {
          entityType: {
            connectOrCreate: {
              where: { code: 'ITEM' },
              create: {
                code: 'ITEM',
                label: 'Spare Part Item',
                description: 'Domain item entity for TV spare parts',
                isSystem: true,
              },
            },
          },
          displayName: data.name,
        },
      });

      // 2. Create Item
      const item = await tx.item.create({
        data: {
          entityId: entity.id,
          name: data.name,
          location: data.location || null,
          notes: data.notes || null,
          quantityMode: data.quantityMode || 'UNKNOWN',
          quantity: data.quantityMode === 'NUMERIC' ? (data.quantity ?? 0) : null,
        },
      });

      // 3. Link to folder (FolderItem junction)
      await tx.folderItem.create({
        data: {
          folderId: data.folderId,
          itemId: item.id,
        },
      });

      // 4. Update folder's item count
      await tx.folder.update({
        where: { id: data.folderId },
        data: { itemCount: { increment: 1 } },
      });

      // 5. Create ItemStockSettings
      await tx.itemStockSettings.create({
        data: { itemId: item.id },
      });

      // 5.5. Save dynamic parameter values if provided
      if (data.parameterValues && data.parameterValues.length > 0) {
        for (const pv of data.parameterValues) {
          const hasValue =
            (pv.valueText !== undefined && pv.valueText !== null && pv.valueText !== '') ||
            (pv.valueNumber !== undefined && pv.valueNumber !== null) ||
            (pv.valueBoolean !== undefined && pv.valueBoolean !== null) ||
            (pv.valueDate !== undefined && pv.valueDate !== null && pv.valueDate !== '');

          if (hasValue) {
            await tx.itemParameterValue.create({
              data: {
                itemId: item.id,
                parameterDefinitionId: pv.parameterDefinitionId,
                valueText: pv.valueText || null,
                valueNumber: pv.valueNumber !== undefined && pv.valueNumber !== null ? pv.valueNumber : null,
                valueBoolean: pv.valueBoolean !== undefined && pv.valueBoolean !== null ? pv.valueBoolean : null,
                valueDate: pv.valueDate ? new Date(pv.valueDate) : null,
              },
            });
          }
        }
      }

      // 6. If supplier info provided, create SupplierRecord
      if (data.supplierName) {
        // Generate unique short code
        let shortCode = generateShortCode();
        let attempts = 0;
        while (attempts < 10) {
          const exists = await tx.supplierRecord.findUnique({ where: { shortCode } });
          if (!exists) break;
          shortCode = generateShortCode();
          attempts++;
        }

        const srEntity = await tx.entity.create({
          data: { entityType: { connect: { code: 'SUPPLIER_RECORD' } }, displayName: `${data.supplierName} - ${data.name}` },
        });

        await tx.supplierRecord.create({
          data: {
            entityId: srEntity.id,
            itemId: item.id,
            supplierName: data.supplierName,
            costPrice: data.costPrice ?? null,
            sellingPrice: data.sellingPrice ?? null,
            shortCode,
            createdById: user.id,
          },
        });
      }

      // 7. Upsert search index
      await tx.searchIndex.create({
        data: {
          entityId: entity.id,
          entityType: 'ITEM',
          title: data.name,
          subtitle: data.location || null,
          searchText: [data.name, data.location, data.notes].filter(Boolean).join(' '),
        },
      });

      // 8. Audit log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CREATE',
          entityType: 'ITEM',
          entityId: entity.id,
          changes: { name: data.name, folderId: data.folderId },
        },
      });

      return item;
    });

    // Capture updated inventory count & cost snapshot
    try {
      await captureDailySnapshot();
    } catch (e) {
      console.error('[ANALYTICS SNAPSHOT ERROR]', e);
    }

    revalidatePath('/inventory');
    revalidatePath('/');
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Create item error:', error);
    return { success: false, error: error.message || 'Failed to create item.' };
  }
}

export async function editItemAction(data: {
  itemId: string;
  name: string;
  location?: string | null;
  notes?: string | null;
  quantityMode?: 'UNKNOWN' | 'NUMERIC';
  quantity?: number | null;
  parameterValues?: Array<{
    parameterDefinitionId: string;
    valueText?: string | null;
    valueNumber?: number | null;
    valueBoolean?: boolean | null;
    valueDate?: string | null;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, error: 'Permission denied. Admin access required.' };
  }

  try {
    const item = await prisma.item.findUnique({
      where: { id: data.itemId },
      include: { entity: true },
    });

    if (!item) return { success: false, error: 'Item not found.' };

    await prisma.$transaction(async (tx) => {
      // 1. Update Item core fields
      const isOutOfStock = data.quantityMode === 'NUMERIC' && (data.quantity ?? 0) <= 0;

      await tx.item.update({
        where: { id: data.itemId },
        data: {
          name: data.name,
          location: data.location || null,
          notes: data.notes || null,
          quantityMode: data.quantityMode || 'UNKNOWN',
          quantity: data.quantityMode === 'NUMERIC' ? (data.quantity ?? 0) : null,
          isOutOfStock,
        },
      });

      // 2. Update Entity Display Name
      await tx.entity.update({
        where: { id: item.entityId },
        data: { displayName: data.name },
      });

      // 3. Update Search Index
      await tx.searchIndex.updateMany({
        where: { entityId: item.entityId },
        data: {
          title: data.name,
          subtitle: data.location || null,
          searchText: [data.name, data.location, data.notes].filter(Boolean).join(' '),
        },
      });

      // 4. Update dynamic parameter values if provided
      if (data.parameterValues) {
        for (const pv of data.parameterValues) {
          const hasValue =
            (pv.valueText !== undefined && pv.valueText !== null && pv.valueText !== '') ||
            (pv.valueNumber !== undefined && pv.valueNumber !== null) ||
            (pv.valueBoolean !== undefined && pv.valueBoolean !== null) ||
            (pv.valueDate !== undefined && pv.valueDate !== null && pv.valueDate !== '');

          if (hasValue) {
            await tx.itemParameterValue.upsert({
              where: {
                itemId_parameterDefinitionId: {
                  itemId: data.itemId,
                  parameterDefinitionId: pv.parameterDefinitionId,
                },
              },
              create: {
                itemId: data.itemId,
                parameterDefinitionId: pv.parameterDefinitionId,
                valueText: pv.valueText || null,
                valueNumber: pv.valueNumber !== undefined && pv.valueNumber !== null ? pv.valueNumber : null,
                valueBoolean: pv.valueBoolean !== undefined && pv.valueBoolean !== null ? pv.valueBoolean : null,
                valueDate: pv.valueDate ? new Date(pv.valueDate) : null,
              },
              update: {
                valueText: pv.valueText || null,
                valueNumber: pv.valueNumber !== undefined && pv.valueNumber !== null ? pv.valueNumber : null,
                valueBoolean: pv.valueBoolean !== undefined && pv.valueBoolean !== null ? pv.valueBoolean : null,
                valueDate: pv.valueDate ? new Date(pv.valueDate) : null,
              },
            });
          } else {
            await tx.itemParameterValue.deleteMany({
              where: {
                itemId: data.itemId,
                parameterDefinitionId: pv.parameterDefinitionId,
              },
            });
          }
        }
      }

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          entityType: 'ITEM',
          entityId: item.entityId,
          changes: {
            name: data.name,
            location: data.location,
            quantityMode: data.quantityMode,
            quantity: data.quantity,
          },
        },
      });
    });

    revalidatePath(`/inventory/items/${data.itemId}`);
    revalidatePath('/inventory');
    revalidatePath('/inventory/folders');
    return { success: true };
  } catch (error: any) {
    console.error('Edit item error:', error);
    return { success: false, error: error.message || 'Failed to update item.' };
  }
}

export async function deleteItemAction(itemId: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, error: 'Permission denied.' };
  }

  try {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: { folderItems: true },
    });

    if (!item) return { success: false, error: 'Item not found.' };

    await prisma.$transaction(async (tx) => {
      // Decrement folder item counts
      for (const fi of item.folderItems) {
        await tx.folder.update({
          where: { id: fi.folderId },
          data: { itemCount: { decrement: 1 } },
        });
      }

      // Delete via Entity cascade
      await tx.entity.delete({ where: { id: item.entityId } });

      // Audit
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'DELETE',
          entityType: 'ITEM',
          entityId: item.entityId,
          changes: { name: item.name },
        },
      });
    });

    // Update inventory cost & count snapshot
    try {
      await captureDailySnapshot();
    } catch (e) {
      console.error('[ANALYTICS SNAPSHOT ERROR]', e);
    }

    revalidatePath('/inventory');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete item.' };
  }
}

export async function linkItemToFolderAction(itemId: string, folderId: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, error: 'Permission denied.' };
  }

  try {
    // Check if already linked
    const existing = await prisma.folderItem.findUnique({
      where: { folderId_itemId: { folderId, itemId } },
    });

    if (existing) return { success: false, error: 'Item is already in this folder.' };

    await prisma.$transaction(async (tx) => {
      await tx.folderItem.create({
        data: { folderId, itemId },
      });

      await tx.folder.update({
        where: { id: folderId },
        data: { itemCount: { increment: 1 } },
      });

      const item = await tx.item.findUnique({ where: { id: itemId }, select: { entityId: true } });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'LINK',
          entityType: 'ITEM',
          entityId: item?.entityId,
          changes: { folderId },
        },
      });
    });

    revalidatePath('/inventory');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to link item.' };
  }
}

export async function unlinkItemFromFolderAction(itemId: string, folderId: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, error: 'Permission denied.' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.folderItem.delete({
        where: { folderId_itemId: { folderId, itemId } },
      });

      await tx.folder.update({
        where: { id: folderId },
        data: { itemCount: { decrement: 1 } },
      });

      // Check if folder is now empty and reset containsItems
      const updatedFolder = await tx.folder.findUnique({ where: { id: folderId }, select: { itemCount: true } });
      if (updatedFolder && updatedFolder.itemCount <= 0) {
        await tx.folder.update({ where: { id: folderId }, data: { containsItems: false, itemCount: 0 } });
      }

      const item = await tx.item.findUnique({ where: { id: itemId }, select: { entityId: true } });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'UNLINK',
          entityType: 'ITEM',
          entityId: item?.entityId,
          changes: { folderId },
        },
      });
    });

    revalidatePath('/inventory');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to unlink item.' };
  }
}

export async function recordStockMovementAction(data: {
  itemId: string;
  movementType: 'PURCHASE' | 'SALE' | 'RETURN' | 'INTERNAL_USE' | 'ADJUSTMENT' | 'DAMAGE' | 'LOST';
  quantityChange: number;
  notes?: string;
  targetQuantityMode?: 'NUMERIC' | 'UNKNOWN';
  resultingNumericQuantity?: number;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Authentication required.' };

  if (data.movementType === 'PURCHASE' && user.role !== 'ADMIN') {
    return { success: false, error: 'Permission denied. Only Admins can record purchases.' };
  }

  try {
    const item = await prisma.item.findUnique({
      where: { id: data.itemId },
      select: { id: true, quantity: true, quantityMode: true, entityId: true },
    });

    if (!item) return { success: false, error: 'Item not found.' };

    const effectiveMode = data.targetQuantityMode || item.quantityMode;
    const previousQuantity = item.quantity ?? (item.quantityMode === 'NUMERIC' ? 0 : 1);
    
    // Enforce correct sign based on movement type
    const NEGATIVE_MOVEMENTS = ['SALE', 'DAMAGE', 'LOST', 'INTERNAL_USE'];
    let adjustedChange = data.quantityChange;
    if (NEGATIVE_MOVEMENTS.includes(data.movementType)) {
      adjustedChange = -Math.abs(data.quantityChange);
    } else if (data.movementType === 'PURCHASE' || data.movementType === 'RETURN') {
      adjustedChange = Math.abs(data.quantityChange);
    }

    let nextCalculatedQty: number | null = null;
    if (effectiveMode === 'NUMERIC') {
      if (data.resultingNumericQuantity !== undefined) {
        nextCalculatedQty = Math.max(0, data.resultingNumericQuantity);
      } else {
        nextCalculatedQty = Math.max(0, previousQuantity + adjustedChange);
      }
    }

    // Fetch active price codes for point-in-time transaction snapshot
    const activePriceRec = await prisma.supplierRecord.findFirst({
      where: { itemId: data.itemId },
      orderBy: { createdAt: 'desc' },
      select: { costPrice: true, sellingPrice: true },
    });

    const unitCost = activePriceRec?.costPrice ? Number(activePriceRec.costPrice) : null;
    const unitPrice = activePriceRec?.sellingPrice ? Number(activePriceRec.sellingPrice) : null;
    const totalAmount = data.movementType === 'SALE'
      ? (unitPrice !== null ? Math.abs(adjustedChange) * unitPrice : null)
      : (unitCost !== null ? Math.abs(adjustedChange) * unitCost : null);

    await prisma.$transaction(async (tx) => {
      // Create movement record with immutable point-in-time unit pricing
      await tx.stockMovement.create({
        data: {
          itemId: data.itemId,
          movementType: data.movementType,
          quantityChange: adjustedChange,
          previousQuantity,
          newQuantity: nextCalculatedQty !== null ? nextCalculatedQty : (effectiveMode === 'NUMERIC' ? Math.max(0, previousQuantity + adjustedChange) : 1),
          unitCost: unitCost !== null ? unitCost : undefined,
          unitPrice: unitPrice !== null ? unitPrice : undefined,
          totalAmount: totalAmount !== null ? totalAmount : undefined,
          notes: data.notes || null,
          performedById: user.id,
        },
      });

      // Update item quantity and quantityMode
      if (effectiveMode === 'NUMERIC') {
        const finalNumericQty = nextCalculatedQty ?? Math.max(0, previousQuantity + adjustedChange);
        await tx.item.update({
          where: { id: data.itemId },
          data: {
            quantityMode: 'NUMERIC',
            quantity: finalNumericQty,
            isOutOfStock: finalNumericQty <= 0,
          },
        });
      } else {
        // UNKNOWN / Unlimited quantityMode:
        // When recording purchase/return, bring item back in stock
        await tx.item.update({
          where: { id: data.itemId },
          data: {
            quantityMode: 'UNKNOWN',
            quantity: null,
            isOutOfStock: false,
          },
        });
      }

      // Update stock settings
      const absQty = Math.abs(data.quantityChange);
      const isSale = data.movementType === 'SALE';
      const isPurchase = data.movementType === 'PURCHASE';

      if (isSale || isPurchase) {
        await tx.itemStockSettings.upsert({
          where: { itemId: data.itemId },
          create: {
            itemId: data.itemId,
            totalSold: isSale ? absQty : 0,
            totalPurchased: isPurchase ? absQty : 0,
            lastSoldAt: isSale ? new Date() : undefined,
            lastPurchasedAt: isPurchase ? new Date() : undefined,
          },
          update: {
            totalSold: isSale ? { increment: absQty } : undefined,
            totalPurchased: isPurchase ? { increment: absQty } : undefined,
            lastSoldAt: isSale ? new Date() : undefined,
            lastPurchasedAt: isPurchase ? new Date() : undefined,
          },
        });
      }

      // Keep only the most recent 15 stock movements for this item in database
      const oldMovements = await tx.stockMovement.findMany({
        where: { itemId: data.itemId },
        orderBy: { createdAt: 'desc' },
        skip: 15,
        select: { id: true },
      });

      if (oldMovements.length > 0) {
        await tx.stockMovement.deleteMany({
          where: { id: { in: oldMovements.map((m) => m.id) } },
        });
      }

      // Audit
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          entityType: 'ITEM',
          entityId: item.entityId,
          changes: {
            movementType: data.movementType,
            quantityChange: adjustedChange,
            previousQuantity,
            newQuantity: nextCalculatedQty ?? 0,
            quantityMode: effectiveMode,
            unitPrice,
            unitCost,
          },
        },
      });
    });

    // Update today's financial snapshot immediately
    try {
      await captureDailySnapshot();
    } catch (e) {
      console.error('[ANALYTICS SNAPSHOT ERROR]', e);
    }

    revalidatePath(`/inventory/items/${data.itemId}`);
    revalidatePath('/inventory');
    revalidatePath('/inventory/folders');
    revalidatePath('/');
    return {
      success: true,
      previousQuantity,
      newQuantity: nextCalculatedQty ?? (effectiveMode === 'NUMERIC' ? 0 : 1),
      quantityChange: adjustedChange,
      movementType: data.movementType,
      quantityMode: effectiveMode,
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to record stock movement.' };
  }
}

export async function markItemSoldOutAction(itemId: string, notes?: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Authentication required.' };

  try {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        quantity: true,
        quantityMode: true,
        entityId: true,
        supplierRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { costPrice: true, sellingPrice: true },
        },
      },
    });

    if (!item) return { success: false, error: 'Item not found.' };

    const isNumeric = item.quantityMode === 'NUMERIC';
    const previousQuantity = item.quantity ?? (isNumeric ? 0 : 1);
    const newQuantity = 0;
    const quantityChange = isNumeric ? -previousQuantity : -1;

    const activePriceRec = item.supplierRecords[0];
    const unitCost = activePriceRec?.costPrice ? Number(activePriceRec.costPrice) : null;
    const unitPrice = activePriceRec?.sellingPrice ? Number(activePriceRec.sellingPrice) : null;
    const totalAmount = unitPrice !== null ? Math.abs(quantityChange) * unitPrice : null;

    await prisma.$transaction(async (tx) => {
      // Create movement record
      await tx.stockMovement.create({
        data: {
          itemId,
          movementType: 'SALE',
          quantityChange: quantityChange !== 0 ? quantityChange : -1,
          previousQuantity,
          newQuantity: 0,
          unitCost: unitCost !== null ? unitCost : undefined,
          unitPrice: unitPrice !== null ? unitPrice : undefined,
          totalAmount: totalAmount !== null ? totalAmount : undefined,
          notes: notes || 'Marked as Sold Out (Out of Stock)',
          performedById: user.id,
        },
      });

      // Update stock settings totalSold
      await tx.itemStockSettings.upsert({
        where: { itemId },
        create: {
          itemId,
          totalSold: Math.max(1, Math.abs(quantityChange)),
          lastSoldAt: new Date(),
        },
        update: {
          totalSold: { increment: Math.max(1, Math.abs(quantityChange)) },
          lastSoldAt: new Date(),
        },
      });

      // Update item to out of stock
      await tx.item.update({
        where: { id: itemId },
        data: {
          quantity: isNumeric ? 0 : null,
          isOutOfStock: true,
        },
      });

      // Keep only the most recent 15 stock movements for this item in database
      const oldMovements = await tx.stockMovement.findMany({
        where: { itemId },
        orderBy: { createdAt: 'desc' },
        skip: 15,
        select: { id: true },
      });

      if (oldMovements.length > 0) {
        await tx.stockMovement.deleteMany({
          where: { id: { in: oldMovements.map((m) => m.id) } },
        });
      }

      // Audit
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          entityType: 'ITEM',
          entityId: item.entityId,
          changes: {
            isOutOfStock: true,
            previousQuantity,
            newQuantity: 0,
          },
        },
      });
    });

    // Update today's financial snapshot immediately
    try {
      await captureDailySnapshot();
    } catch (e) {
      console.error('[ANALYTICS SNAPSHOT ERROR]', e);
    }

    revalidatePath(`/inventory/items/${itemId}`);
    revalidatePath('/inventory');
    revalidatePath('/inventory/folders');
    revalidatePath('/');
    return { success: true, previousQuantity, newQuantity: 0, quantityChange };
  } catch (error: any) {
    console.error('Mark item sold out error:', error);
    return { success: false, error: error.message || 'Failed to mark item as sold out.' };
  }
}

export async function refillUnlimitedItemAction(itemId: string, quantity: number = 1, notes?: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Authentication required.' };

  if (user.role !== 'ADMIN') {
    return { success: false, error: 'Permission denied. Only Admins can refill or restock items.' };
  }

  try {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        quantity: true,
        quantityMode: true,
        isOutOfStock: true,
        entityId: true,
        supplierRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { costPrice: true, sellingPrice: true },
        },
      },
    });

    if (!item) return { success: false, error: 'Item not found.' };

    const isNumeric = item.quantityMode === 'NUMERIC';
    const activePriceRec = item.supplierRecords[0];
    const unitCost = activePriceRec?.costPrice ? Number(activePriceRec.costPrice) : null;
    const unitPrice = activePriceRec?.sellingPrice ? Number(activePriceRec.sellingPrice) : null;
    const totalAmount = unitCost !== null ? Math.abs(quantity) * unitCost : null;
    const previousQuantity = item.quantity ?? (isNumeric ? 0 : 0);
    const newQuantity = isNumeric ? previousQuantity + quantity : null;

    await prisma.$transaction(async (tx) => {
      // 1. Log PURCHASE movement
      await tx.stockMovement.create({
        data: {
          itemId,
          movementType: 'PURCHASE',
          quantityChange: Math.max(1, quantity),
          previousQuantity: isNumeric ? previousQuantity : 0,
          newQuantity: isNumeric ? newQuantity : 1,
          unitCost: unitCost !== null ? unitCost : undefined,
          unitPrice: unitPrice !== null ? unitPrice : undefined,
          totalAmount: totalAmount !== null ? totalAmount : undefined,
          notes: notes || 'Stock Refilled / Restocked back in inventory',
          performedById: user.id,
        },
      });

      // 2. Set item as in stock
      await tx.item.update({
        where: { id: itemId },
        data: {
          isOutOfStock: false,
          quantity: newQuantity,
        },
      });

      // 3. Update stock settings
      await tx.itemStockSettings.upsert({
        where: { itemId },
        create: {
          itemId,
          totalPurchased: Math.max(1, quantity),
          lastPurchasedAt: new Date(),
        },
        update: {
          totalPurchased: { increment: Math.max(1, quantity) },
          lastPurchasedAt: new Date(),
        },
      });
    });

    try {
      await captureDailySnapshot();
    } catch (e) {
      console.error('[ANALYTICS SNAPSHOT ERROR]', e);
    }

    revalidatePath(`/inventory/items/${itemId}`);
    revalidatePath('/inventory');
    revalidatePath('/inventory/folders');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Refill item error:', error);
    return { success: false, error: error.message || 'Failed to refill item.' };
  }
}

export async function addSupplierRecordAction(data: {
  itemId: string;
  supplierName: string;
  costPrice?: number;
  sellingPrice?: number;
  purchaseDate?: string;
  remarks?: string;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, error: 'Permission denied.' };
  }

  try {
    let shortCode = generateShortCode();
    let attempts = 0;
    while (attempts < 10) {
      const exists = await prisma.supplierRecord.findUnique({ where: { shortCode } });
      if (!exists) break;
      shortCode = generateShortCode();
      attempts++;
    }

    const result = await prisma.$transaction(async (tx) => {
      const entity = await tx.entity.create({
        data: { entityType: { connect: { code: 'SUPPLIER_RECORD' } }, displayName: `${data.supplierName} - Record` },
      });

      const record = await tx.supplierRecord.create({
        data: {
          entityId: entity.id,
          itemId: data.itemId,
          supplierName: data.supplierName,
          costPrice: data.costPrice ?? null,
          sellingPrice: data.sellingPrice ?? null,
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
          remarks: data.remarks || null,
          shortCode,
          createdById: user.id,
        },
      });

      const item = await tx.item.findUnique({ where: { id: data.itemId }, select: { entityId: true } });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CREATE',
          entityType: 'SUPPLIER_RECORD',
          entityId: entity.id,
          changes: { itemId: data.itemId, supplierName: data.supplierName, shortCode },
        },
      });

      return record;
    });

    // Update today's inventory cost snapshot immediately with new price code
    try {
      await captureDailySnapshot();
    } catch (e) {
      console.error('[ANALYTICS SNAPSHOT ERROR]', e);
    }

    revalidatePath(`/inventory/items/${data.itemId}`);
    revalidatePath('/inventory');
    revalidatePath('/');
    return { success: true, data: result };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to add supplier record.' };
  }
}

export async function updateItemParametersAction(data: {
  itemId: string;
  parameterValues: Array<{
    parameterDefinitionId: string;
    valueText?: string | null;
    valueNumber?: number | null;
    valueBoolean?: boolean | null;
    valueDate?: string | null;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'ADMIN' && user.role !== 'STAFF')) {
    return { success: false, error: 'Permission denied.' };
  }

  try {
    const item = await prisma.item.findUnique({
      where: { id: data.itemId },
      select: { id: true, entityId: true },
    });
    if (!item) return { success: false, error: 'Item not found.' };

    await prisma.$transaction(async (tx) => {
      for (const pv of data.parameterValues) {
        const hasValue =
          (pv.valueText !== undefined && pv.valueText !== null && pv.valueText !== '') ||
          (pv.valueNumber !== undefined && pv.valueNumber !== null) ||
          (pv.valueBoolean !== undefined && pv.valueBoolean !== null) ||
          (pv.valueDate !== undefined && pv.valueDate !== null && pv.valueDate !== '');

        if (hasValue) {
          await tx.itemParameterValue.upsert({
            where: {
              itemId_parameterDefinitionId: {
                itemId: data.itemId,
                parameterDefinitionId: pv.parameterDefinitionId,
              },
            },
            create: {
              itemId: data.itemId,
              parameterDefinitionId: pv.parameterDefinitionId,
              valueText: pv.valueText || null,
              valueNumber: pv.valueNumber !== undefined && pv.valueNumber !== null ? pv.valueNumber : null,
              valueBoolean: pv.valueBoolean !== undefined && pv.valueBoolean !== null ? pv.valueBoolean : null,
              valueDate: pv.valueDate ? new Date(pv.valueDate) : null,
            },
            update: {
              valueText: pv.valueText || null,
              valueNumber: pv.valueNumber !== undefined && pv.valueNumber !== null ? pv.valueNumber : null,
              valueBoolean: pv.valueBoolean !== undefined && pv.valueBoolean !== null ? pv.valueBoolean : null,
              valueDate: pv.valueDate ? new Date(pv.valueDate) : null,
            },
          });
        } else {
          // If value was cleared, delete existing record if any
          await tx.itemParameterValue.deleteMany({
            where: {
              itemId: data.itemId,
              parameterDefinitionId: pv.parameterDefinitionId,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          entityType: 'ITEM',
          entityId: item.entityId,
          changes: { updatedParametersCount: data.parameterValues.length },
        },
      });
    });

    revalidatePath(`/inventory/items/${data.itemId}`);
    revalidatePath('/inventory');
    return { success: true };
  } catch (error: any) {
    console.error('Update item parameters error:', error);
    return { success: false, error: error.message || 'Failed to update parameters.' };
  }
}

/**
 * Live search and browse items for linking into folders
 */
export async function searchItemsForPickerAction(query?: string, browseFolderId?: string) {
  try {
    const cleanQuery = query?.trim().toLowerCase() || '';

    let items = await prisma.item.findMany({
      where: browseFolderId
        ? { folderItems: { some: { folderId: browseFolderId } } }
        : {},
      take: cleanQuery ? 150 : 40,
      orderBy: { updatedAt: 'desc' },
      include: {
        folderItems: {
          include: {
            folder: { select: { id: true, name: true, materializedPath: true } },
          },
        },
        supplierRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { shortCode: true, sellingPrice: true, costPrice: true, supplierName: true },
        },
        entity: {
          include: {
            mediaAttachments: {
              include: { media: true },
              orderBy: [
                { sortOrder: 'asc' },
                { createdAt: 'desc' },
              ],
            },
          },
        },
      },
    });

    // If query provided, apply sequence matching & scoring
    let mappedItems = items.map((item) => {
      const shortCode = item.supplierRecords[0]?.shortCode || null;
      const supplierName = item.supplierRecords[0]?.supplierName || '';
      const combinedText = [item.name, item.location, item.notes, shortCode, supplierName].filter(Boolean).join(' ');
      const matchScore = cleanQuery ? calculateMatchScore(cleanQuery, combinedText, shortCode || undefined) : 100;

      const primaryAttachment =
        item.entity?.mediaAttachments?.find((a: any) => a.purpose === 'PRIMARY') ||
        item.entity?.mediaAttachments?.[0];
      const thumbnailUrl =
        primaryAttachment?.media?.secureUrl || primaryAttachment?.media?.url || null;

      return {
        id: item.id,
        name: item.name,
        location: item.location,
        quantity: item.quantity,
        isOutOfStock: item.isOutOfStock,
        quantityMode: item.quantityMode,
        shortCode,
        sellingPrice: item.supplierRecords[0]?.sellingPrice ? Number(item.supplierRecords[0].sellingPrice) : null,
        thumbnailUrl,
        folderIds: item.folderItems.map((fi) => fi.folder.id),
        folders: item.folderItems.map((fi) => ({ id: fi.folder.id, name: fi.folder.name })),
        matchScore,
      };
    });

    if (cleanQuery) {
      mappedItems = mappedItems
        .filter((item) => item.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 40);
    }

    // Also fetch folder children if browsing
    let folders: Array<{ id: string; name: string; materializedPath: string; _count: { folderItems: number; children: number } }> = [];
    if (browseFolderId) {
      folders = await prisma.folder.findMany({
        where: { parentId: browseFolderId },
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: { select: { folderItems: true, children: true } },
        },
      });
    } else if (!cleanQuery) {
      // Root folders
      folders = await prisma.folder.findMany({
        where: { parentId: null },
        orderBy: { sortOrder: 'asc' },
        include: {
          _count: { select: { folderItems: true, children: true } },
        },
      });
    }

    return {
      success: true,
      items: mappedItems,
      folders,
    };
  } catch (error: any) {
    console.error('Search items for picker error:', error);
    return { success: false, error: error.message || 'Failed to search items', items: [], folders: [] };
  }
}

/**
 * Fetch all folders and whether an item is currently linked to each
 */
export async function getAllFoldersForLinkingAction(itemId: string) {
  try {
    const [allFolders, itemWithFolders] = await Promise.all([
      prisma.folder.findMany({
        orderBy: { materializedPath: 'asc' },
        select: {
          id: true,
          name: true,
          materializedPath: true,
          depth: true,
          parentId: true,
        },
      }),
      prisma.item.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          name: true,
          folderItems: { select: { folderId: true } },
        },
      }),
    ]);

    if (!itemWithFolders) {
      return { success: false, error: 'Item not found', folders: [] };
    }

    const linkedFolderIds = new Set(itemWithFolders.folderItems.map((fi) => fi.folderId));

    return {
      success: true,
      itemName: itemWithFolders.name,
      folders: allFolders.map((f) => ({
        id: f.id,
        name: f.name,
        materializedPath: f.materializedPath,
        depth: f.depth,
        isLinked: linkedFolderIds.has(f.id),
      })),
    };
  } catch (error: any) {
    console.error('Get folders for linking error:', error);
    return { success: false, error: error.message || 'Failed to get folders', folders: [] };
  }
}

import { parseThumbnailUrl, formatThumbnailUrl } from '@/lib/thumbnail-utils';

/**
 * Updates or removes the primary display thumbnail for an inventory item.
 * Supports lossless pan/zoom coordinate persistence, base64 uploads, Cloudinary media, or removal.
 */
export async function setItemThumbnailAction(
  itemId: string,
  thumbnailUrl: string | null
): Promise<{ success: boolean; error?: string; primaryUrl?: string | null }> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, error: 'Unauthorized: Admin access required.' };
  }

  try {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        name: true,
        entityId: true,
      },
    });

    if (!item) {
      return { success: false, error: 'Item not found.' };
    }

    if (!thumbnailUrl || !thumbnailUrl.trim()) {
      // Demote / remove existing PRIMARY media
      await prisma.entityMedia.updateMany({
        where: { entityId: item.entityId, purpose: 'PRIMARY' },
        data: { purpose: 'GALLERY' },
      });

      revalidatePath('/inventory');
      revalidatePath('/inventory/folders');
      revalidatePath(`/inventory/items/${itemId}`);
      return { success: true, primaryUrl: null };
    }

    const trimmedUrl = thumbnailUrl.trim();
    const parsed = parseThumbnailUrl(trimmedUrl);
    let finalSecureUrl: string;

    if (parsed.url.startsWith('data:image/')) {
      // Direct base64 upload to Cloudinary
      let uploadResult: any;
      try {
        uploadResult = await cloudinary.uploader.upload(parsed.url, {
          folder: 'tv-tech-os/images',
          resource_type: 'image',
          timeout: 120000,
        });
      } catch (cloudErr: any) {
        console.warn('Cloudinary upload fallback:', cloudErr);
        uploadResult = {
          public_id: `item_${Date.now()}`,
          secure_url: parsed.url,
          url: parsed.url,
          width: 960,
          height: 600,
        };
      }

      const uploadedUrl = uploadResult.secure_url || uploadResult.url || parsed.url;
      finalSecureUrl = formatThumbnailUrl(uploadedUrl, parsed.x, parsed.y, parsed.scale);

      // Demote existing PRIMARY attachments
      await prisma.entityMedia.updateMany({
        where: { entityId: item.entityId, purpose: 'PRIMARY' },
        data: { purpose: 'GALLERY', sortOrder: 1 },
      });

      // Create new PRIMARY media attachment
      await createMediaAttachment({
        entityId: item.entityId,
        mediaType: MediaType.IMAGE,
        provider: StorageProvider.CLOUDINARY,
        publicId: uploadResult.public_id || `thumb_${Date.now()}`,
        url: finalSecureUrl,
        secureUrl: finalSecureUrl,
        filename: `${item.name.replace(/[^a-zA-Z0-9]/g, '_')}_thumb.jpg`,
        mimeType: 'image/jpeg',
        width: uploadResult.width || 960,
        height: uploadResult.height || 600,
        purpose: 'PRIMARY',
        uploadedById: user.id,
      });
    } else {
      // Existing hosted URL or Cloudinary URL with updated pan/zoom coordinates
      finalSecureUrl = formatThumbnailUrl(parsed.url, parsed.x, parsed.y, parsed.scale);

      // Check if item already has a PRIMARY media attachment
      const existingPrimary = await prisma.entityMedia.findFirst({
        where: { entityId: item.entityId, purpose: 'PRIMARY' },
        include: { media: true },
      });

      if (existingPrimary) {
        // Update existing PRIMARY media URL directly
        await prisma.media.update({
          where: { id: existingPrimary.mediaId },
          data: {
            url: finalSecureUrl,
            secureUrl: finalSecureUrl,
          },
        });
      } else {
        // Check if any existing media matches this base URL
        const existingMedia = await prisma.entityMedia.findFirst({
          where: {
            entityId: item.entityId,
            media: {
              OR: [
                { url: { startsWith: parsed.url } },
                { secureUrl: { startsWith: parsed.url } },
              ],
            },
          },
          include: { media: true },
        });

        if (existingMedia) {
          // Promote to PRIMARY and update URL
          await prisma.entityMedia.updateMany({
            where: { entityId: item.entityId, purpose: 'PRIMARY' },
            data: { purpose: 'GALLERY' },
          });

          await prisma.entityMedia.update({
            where: { id: existingMedia.id },
            data: { purpose: 'PRIMARY', sortOrder: 0 },
          });

          await prisma.media.update({
            where: { id: existingMedia.mediaId },
            data: {
              url: finalSecureUrl,
              secureUrl: finalSecureUrl,
            },
          });
        } else {
          // Create new PRIMARY attachment with the formatted URL
          await createMediaAttachment({
            entityId: item.entityId,
            mediaType: MediaType.IMAGE,
            provider: StorageProvider.CLOUDINARY,
            publicId: `thumb_${Date.now()}`,
            url: finalSecureUrl,
            secureUrl: finalSecureUrl,
            filename: `${item.name.replace(/[^a-zA-Z0-9]/g, '_')}_thumb.jpg`,
            mimeType: 'image/jpeg',
            width: 960,
            height: 600,
            purpose: 'PRIMARY',
            uploadedById: user.id,
          });
        }
      }
    }

    revalidatePath('/inventory');
    revalidatePath('/inventory/folders');
    revalidatePath(`/inventory/items/${itemId}`);
    revalidatePath('/');

    return { success: true, primaryUrl: finalSecureUrl };
  } catch (error: any) {
    console.error('setItemThumbnailAction error:', error);
    return { success: false, error: error.message || 'Failed to update item thumbnail.' };
  }
}
