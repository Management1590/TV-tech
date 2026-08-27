// ============================================================
// Price History Analytics Service
// ============================================================
// Provides interactive price history chart data, time-period filters,
// supplier filters, and financial summary statistics.

import { prisma } from '@/lib/prisma';
import { subDays, subMonths, subYears } from 'date-fns';

export type TimePeriod = '7d' | '30d' | '3m' | '6m' | '1y' | '3y' | 'all';

export interface PriceHistoryFilterInput {
  itemId: string;
  timePeriod?: TimePeriod;
  supplierId?: string;
}

export interface PriceGraphPoint {
  date: string; // ISO String for chart X-axis
  formattedDate: string;
  costPrice: number | null;
  sellingPrice: number | null;
  supplierName: string;
  shortCode: string;
}

export interface PriceSummaryStats {
  currentCostPrice: number | null;
  lowestCostPrice: number | null;
  highestCostPrice: number | null;
  averageCostPrice: number | null;
  currentSellingPrice: number | null;
  lowestSellingPrice: number | null;
  highestSellingPrice: number | null;
  averageSellingPrice: number | null;
  profitMarginAmount: number | null;
  profitMarginPercent: number | null;
  totalRecordsCount: number;
}

function getStartDateFromPeriod(period: TimePeriod): Date | null {
  const now = new Date();
  switch (period) {
    case '7d': return subDays(now, 7);
    case '30d': return subDays(now, 30);
    case '3m': return subMonths(now, 3);
    case '6m': return subMonths(now, 6);
    case '1y': return subYears(now, 1);
    case '3y': return subYears(now, 3);
    case 'all': default: return null;
  }
}

/**
 * Returns series data for rendering the Cost vs Selling Price dual-series chart.
 */
export async function getPriceGraphData(input: PriceHistoryFilterInput): Promise<PriceGraphPoint[]> {
  const startDate = input.timePeriod ? getStartDateFromPeriod(input.timePeriod) : null;

  const records = await prisma.supplierRecord.findMany({
    where: {
      itemId: input.itemId,
      supplierId: input.supplierId ? input.supplierId : undefined,
      purchaseDate: startDate ? { gte: startDate } : undefined,
    },
    orderBy: { purchaseDate: 'asc' },
    select: {
      purchaseDate: true,
      costPrice: true,
      sellingPrice: true,
      supplierName: true,
      shortCode: true,
    },
  });

  return records.map((r) => {
    const pDate = r.purchaseDate || new Date();
    return {
      date: pDate.toISOString(),
      formattedDate: pDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }),
      costPrice: r.costPrice != null ? Number(r.costPrice) : null,
      sellingPrice: r.sellingPrice != null ? Number(r.sellingPrice) : null,
      supplierName: r.supplierName,
      shortCode: r.shortCode,
    };
  });
}

/**
 * Calculates financial summary statistics for an item's price history.
 */
export async function getPriceSummaryStats(itemId: string): Promise<PriceSummaryStats> {
  const records = await prisma.supplierRecord.findMany({
    where: { itemId },
    orderBy: { purchaseDate: 'desc' }, // Latest first
    select: {
      costPrice: true,
      sellingPrice: true,
    },
  });

  if (records.length === 0) {
    return {
      currentCostPrice: null,
      lowestCostPrice: null,
      highestCostPrice: null,
      averageCostPrice: null,
      currentSellingPrice: null,
      lowestSellingPrice: null,
      highestSellingPrice: null,
      averageSellingPrice: null,
      profitMarginAmount: null,
      profitMarginPercent: null,
      totalRecordsCount: 0,
    };
  }

  const currentRecord = records[0];
  const currentCost = currentRecord.costPrice != null ? Number(currentRecord.costPrice) : null;
  const currentSelling = currentRecord.sellingPrice != null ? Number(currentRecord.sellingPrice) : null;

  const validCosts = records.map((r) => r.costPrice != null ? Number(r.costPrice) : null).filter((v): v is number => v !== null);
  const validSellings = records.map((r) => r.sellingPrice != null ? Number(r.sellingPrice) : null).filter((v): v is number => v !== null);

  const lowestCost = validCosts.length ? Math.min(...validCosts) : null;
  const highestCost = validCosts.length ? Math.max(...validCosts) : null;
  const avgCost = validCosts.length ? validCosts.reduce((a, b) => a + b, 0) / validCosts.length : null;

  const lowestSelling = validSellings.length ? Math.min(...validSellings) : null;
  const highestSelling = validSellings.length ? Math.max(...validSellings) : null;
  const avgSelling = validSellings.length ? validSellings.reduce((a, b) => a + b, 0) / validSellings.length : null;

  let marginAmount: number | null = null;
  let marginPercent: number | null = null;

  if (currentSelling != null && currentCost != null) {
    marginAmount = currentSelling - currentCost;
    marginPercent = currentCost > 0 ? (marginAmount / currentCost) * 100 : 0;
  }

  return {
    currentCostPrice: currentCost,
    lowestCostPrice: lowestCost,
    highestCostPrice: highestCost,
    averageCostPrice: avgCost ? Number(avgCost.toFixed(2)) : null,
    currentSellingPrice: currentSelling,
    lowestSellingPrice: lowestSelling,
    highestSellingPrice: highestSelling,
    averageSellingPrice: avgSelling ? Number(avgSelling.toFixed(2)) : null,
    profitMarginAmount: marginAmount ? Number(marginAmount.toFixed(2)) : null,
    profitMarginPercent: marginPercent ? Number(marginPercent.toFixed(1)) : null,
    totalRecordsCount: records.length,
  };
}
