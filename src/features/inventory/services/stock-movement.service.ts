// ============================================================
// Event-Sourced Stock Movement Service
// ============================================================
// Enforces event-sourced stock tracking:
// 1. Direct item quantity mutation is PROHIBITED.
// 2. Quantity updates MUST create a StockMovement record.
// 3. Atomically updates item.quantity and ItemStockSettings analytics.

import { prisma } from '@/lib/prisma';
import { StockMovement, StockMovementType, QuantityMode } from '@prisma/client';

export interface CreateStockMovementInput {
  itemId: string;
  movementType: StockMovementType;
  quantityChange: number; // Positive for additions (PURCHASE/RETURN), negative for subtractions (SALE/DAMAGE/LOST)
  referenceNumber?: string;
  notes?: string;
  performedById?: string;
  purchaseListItemId?: string;
}

export async function createStockMovement(
  input: CreateStockMovementInput
): Promise<StockMovement> {
  const item = await prisma.item.findUnique({
    where: { id: input.itemId },
    select: { id: true, quantity: true, quantityMode: true, isOutOfStock: true },
  });

  if (!item) {
    throw new Error(`Item ${input.itemId} not found`);
  }

  if (item.quantityMode === QuantityMode.UNKNOWN) {
    throw new Error('Cannot log numeric quantity movements for items with UNKNOWN quantity mode. Use Out-of-Stock toggle instead.');
  }

  const previousQuantity = item.quantity ?? 0;
  const newQuantity = Math.max(0, previousQuantity + input.quantityChange);
  const isOutOfStock = newQuantity === 0;

  return await prisma.$transaction(async (tx) => {
    // 1. Create StockMovement record
    const movement = await tx.stockMovement.create({
      data: {
        itemId: input.itemId,
        movementType: input.movementType,
        quantityChange: input.quantityChange,
        previousQuantity,
        newQuantity,
        referenceNumber: input.referenceNumber,
        notes: input.notes,
        performedById: input.performedById,
        purchaseListItemId: input.purchaseListItemId,
      },
    });

    // 2. Atomically update item quantity and out-of-stock flag
    await tx.item.update({
      where: { id: input.itemId },
      data: {
        quantity: newQuantity,
        isOutOfStock,
      },
    });

    // 3. Update ItemStockSettings analytics flags
    const isSale = input.movementType === StockMovementType.SALE;
    const isPurchase = input.movementType === StockMovementType.PURCHASE;

    await tx.itemStockSettings.upsert({
      where: { itemId: input.itemId },
      update: {
        lastSoldAt: isSale ? new Date() : undefined,
        lastPurchasedAt: isPurchase ? new Date() : undefined,
        totalSold: isSale ? { increment: Math.abs(input.quantityChange) } : undefined,
        totalPurchased: isPurchase ? { increment: Math.abs(input.quantityChange) } : undefined,
      },
      create: {
        itemId: input.itemId,
        minimumStock: 0,
        needToPurchase: false,
        lastSoldAt: isSale ? new Date() : undefined,
        lastPurchasedAt: isPurchase ? new Date() : undefined,
        totalSold: isSale ? Math.abs(input.quantityChange) : 0,
        totalPurchased: isPurchase ? Math.abs(input.quantityChange) : 0,
      },
    });

    return movement;
  });
}

/**
 * Fetches chronological movement timeline for an item.
 */
export async function getItemMovementHistory(itemId: string) {
  return await prisma.stockMovement.findMany({
    where: { itemId },
    orderBy: { createdAt: 'desc' },
    include: {
      performedBy: {
        select: { id: true, fullName: true, email: true },
      },
    },
  });
}
