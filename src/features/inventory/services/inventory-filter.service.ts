// ============================================================
// Universal & Folder-Scoped Inventory Item Filtering & Smart Sorting Service
// ============================================================
// Performs cross-folder dynamic item filtering powered by Universal & Folder Parameters
// with Range filtering for numbers/decimals, Boolean toggles, and subsequence text search.

import { prisma } from '@/lib/prisma';
import { SmartSortMode } from '@/features/analytics/services/analytics.service';
import { matchesOrderedPattern, calculateMatchScore } from '@/features/search/services/search.service';
import { getEffectiveParameterDefinitions } from '@/features/inventory/services/parameter.service';

export interface ParamFilterCriteria {
  slug: string;
  valueType: string;
  name: string;
  unit?: string | null;
  min?: number;
  max?: number;
  boolValue?: boolean;
  textQuery?: string;
}

export interface UniversalFilterOptions {
  folderId?: string; // If provided, limits item search to this folder and its descendant subfolders
  searchQuery?: string;
  sortMode?: SmartSortMode;
  stockFilter?: 'ALL' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'IN_STOCK';
  viewAll?: boolean;
  paramFilters?: Record<
    string,
    {
      min?: number;
      max?: number;
      boolValue?: boolean;
      textQuery?: string;
    }
  >;
}

