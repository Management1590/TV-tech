// ============================================================
// Analytics & Smart Sorting Engine
// ============================================================
// Calculates inventory statistics and executes all 19 Smart Sorting modes.
// Derived strictly from event-sourced stock_movements, item_stock_settings, view logs,
// and latest supplier price records.

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export type SmartSortMode =
  | 'MOST_SELLING'
  | 'LEAST_SELLING'
  | 'FAST_MOVING'
  | 'SLOW_MOVING'
  | 'MOST_VIEWED'
  | 'RECENTLY_ADDED'
  | 'RECENTLY_UPDATED'
  | 'RECENTLY_PURCHASED'
  | 'HIGHEST_PROFIT'
  | 'LOWEST_PROFIT'
  | 'HIGHEST_COST_PRICE'
  | 'LOWEST_COST_PRICE'
  | 'HIGHEST_SELLING_PRICE'
  | 'LOWEST_SELLING_PRICE'
  | 'NAME_ASC'
  | 'NAME_DESC'
  | 'QUANTITY_HIGH_TO_LOW'
  | 'QUANTITY_LOW_TO_HIGH'
  | 'NOT_SOLD_RECENTLY';

export interface SmartSortOptions {
  folderId?: string; // Limit to items linked to folder via FolderItem
  sortMode?: SmartSortMode;
  isOutOfStockOnly?: boolean;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

const PRICE_SORT_MODES: SmartSortMode[] = [
  'HIGHEST_COST_PRICE',
  'LOWEST_COST_PRICE',
  'HIGHEST_SELLING_PRICE',
  'LOWEST_SELLING_PRICE',
  'HIGHEST_PROFIT',
  'LOWEST_PROFIT',
];

/**
 * Executes Smart Sorting query for items within a folder (or across inventory).
 */
export async function getSortedItems(options: SmartSortOptions) {
  const mode = options.sortMode || 'RECENTLY_ADDED';
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  // 1. If it's a price-based sort mode, use parameterized raw SQL for high performance
  if (PRICE_SORT_MODES.includes(mode)) {
    let orderSql = Prisma.sql`lsr.cost_price DESC NULLS LAST`;
    if (mode === 'LOWEST_COST_PRICE') orderSql = Prisma.sql`lsr.cost_price ASC NULLS LAST`;
    if (mode === 'HIGHEST_SELLING_PRICE') orderSql = Prisma.sql`lsr.selling_price DESC NULLS LAST`;
    if (mode === 'LOWEST_SELLING_PRICE') orderSql = Prisma.sql`lsr.selling_price ASC NULLS LAST`;
    if (mode === 'HIGHEST_PROFIT') orderSql = Prisma.sql`lsr.profit DESC NULLS LAST`;
    if (mode === 'LOWEST_PROFIT') orderSql = Prisma.sql`lsr.profit ASC NULLS LAST`;

    const folderJoin = options.folderId
      ? Prisma.sql`INNER JOIN folder_items fi ON fi.item_id = i.id AND fi.folder_id = ${options.folderId}::uuid`
      : Prisma.empty;

    const oosWhere = options.isOutOfStockOnly
      ? Prisma.sql`AND i.is_out_of_stock = true`
      : Prisma.empty;

    const searchWhere = options.searchQuery
      ? Prisma.sql`AND i.name ILIKE ${`%${options.searchQuery}%`}`
      : Prisma.empty;

    const rawResult: { id: string }[] = await prisma.$queryRaw`
      WITH latest_supplier_records AS (
        SELECT DISTINCT ON (item_id)
          item_id,
          cost_price,
          selling_price,
          (COALESCE(selling_price, 0) - COALESCE(cost_price, 0)) AS profit
        FROM supplier_records
        ORDER BY item_id, COALESCE(purchase_date, created_at) DESC, created_at DESC
      )
      SELECT i.id
      FROM items i
      LEFT JOIN latest_supplier_records lsr ON lsr.item_id = i.id
      ${folderJoin}
      WHERE 1=1
      ${oosWhere}
      ${searchWhere}
      ORDER BY ${orderSql}, i.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const itemIds = rawResult.map((r) => r.id);

    // Fetch full item entities
    const items = await prisma.item.findMany({
      where: { id: { in: itemIds } },
      include: {
        stockSettings: true,
        supplierRecords: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        folderItems: {
          include: {
            folder: { select: { id: true, name: true } },
          },
        },
        entity: {
          include: {
            mediaAttachments: {
              include: { media: true },
              orderBy: { sortOrder: 'asc' },
              take: 1,
            },
          },
        },
      },
    });

    // Re-order according to raw query order
    const itemMap = new Map(items.map((it) => [it.id, it]));
    const orderedItems = itemIds.map((id) => itemMap.get(id)).filter(Boolean) as typeof items;

    // Total count for pagination
    const totalCount = await prisma.item.count({
      where: {
        folderItems: options.folderId ? { some: { folderId: options.folderId } } : undefined,
        isOutOfStock: options.isOutOfStockOnly ? true : undefined,
        name: options.searchQuery ? { contains: options.searchQuery, mode: 'insensitive' } : undefined,
      },
    });

    return {
      items: orderedItems,
      totalCount,
      sortMode: mode,
    };
  }

  // 2. Standard Prisma order modes
  const whereClause: Prisma.ItemWhereInput = {
    folderItems: options.folderId
      ? {
          some: { folderId: options.folderId },
        }
      : undefined,
    isOutOfStock: options.isOutOfStockOnly ? true : undefined,
    name: options.searchQuery
      ? { contains: options.searchQuery, mode: 'insensitive' }
      : undefined,
  };

  let orderByClause: Prisma.ItemOrderByWithRelationInput | Prisma.ItemOrderByWithRelationInput[] = {
    createdAt: 'desc',
  };

  switch (mode) {
    case 'NAME_ASC':
      orderByClause = { name: 'asc' };
      break;
    case 'NAME_DESC':
      orderByClause = { name: 'desc' };
      break;
    case 'RECENTLY_ADDED':
      orderByClause = { createdAt: 'desc' };
      break;
    case 'RECENTLY_UPDATED':
      orderByClause = { updatedAt: 'desc' };
      break;
    case 'QUANTITY_HIGH_TO_LOW':
      orderByClause = { quantity: 'desc' };
      break;
    case 'QUANTITY_LOW_TO_HIGH':
      orderByClause = { quantity: 'asc' };
      break;
    case 'MOST_VIEWED':
      orderByClause = { stockSettings: { viewCount: 'desc' } };
      break;
    case 'MOST_SELLING':
      orderByClause = { stockSettings: { totalSold: 'desc' } };
      break;
    case 'LEAST_SELLING':
      orderByClause = { stockSettings: { totalSold: 'asc' } };
      break;
    case 'RECENTLY_PURCHASED':
      orderByClause = { stockSettings: { lastPurchasedAt: 'desc' } };
      break;
    case 'NOT_SOLD_RECENTLY':
      orderByClause = { stockSettings: { lastSoldAt: 'asc' } };
      break;
    case 'FAST_MOVING':
      orderByClause = { stockSettings: { totalSold: 'desc' } };
      break;
    case 'SLOW_MOVING':
      orderByClause = { stockSettings: { totalSold: 'asc' } };
      break;
    default:
      orderByClause = { createdAt: 'desc' };
      break;
  }

  const items = await prisma.item.findMany({
    where: whereClause,
    orderBy: orderByClause,
    take: limit,
    skip: offset,
    include: {
      stockSettings: true,
      supplierRecords: {
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
      folderItems: {
        include: {
          folder: { select: { id: true, name: true } },
        },
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

  const totalCount = await prisma.item.count({ where: whereClause });

  return {
    items,
    totalCount,
    sortMode: mode,
  };
}

/**
 * Increments viewCount in ItemStockSettings on each item view without creating individual log rows.
 */
export async function recordItemView(itemId: string, userId?: string | null): Promise<void> {
  try {
    await prisma.itemStockSettings.upsert({
      where: { itemId },
      create: {
        itemId,
        viewCount: 1,
      },
      update: {
        viewCount: { increment: 1 },
      },
    });
  } catch (error) {
    // Non-blocking fire-and-forget logging
    console.warn('Item view counter increment notice:', error);
  }
}

/**
 * Returns overall dashboard analytics widgets.
 */
export async function getDashboardAnalytics() {
  const [totalItems, outOfStockCount, lowStockCount, totalFolders, totalSuppliers] = await Promise.all([
    prisma.item.count(),
    prisma.item.count({ where: { isOutOfStock: true } }),
    prisma.itemStockSettings.count({ where: { needToPurchase: true } }),
    prisma.folder.count(),
    prisma.supplier.count(),
  ]);

  const topSelling = await prisma.item.findMany({
    take: 5,
    orderBy: { stockSettings: { totalSold: 'desc' } },
    select: { id: true, name: true, stockSettings: { select: { totalSold: true } } },
  });

  return {
    totalItems,
    outOfStockCount,
    lowStockCount,
    totalFolders,
    totalSuppliers,
    topSelling,
  };
}
