// ============================================================
// Purchase Manager Service
// ============================================================
// Manages session-based purchase lists, auto-suggestions (low stock/OOS),
// status lifecycle, and stock receiving integration.

import { prisma } from '@/lib/prisma';
import { PurchaseList, PurchaseListItem, PurchaseListStatus, StockMovementType } from '@prisma/client';
import { createStockMovement } from '@/features/inventory/services/stock-movement.service';
import { ensureEntityType } from '@/lib/ensure-entity-types';

export interface CreatePurchaseListInput {
  title: string;
  notes?: string;
  createdById?: string;
}

export interface AddPurchaseListItemInput {
  purchaseListId: string;
  itemId: string;
  quantity?: number;
  estimatedCost?: number;
  notes?: string;
  isAutoSuggest?: boolean;
  suggestReason?: string;
}

/**
 * Creates a new PurchaseList registered in the Entity Registry.
 */
export async function createPurchaseList(input: CreatePurchaseListInput): Promise<PurchaseList> {
  return await prisma.$transaction(async (tx) => {
    // 0. Ensure EntityType exists
    await ensureEntityType('PURCHASE_LIST', tx);

    const entity = await tx.entity.create({
      data: {
        entityTypeCode: 'PURCHASE_LIST',
        displayName: input.title,
        searchText: `${input.title} ${input.notes || ''}`.trim(),
        createdBy: input.createdById,
      },
    });

    return await tx.purchaseList.create({
      data: {
        entityId: entity.id,
        title: input.title,
        notes: input.notes,
        status: PurchaseListStatus.DRAFT,
        createdById: input.createdById,
      },
    });
  });
}

/**
 * Adds an Item to a PurchaseList.
 */
export async function addItemToPurchaseList(input: AddPurchaseListItemInput): Promise<PurchaseListItem> {
  return await prisma.$transaction(async (tx) => {
    const item = await tx.purchaseListItem.create({
      data: {
        purchaseListId: input.purchaseListId,
        itemId: input.itemId,
        quantity: input.quantity || 1,
        estimatedCost: input.estimatedCost != null ? input.estimatedCost : null,
        notes: input.notes,
        isAutoSuggest: input.isAutoSuggest || false,
        suggestReason: input.suggestReason,
      },
    });

    await tx.purchaseList.update({
      where: { id: input.purchaseListId },
      data: { itemCount: { increment: 1 } },
    });

    return item;
  });
}

/**
 * Auto-generates purchase suggestions based on Low Stock (quantity <= 1) and Out-of-Stock items.
 */
export async function getPurchaseSuggestions() {
  const items = await prisma.item.findMany({
    where: {
      OR: [
        { isOutOfStock: true },
        { quantityMode: 'NUMERIC', quantity: { lte: 1 } },
        { stockSettings: { needToPurchase: true } },
      ],
    },
    select: {
      id: true,
      name: true,
      quantity: true,
      quantityMode: true,
      isOutOfStock: true,
      location: true,
      supplierRecords: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: { shortCode: true },
      },
      stockSettings: {
        select: {
          minimumStock: true,
          needToPurchase: true,
        },
      },
      parameterValues: {
        take: 3,
        select: {
          valueText: true,
          valueNumber: true,
          parameterDefinition: { select: { name: true, unit: true } },
        },
      },
    },
    orderBy: [
      { isOutOfStock: 'desc' },
      { quantity: 'asc' },
    ],
  });

  return items.map((item) => {
    const specsSummary = item.parameterValues
      .map((pv) => `${pv.parameterDefinition.name}: ${pv.valueText || pv.valueNumber || ''}${pv.parameterDefinition.unit ? ` ${pv.parameterDefinition.unit}` : ''}`)
      .join(', ');

    return {
      itemId: item.id,
      name: item.name,
      shortCode: item.supplierRecords[0]?.shortCode || null,
      description: specsSummary || '',
      currentQuantity: item.quantity,
      isOutOfStock: item.isOutOfStock,
      suggestedQty: item.isOutOfStock
        ? 5
        : typeof item.quantity === 'number' && item.quantity <= 1
        ? 5
        : 1,
      reason: item.isOutOfStock ? 'OUT_OF_STOCK' : 'LOW_STOCK',
    };
  });
}

/**
 * Receives stock for a PurchaseList, creating atomic PURCHASE stock movements for each item.
 */
export async function receiveStockForPurchaseList(
  purchaseListId: string,
  receivedItems: Array<{ purchaseListItemId: string; itemId: string; receivedQty: number }>,
  performedById?: string
): Promise<{ success: boolean }> {
  await prisma.$transaction(async (tx) => {
    let allCompleted = true;

    for (const item of receivedItems) {
      if (item.receivedQty > 0) {
        // Fetch current item quantity
        const currentItem = await tx.item.findUnique({
          where: { id: item.itemId },
          select: { quantity: true, quantityMode: true },
        });

        const prevQty = currentItem?.quantity ?? 0;
        const newQty = prevQty + item.receivedQty;

        // Update item
        await tx.item.update({
          where: { id: item.itemId },
          data: { quantity: newQty, isOutOfStock: false },
        });

        // Create stock movement
        await tx.stockMovement.create({
          data: {
            itemId: item.itemId,
            movementType: StockMovementType.PURCHASE,
            quantityChange: item.receivedQty,
            previousQuantity: prevQty,
            newQuantity: newQty,
            notes: `Received from Purchase List ${purchaseListId}`,
            performedById,
            purchaseListItemId: item.purchaseListItemId,
          },
        });

        // Update received qty on purchase list item
        const pli = await tx.purchaseListItem.update({
          where: { id: item.purchaseListItemId },
          data: { receivedQty: { increment: item.receivedQty } },
        });

        if (pli.receivedQty < pli.quantity) {
          allCompleted = false;
        }
      }
    }

    // Update purchase list status
    await tx.purchaseList.update({
      where: { id: purchaseListId },
      data: { status: allCompleted ? PurchaseListStatus.COMPLETED : PurchaseListStatus.PARTIALLY_RECEIVED },
    });
  });

  return { success: true };
}