export async function getUniversalParameters() {
  return prisma.parameterDefinition.findMany({
    where: { folderId: null },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function filterUniversalInventoryItems(options: UniversalFilterOptions) {
  const sort = options.sortMode || 'RECENTLY_ADDED';
  const searchQuery = options.searchQuery?.trim() || '';
  const activeParamFilters = options.paramFilters || {};
  const folderId = options.folderId;

  // 1. Resolve applicable parameter definitions
  let applicableParams: Array<{
    id: string;
    name: string;
    slug: string;
    valueType: string;
    unit: string | null;
    isRequired: boolean;
  }> = [];

  let subtreeFolderIds: string[] = [];

  if (folderId) {
    // A) Folder-Scoped Mode: Load effective parameters (Universal + Ancestor + Folder)
    const effectiveDefs = await getEffectiveParameterDefinitions(folderId);
    applicableParams = effectiveDefs.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      valueType: p.valueType,
      unit: p.unit,
      isRequired: p.isRequired,
    }));

    // Resolve target folder and all descendant folders in its subtree
    const targetFolder = await prisma.folder.findFirst({
      where: {
        OR: [{ id: folderId }, { entityId: folderId }, { slug: folderId }],
      },
      select: { id: true, materializedPath: true },
    });

    if (targetFolder) {
      const descendantFolders = await prisma.folder.findMany({
        where: {
          OR: [
            { id: targetFolder.id },
            { materializedPath: { startsWith: targetFolder.materializedPath } },
            { materializedPath: { contains: targetFolder.id } },
          ],
        },
        select: { id: true },
      });
      subtreeFolderIds = descendantFolders.map((f) => f.id);
    } else {
      subtreeFolderIds = [folderId];
    }
  } else {
    // B) Root Universal Mode: Load global parameter definitions
    const universalDefs = await getUniversalParameters();
    applicableParams = universalDefs.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      valueType: p.valueType,
      unit: p.unit,
      isRequired: p.isRequired,
    }));
  }

  // 2. Count active filters
  let activeFilterCount = 0;
  if (searchQuery) activeFilterCount++;

  for (const [slug, filter] of Object.entries(activeParamFilters)) {
    if (filter.min !== undefined || filter.max !== undefined) activeFilterCount++;
    else if (filter.boolValue !== undefined) activeFilterCount++;
    else if (filter.textQuery && filter.textQuery.trim().length > 0) activeFilterCount++;
  }

  // 3. Fetch items with relation tree (scoped to subtree if folderId is given)
  const itemWhereClause = folderId && subtreeFolderIds.length > 0
    ? {
        folderItems: {
          some: {
            folderId: { in: subtreeFolderIds },
          },
        },
      }
    : {};

  const items = await prisma.item.findMany({
    where: itemWhereClause,
    include: {
      parameterValues: {
        include: { parameterDefinition: true },
      },
      supplierRecords: {
        orderBy: { createdAt: 'desc' },
      },
      stockSettings: true,
      folderItems: {
        include: {
          folder: {
            select: { id: true, name: true, materializedPath: true },
          },
        },
      },
      entity: {
        include: {
          mediaAttachments: {
            include: { media: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
          },
        },
      },
    },
  });

  // 4. Apply dynamic in-memory filtering
  const filteredItems = items.filter((item) => {
    // A) Stock Status Filter
    if (options.stockFilter === 'OUT_OF_STOCK') {
      const isOut = item.isOutOfStock || (item.quantityMode === 'NUMERIC' && (item.quantity === null || item.quantity <= 0));
      if (!isOut) return false;
    } else if (options.stockFilter === 'LOW_STOCK') {
      const isLow = !item.isOutOfStock && item.quantityMode === 'NUMERIC' && (item.quantity !== null && item.quantity <= 5);
      if (!isLow) return false;
    } else if (options.stockFilter === 'IN_STOCK') {
      const isIn = !item.isOutOfStock && (item.quantityMode !== 'NUMERIC' || (item.quantity !== null && item.quantity > 0));
      if (!isIn) return false;
    }

    // B) General keyword search query (name, location, notes, short codes)
    if (searchQuery) {
      const shortCodes = item.supplierRecords.map((r) => r.shortCode).filter(Boolean).join(' ');
      const combined = [item.name, item.location, item.notes, shortCodes].filter(Boolean).join(' ');
      if (!matchesOrderedPattern(searchQuery, combined)) {
        return false;
      }
    }

    // B) Parameter-based filters
    for (const paramDef of applicableParams) {
      const filter = activeParamFilters[paramDef.slug];
      if (!filter) continue;

      // Find item's value for this parameter
      const itemVal = item.parameterValues.find(
        (pv) =>
          pv.parameterDefinitionId === paramDef.id ||
          pv.parameterDefinition?.slug === paramDef.slug
      );

      // Numeric / Decimal Range Filter
      if (paramDef.valueType === 'NUMBER' || paramDef.valueType === 'DECIMAL') {
        const numVal =
          itemVal?.valueNumber !== null && itemVal?.valueNumber !== undefined
            ? Number(itemVal.valueNumber)
            : null;

        if (filter.min !== undefined) {
          if (numVal === null || numVal < filter.min) return false;
        }
        if (filter.max !== undefined) {
          if (numVal === null || numVal > filter.max) return false;
        }
      }

      // Boolean Filter
      else if (paramDef.valueType === 'BOOLEAN') {
        if (filter.boolValue !== undefined) {
          if (itemVal?.valueBoolean !== filter.boolValue) return false;
        }
      }

      // Text / Select Subsequence Filter
      else if (paramDef.valueType === 'TEXT' || paramDef.valueType === 'SELECT') {
        if (filter.textQuery && filter.textQuery.trim().length > 0) {
          const textVal = itemVal?.valueText || '';
          if (!matchesOrderedPattern(filter.textQuery, textVal)) return false;
        }
      }
    }

    return true;
  });

  // 5. Apply Smart Sorting
  const sortedItems = [...filteredItems].sort((a, b) => {
    const latestRecordA = a.supplierRecords[0];
    const latestRecordB = b.supplierRecords[0];

    const costA = latestRecordA?.costPrice ? Number(latestRecordA.costPrice) : 0;
    const costB = latestRecordB?.costPrice ? Number(latestRecordB.costPrice) : 0;
    const sellA = latestRecordA?.sellingPrice ? Number(latestRecordA.sellingPrice) : 0;
    const sellB = latestRecordB?.sellingPrice ? Number(latestRecordB.sellingPrice) : 0;
    const profitA = sellA - costA;
    const profitB = sellB - costB;

    const soldA = a.stockSettings?.totalSold || 0;
    const soldB = b.stockSettings?.totalSold || 0;
    const viewsA = a.stockSettings?.viewCount || 0;
    const viewsB = b.stockSettings?.viewCount || 0;

    const qtyA = a.quantity ?? 0;
    const qtyB = b.quantity ?? 0;

    switch (sort) {
      case 'MOST_SELLING':
        return soldB - soldA;
      case 'LEAST_SELLING':
        return soldA - soldB;
      case 'MOST_VIEWED':
        return viewsB - viewsA;
      case 'HIGHEST_PROFIT':
        return profitB - profitA;
      case 'LOWEST_PROFIT':
        return profitA - profitB;
      case 'HIGHEST_COST_PRICE':
        return costB - costA;
      case 'LOWEST_COST_PRICE':
        return costA - costB;
      case 'HIGHEST_SELLING_PRICE':
        return sellB - sellA;
      case 'LOWEST_SELLING_PRICE':
        return sellA - sellB;
      case 'QUANTITY_HIGH_TO_LOW':
        return qtyB - qtyA;
      case 'QUANTITY_LOW_TO_HIGH':
        return qtyA - qtyB;
      case 'NAME_ASC':
        return a.name.localeCompare(b.name);
      case 'NAME_DESC':
        return b.name.localeCompare(a.name);
      case 'RECENTLY_UPDATED':
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      case 'RECENTLY_ADDED':
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  // 6. Convert Decimal and complex nested objects into plain serializable JSON objects
  const serializableItems = sortedItems.map((item) => ({
    id: item.id,
    name: item.name,
    location: item.location || null,
    quantityMode: item.quantityMode,
    quantity: item.quantity ?? null,
    isOutOfStock: item.isOutOfStock,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    supplierRecords: item.supplierRecords.map((sr) => ({
      id: sr.id,
      shortCode: sr.shortCode || null,
      costPrice: sr.costPrice ? sr.costPrice.toString() : null,
      sellingPrice: sr.sellingPrice ? sr.sellingPrice.toString() : null,
    })),
    folderItems: item.folderItems.map((fi) => ({
      folder: {
        id: fi.folder.id,
        name: fi.folder.name,
        materializedPath: fi.folder.materializedPath,
      },
    })),
    entity: {
      mediaAttachments:
        item.entity?.mediaAttachments?.map((ma) => ({
          purpose: ma.purpose,
          media: ma.media ? { id: ma.media.id, url: ma.media.url } : null,
        })) || [],
    },
  }));

  return {
    items: serializableItems,
    totalCount: serializableItems.length,
    activeFilterCount,
    hasActiveFilters: activeFilterCount > 0,
    universalParams: applicableParams,
  };
}
