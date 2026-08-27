// ============================================================
// TV Tech OS — Purchase Manager CRUD Server Actions
// ============================================================

'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { captureDailySnapshot } from '@/features/analytics/services/inventory-analytics.service';
import type { PurchaseListStatus } from '@prisma/client';

// ── Create Purchase List ──

export async function createPurchaseListAction(data: {
  title: string;
  notes?: string;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') return { success: false, error: 'Not authenticated.' };

  try {
    const list = await prisma.$transaction(async (tx) => {
      const entity = await tx.entity.create({
        data: {
          entityType: { connect: { code: 'PURCHASE_LIST' } },
          displayName: data.title,
        },
      });

      const list = await tx.purchaseList.create({
        data: {
          entityId: entity.id,
          title: data.title,
          notes: data.notes || null,
          createdById: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CREATE',
          entityType: 'PURCHASE_LIST',
          entityId: entity.id,
          changes: { title: data.title },
        },
      });

      return list;
    });

    revalidatePath('/purchase-manager');
    return { success: true, data: list };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create purchase list.' };
  }
}

// ── Add Item to Purchase List (Direct Input / Catalog) ──

export async function addDirectPurchaseItemAction(data: {
  purchaseListId: string;
  itemName: string;
  description?: string;
  quantity?: number;
  itemId?: string;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') return { success: false, error: 'Not authenticated.' };

  try {
    const qty = Math.max(1, data.quantity || 1);

    await prisma.$transaction(async (tx) => {
      // Create new purchase list item line
      await tx.purchaseListItem.create({
        data: {
          purchaseListId: data.purchaseListId,
          itemId: data.itemId || null,
          itemName: data.itemName.trim(),
          description: data.description?.trim() || null,
          notes: data.description?.trim() || null,
          quantity: qty,
        },
      });

      // Increment total item count on purchase list
      await tx.purchaseList.update({
        where: { id: data.purchaseListId },
        data: { itemCount: { increment: 1 } },
      });
    });

    revalidatePath('/purchase-manager');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to add item to purchase list.' };
  }
}

export async function updatePurchaseListItemAction(data: {
  id: string;
  itemName: string;
  description?: string;
  quantity: number;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') return { success: false, error: 'Not authenticated.' };

  try {
    const qty = Math.max(1, data.quantity || 1);

    await prisma.purchaseListItem.update({
      where: { id: data.id },
      data: {
        itemName: data.itemName.trim(),
        description: data.description?.trim() || null,
        notes: data.description?.trim() || null,
        quantity: qty,
      },
    });

    revalidatePath('/purchase-manager');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update item.' };
  }
}

export async function addItemToPurchaseListAction(data: {
  purchaseListId: string;
  itemId?: string;
  itemName?: string;
  description?: string;
  quantity?: number;
  estimatedCost?: number;
  notes?: string;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') return { success: false, error: 'Not authenticated.' };

  try {
    let resolvedName = data.itemName;
    if (!resolvedName && data.itemId) {
      const dbItem = await prisma.item.findUnique({
        where: { id: data.itemId },
        select: { name: true },
      });
      resolvedName = dbItem?.name;
    }

    await prisma.$transaction(async (tx) => {
      await tx.purchaseListItem.create({
        data: {
          purchaseListId: data.purchaseListId,
          itemId: data.itemId || null,
          itemName: resolvedName || 'Unnamed Part',
          description: data.description || data.notes || null,
          notes: data.notes || data.description || null,
          quantity: Math.max(1, data.quantity || 1),
        },
      });

      // Increment item count
      await tx.purchaseList.update({
        where: { id: data.purchaseListId },
        data: { itemCount: { increment: 1 } },
      });
    });

    revalidatePath('/purchase-manager');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to add item.' };
  }
}

// ── Remove Item from Purchase List ──

export async function removeItemFromPurchaseListAction(purchaseListItemId: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') return { success: false, error: 'Not authenticated.' };

  try {
    await prisma.$transaction(async (tx) => {
      const item = await tx.purchaseListItem.findUnique({
        where: { id: purchaseListItemId },
      });
      if (!item) throw new Error('Item not found.');

      await tx.purchaseListItem.delete({
        where: { id: purchaseListItemId },
      });

      const list = await tx.purchaseList.update({
        where: { id: item.purchaseListId },
        data: { itemCount: { decrement: 1 } },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          entityType: 'PURCHASE_LIST',
          entityId: list.entityId,
          changes: { action: 'REMOVE_ITEM', itemId: item.itemId },
        },
      });
    });

    revalidatePath('/purchase-manager');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to remove item.' };
  }
}

// ── Update Purchase List Status ──

export async function updatePurchaseListStatusAction(
  purchaseListId: string,
  status: PurchaseListStatus
) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated.' };

  try {
    const currentList = await prisma.purchaseList.findUnique({
      where: { id: purchaseListId },
      select: { status: true },
    });

    if (!currentList) {
      return { success: false, error: 'Purchase list not found.' };
    }

    const VALID_TRANSITIONS: Record<string, string[]> = {
      DRAFT: ['READY_TO_PRINT', 'CANCELLED'],
      READY_TO_PRINT: ['ORDERED', 'CANCELLED', 'DRAFT'],
      ORDERED: ['PARTIALLY_RECEIVED', 'CANCELLED'],
      PARTIALLY_RECEIVED: ['COMPLETED', 'CANCELLED'],
      COMPLETED: [],
      CANCELLED: ['DRAFT'],
    };

    const validNextStatuses = VALID_TRANSITIONS[currentList.status] || [];
    if (!validNextStatuses.includes(status)) {
      return { success: false, error: `Invalid status transition from ${currentList.status} to ${status}.` };
    }

    await prisma.$transaction(async (tx) => {
      const list = await tx.purchaseList.update({
        where: { id: purchaseListId },
        data: { status },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          entityType: 'PURCHASE_LIST',
          entityId: list.entityId,
          changes: { status },
        },
      });
    });

    revalidatePath('/purchase-manager');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update status.' };
  }
}

// ── Delete Purchase List ──

export async function deletePurchaseListAction(purchaseListId: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, error: 'Permission denied.' };
  }

  try {
    const list = await prisma.purchaseList.findUnique({
      where: { id: purchaseListId },
    });
    if (!list) return { success: false, error: 'Purchase list not found.' };

    await prisma.$transaction(async (tx) => {
      // Audit first
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'DELETE',
          entityType: 'PURCHASE_LIST',
          entityId: list.entityId,
          changes: { title: list.title },
        },
      });

      // Cascade delete via entity
      await tx.entity.delete({ where: { id: list.entityId } });
    });

    revalidatePath('/purchase-manager');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete purchase list.' };
  }
}

