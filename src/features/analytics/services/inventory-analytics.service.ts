// ============================================================
// TV Tech OS — Daily Inventory & Financial Analytics Engine
// ============================================================
// Captures immutable daily snapshots of:
// 1. Total Inventory In-Stock Cost (Σ(in_stock_qty × latest_cost_price), infinite = 1 unit)
// 2. Sales Revenue (Cash received from items sold on each day)
// 3. Realized Profit (Net profit after deducting cost of items sold)
// 4. Stock Inflow / Outflow unit velocity

import { prisma } from '@/lib/prisma';

export type AnalyticsTimePeriod =
  | 'today'
  | 'yesterday'
  | 'this_month'
  | '3m'
  | '6m'
  | 'year'
  | 'all';

export interface FormattedDailySnapshot {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  displayDate: string; // "Aug 20"
  totalInventoryCost: number;
  totalInventoryRetail: number;
  totalRevenue: number;
  totalProfit: number;
  totalCogs: number;
  unitsSold: number;
  unitsPurchased: number;
  totalInStockUnits: number;
  totalCatalogItems: number;
}

/**
 * Captures or updates the financial snapshot for a specific calendar day.
 * When called today (or upon adding a price code / sale), it updates today's valuation
 * without modifying any past day's historical records.
 */
export async function captureDailySnapshot(targetDate: Date = new Date()): Promise<FormattedDailySnapshot> {
  const year = targetDate.getFullYear();
  const month = targetDate.getMonth();
  const day = targetDate.getDate();

  // Normalize target date to 00:00:00.000 UTC / Local date boundary
  const normalizedDate = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  const startOfDay = new Date(year, month, day, 0, 0, 0, 0);
  const endOfDay = new Date(year, month, day, 23, 59, 59, 999);

  // 1. Fetch all items with their latest supplier price record active on or before targetDate
  const allItems = await prisma.item.findMany({
    select: {
      id: true,
      quantity: true,
      quantityMode: true,
      isOutOfStock: true,
      stockSettings: {
        select: {
          totalPurchased: true,
          totalSold: true,
        },
      },
      supplierRecords: {
        where: {
          createdAt: { lte: endOfDay },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          costPrice: true,
          sellingPrice: true,
        },
      },
    },
  });

  // Calculate Total In-Stock Inventory Cost & Retail Value
  let totalInventoryCost = 0;
  let totalInventoryRetail = 0;
  let totalInStockUnits = 0;

  for (const it of allItems) {
    const latestRec = it.supplierRecords[0];
    const cost = latestRec?.costPrice ? Number(latestRec.costPrice) : 0;
    const sell = latestRec?.sellingPrice ? Number(latestRec.sellingPrice) : 0;

    if (it.quantityMode === 'NUMERIC') {
      const qty = it.quantity ?? 0;
      totalInventoryCost += qty * cost;
      totalInventoryRetail += qty * sell;
      totalInStockUnits += qty;
    } else {
      // UNLIMITED / UNKNOWN Quantity Mode:
      // In-stock item unit count in catalog is always 1 (or 0 if out of stock)
      const displayQty = it.isOutOfStock ? 0 : 1;
      totalInStockUnits += displayQty;

      if (!it.isOutOfStock) {
        // Valuation holding units: If custom numeric purchase N was made,
        // holding valuation reflects net holding units = max(1, totalPurchased - totalSold).
        // Otherwise default baseline is 1 unit.
        const purchased = it.stockSettings?.totalPurchased ?? 0;
        const sold = it.stockSettings?.totalSold ?? 0;
        const holdingValuationUnits = Math.max(1, purchased - sold);

        totalInventoryCost += holdingValuationUnits * cost;
        totalInventoryRetail += holdingValuationUnits * sell;
      }
    }
  }

  // 2. Fetch all stock movements recorded on this calendar day
  const dailyMovements = await prisma.stockMovement.findMany({
    where: {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    select: {
      id: true,
      movementType: true,
      quantityChange: true,
      unitCost: true,
      unitPrice: true,
      itemId: true,
      item: {
        select: {
          supplierRecords: {
            where: { createdAt: { lte: endOfDay } },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { costPrice: true, sellingPrice: true },
          },
        },
      },
    },
  });

  let totalRevenue = 0;
  let totalCogs = 0;
  let totalProfit = 0;
  let unitsSold = 0;
  let unitsPurchased = 0;

  for (const mov of dailyMovements) {
    const qty = Math.abs(mov.quantityChange);

    // Sales transactions (cash received & profit realized)
    if (mov.movementType === 'SALE' || mov.quantityChange < 0) {
      const rec = mov.item.supplierRecords[0];
      const sellPrice = mov.unitPrice ? Number(mov.unitPrice) : rec?.sellingPrice ? Number(rec.sellingPrice) : 0;
      const costPrice = mov.unitCost ? Number(mov.unitCost) : rec?.costPrice ? Number(rec.costPrice) : 0;

      const lineRevenue = qty * sellPrice;
      const lineCost = qty * costPrice;
      const lineProfit = Math.max(0, lineRevenue - lineCost);

      totalRevenue += lineRevenue;
      totalCogs += lineCost;
      totalProfit += lineProfit;
      unitsSold += qty;
    } else if (mov.movementType === 'PURCHASE' || mov.movementType === 'RETURN') {
      unitsPurchased += qty;
    }
  }

  // 3. Upsert into database table
  const snapshot = await prisma.dailyInventorySnapshot.upsert({
    where: { date: normalizedDate },
    create: {
      date: normalizedDate,
      totalInventoryCost,
      totalInventoryRetail,
      totalRevenue,
      totalProfit,
      totalCogs,
      unitsSold,
      unitsPurchased,
      totalInStockUnits,
      totalCatalogItems: allItems.length,
    },
    update: {
      totalInventoryCost,
      totalInventoryRetail,
      totalRevenue,
      totalProfit,
      totalCogs,
      unitsSold,
      unitsPurchased,
      totalInStockUnits,
      totalCatalogItems: allItems.length,
    },
  });

  return {
    id: snapshot.id,
    date: snapshot.date.toISOString().split('T')[0],
    displayDate: snapshot.date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    totalInventoryCost: Number(snapshot.totalInventoryCost),
    totalInventoryRetail: Number(snapshot.totalInventoryRetail),
    totalRevenue: Number(snapshot.totalRevenue),
    totalProfit: Number(snapshot.totalProfit),
    totalCogs: Number(snapshot.totalCogs),
    unitsSold: snapshot.unitsSold,
    unitsPurchased: snapshot.unitsPurchased,
    totalInStockUnits: snapshot.totalInStockUnits,
    totalCatalogItems: snapshot.totalCatalogItems,
  };
}

/**
 * Fetches continuous daily snapshot timeseries for the requested time window.
 * Ensures today's snapshot is captured if missing.
 */
export async function getDailySnapshots(period: AnalyticsTimePeriod = 'all'): Promise<{
  snapshots: FormattedDailySnapshot[];
  currentValuation: {
    totalInventoryCost: number;
    totalInventoryRetail: number;
    totalCatalogItems: number;
    totalInStockUnits: number;
  };
  periodAggregates: {
    totalRevenue: number;
    totalProfit: number;
    totalCogs: number;
    unitsSold: number;
    unitsPurchased: number;
    marginPercent: string;
  };
}> {
  // Always guarantee today's snapshot is fresh
  const todaySnapshot = await captureDailySnapshot(new Date());

  const now = new Date();
  const todayStr = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 1)).toISOString().split('T')[0];
  const startOfMonthStr = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().split('T')[0];
  const cutoff3m = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 90)).toISOString().split('T')[0];
  const cutoff6m = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 180)).toISOString().split('T')[0];
  const cutoffYear = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - 365)).toISOString().split('T')[0];

  let whereClause = {};
  if (period === 'today') {
    whereClause = { date: new Date(todayStr) };
  } else if (period === 'yesterday') {
    whereClause = { date: new Date(yesterdayStr) };
  } else if (period === 'this_month') {
    whereClause = { date: { gte: new Date(startOfMonthStr) } };
  } else if (period === '3m') {
    whereClause = { date: { gte: new Date(cutoff3m) } };
  } else if (period === '6m') {
    whereClause = { date: { gte: new Date(cutoff6m) } };
  } else if (period === 'year') {
    whereClause = { date: { gte: new Date(cutoffYear) } };
  }

  const dbSnapshots = await prisma.dailyInventorySnapshot.findMany({
    where: whereClause,
    orderBy: { date: 'asc' },
  });

  const formatted: FormattedDailySnapshot[] = dbSnapshots.map((s) => ({
    id: s.id,
    date: s.date.toISOString().split('T')[0],
    displayDate: s.date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    totalInventoryCost: Number(s.totalInventoryCost),
    totalInventoryRetail: Number(s.totalInventoryRetail),
    totalRevenue: Number(s.totalRevenue),
    totalProfit: Number(s.totalProfit),
    totalCogs: Number(s.totalCogs),
    unitsSold: s.unitsSold,
    unitsPurchased: s.unitsPurchased,
    totalInStockUnits: s.totalInStockUnits,
    totalCatalogItems: s.totalCatalogItems,
  }));

  // If list is empty or only 1 item, pad with baseline point
  if (formatted.length === 0) {
    formatted.push(todaySnapshot);
  }

  // Calculate period totals
  let totalRevenue = 0;
  let totalProfit = 0;
  let totalCogs = 0;
  let unitsSold = 0;
  let unitsPurchased = 0;

  for (const s of formatted) {
    totalRevenue += s.totalRevenue;
    totalProfit += s.totalProfit;
    totalCogs += s.totalCogs;
    unitsSold += s.unitsSold;
    unitsPurchased += s.unitsPurchased;
  }

  const marginPercent =
    totalCogs > 0
      ? ((totalProfit / totalCogs) * 100).toFixed(1)
      : totalRevenue > 0
      ? '100'
      : '0';

  return {
    snapshots: formatted,
    currentValuation: {
      totalInventoryCost: todaySnapshot.totalInventoryCost,
      totalInventoryRetail: todaySnapshot.totalInventoryRetail,
      totalCatalogItems: todaySnapshot.totalCatalogItems,
      totalInStockUnits: todaySnapshot.totalInStockUnits,
    },
    periodAggregates: {
      totalRevenue,
      totalProfit,
      totalCogs,
      unitsSold,
      unitsPurchased,
      marginPercent,
    },
  };
}

/**
 * Backfills past daily snapshots from earliest item creation date.
 */
export async function backfillHistoricalSnapshots(): Promise<number> {
  const earliestItem = await prisma.item.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });

  const startDate = earliestItem?.createdAt || new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const now = new Date();
  let count = 0;

  for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
    await captureDailySnapshot(new Date(d));
    count++;
  }

  return count;
}