// ── Auto-Suggest Items for Purchase ──

export async function getAutoSuggestedItemsAction() {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated.', data: [] };

  try {
    // Find items that are out of stock or below minimum stock
    const suggestedItems = await prisma.item.findMany({
      where: {
        OR: [
          { isOutOfStock: true },
          {
            quantityMode: 'NUMERIC',
            stockSettings: {
              minimumStock: { gt: 0 },
            },
          },
        ],
      },
      include: {
        stockSettings: true,
        folderItems: {
          take: 1,
          include: { folder: { select: { name: true } } },
        },
      },
      take: 20,
      orderBy: { updatedAt: 'desc' },
    });

    // Filter: only items where quantity < minimumStock
    const filtered = suggestedItems.filter((item) => {
      if (item.isOutOfStock) return true;
      if (item.stockSettings && item.quantity !== null) {
        return item.quantity <= item.stockSettings.minimumStock;
      }
      return false;
    });

    return { success: true, data: filtered };
  } catch (error: any) {
    return { success: false, error: error.message, data: [] };
  }
}

// ── Receive Stock ──

export async function receiveStockAction(data: {
  purchaseListId: string;
  items: { purchaseListItemId: string; itemId: string; receivedQty: number }[];
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, error: 'Permission denied.' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      let allFullyReceived = true;

      for (const item of data.items) {
        if (item.receivedQty <= 0) continue;

        // Get current item
        const currentItem = await tx.item.findUnique({ 
          where: { id: item.itemId }, 
          select: { quantity: true, quantityMode: true } 
        });
        if (!currentItem) continue;

        const isNumeric = currentItem.quantityMode === 'NUMERIC';
        const previousQty = currentItem.quantity ?? 0;
        const newQty = isNumeric ? previousQty + item.receivedQty : null;

        // Update item quantity
        await tx.item.update({ 
          where: { id: item.itemId }, 
          data: { quantity: newQty, isOutOfStock: false } 
        });

        // Create stock movement
        await tx.stockMovement.create({ 
          data: { 
            itemId: item.itemId, 
            movementType: 'PURCHASE', 
            quantityChange: item.receivedQty, 
            previousQuantity: previousQty, 
            newQuantity: isNumeric ? newQty : 1, 
            performedById: user.id, 
            purchaseListItemId: item.purchaseListItemId, 
            notes: 'Received from purchase list' 
          } 
        });

        // Update purchase list item received qty
        const pli = await tx.purchaseListItem.update({ 
          where: { id: item.purchaseListItemId }, 
          data: { receivedQty: { increment: item.receivedQty } } 
        });

        if (pli.receivedQty < pli.quantity) allFullyReceived = false;
      }

      // Update list status
      await tx.purchaseList.update({ 
        where: { id: data.purchaseListId }, 
        data: { status: allFullyReceived ? 'COMPLETED' : 'PARTIALLY_RECEIVED' } 
      });

      await tx.auditLog.create({ 
        data: { 
          userId: user.id, 
          action: 'UPDATE', 
          entityType: 'PURCHASE_LIST', 
          changes: { action: 'RECEIVE_STOCK', itemCount: data.items.length } 
        } 
      });
    });

    try {
      await captureDailySnapshot();
    } catch (e) {
      console.error('[ANALYTICS SNAPSHOT ERROR]', e);
    }

    revalidatePath('/purchase-manager');
    revalidatePath('/inventory');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to receive stock.' };
  }
}
