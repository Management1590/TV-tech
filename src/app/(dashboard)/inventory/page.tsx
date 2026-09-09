import React from 'react';
import Link from 'next/link';
import { ChevronRight, FolderOpen, Package } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import { CreateFolderDialog } from '@/components/inventory/create-folder-dialog';
import { ManageParametersDialog } from '@/components/inventory/manage-parameters-dialog';
import { InventoryViewContainer } from '@/components/inventory/inventory-view-container';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { SmartSortMode } from '@/features/analytics/services/analytics.service';
import { filterUniversalInventoryItems } from '@/features/inventory/services/inventory-filter.service';

export const dynamic = 'force-dynamic';

export default async function InventoryRootPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const user = await getCurrentUser();
  const userRole = user?.role || 'STAFF';

  // Fetch total item count across DB
  const totalItemCount = await prisma.item.count().catch(() => 0);

  // Extract query, sort, and parameter filters from searchParams
  const q = typeof searchParams.q === 'string' ? searchParams.q : undefined;
  const sort =
    typeof searchParams.sort === 'string' && searchParams.sort !== 'NONE'
      ? (searchParams.sort as SmartSortMode)
      : undefined;

  const paramFilters: Record<
    string,
    { min?: number; max?: number; boolValue?: boolean; textQuery?: string }
  > = {};

  for (const [key, val] of Object.entries(searchParams)) {
    if (typeof val !== 'string' || !val) continue;
    if (key.startsWith('p_') && key.endsWith('_min')) {
      const slug = key.slice(2, -4);
      if (!paramFilters[slug]) paramFilters[slug] = {};
      paramFilters[slug].min = Number(val);
    } else if (key.startsWith('p_') && key.endsWith('_max')) {
      const slug = key.slice(2, -4);
      if (!paramFilters[slug]) paramFilters[slug] = {};
      paramFilters[slug].max = Number(val);
    } else if (key.startsWith('p_') && key.endsWith('_bool')) {
      const slug = key.slice(2, -5);
      if (!paramFilters[slug]) paramFilters[slug] = {};
      paramFilters[slug].boolValue = val === 'true';
    } else if (key.startsWith('p_') && key.endsWith('_text')) {
      const slug = key.slice(2, -5);
      if (!paramFilters[slug]) paramFilters[slug] = {};
      paramFilters[slug].textQuery = val;
    }
  }

  const view = typeof searchParams.view === 'string' ? searchParams.view : undefined;
  const stock = typeof searchParams.stock === 'string' ? searchParams.stock : undefined;
  const stockFilter =
    stock === 'out' ? 'OUT_OF_STOCK' : stock === 'low' ? 'LOW_STOCK' : stock === 'in' ? 'IN_STOCK' : undefined;

  const isFilterOrSortActive =
    !!q || Object.keys(paramFilters).length > 0 || !!sort || view === 'all' || !!stockFilter;

  // Fetch universal parameter definitions and execute dynamic cross-folder filter
  let filterResult: any = {
    items: [],
    universalParams: [],
    totalMatches: 0,
  };
  try {
    filterResult = await filterUniversalInventoryItems({
      searchQuery: q,
      sortMode: sort,
      stockFilter,
      viewAll: view === 'all',
      paramFilters,
    });
  } catch (err) {
    console.error('Inventory universal filter error:', err);
  }

  // Fetch root folders
  const folders = await prisma.folder.findMany({
    where: { parentId: null },
    orderBy: [
      { openCount: 'desc' },
      { sortOrder: 'asc' },
    ],
    include: {
      _count: {
        select: {
          folderItems: true,
          children: true,
        },
      },
    },
  }).catch((err) => {
    console.error('Fetch root folders error:', err);
    return [];
  });

  // Fetch all folders for parameter management
  const allFolders = await prisma.folder.findMany({
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      parameterDefinitions: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  }).catch((err) => {
    console.error('Fetch all folders error:', err);
    return [];
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb & Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3 sm:pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {userRole === 'ADMIN' && (
              <>
                <Link href="/" className="hover:text-foreground">
                  Dashboard
                </Link>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              </>
            )}
            <span className="text-foreground font-medium">Inventory</span>
          </div>
          <div className="flex items-center gap-2.5 mt-0.5 sm:mt-1">
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">
              Inventory
            </h1>
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary border-primary/20 px-2 py-0.5 text-[11px] sm:text-xs font-semibold rounded-full"
            >
              {totalItemCount} Items
            </Badge>
          </div>
        </div>

        {/* Action Buttons: New Folder (Primary) & Parameters */}
        {userRole === 'ADMIN' && (
          <div className="flex items-center gap-2 shrink-0">
            <CreateFolderDialog />
            <ManageParametersDialog
              universalParameters={(filterResult.universalParams || []).map((p: any) => ({
                id: p.id,
                name: p.name,
                slug: p.slug,
                valueType: p.valueType,
                unit: p.unit,
                isRequired: p.isRequired,
              }))}
              folders={allFolders.map((f) => ({
                id: f.id,
                name: f.name,
                parameterDefinitions: f.parameterDefinitions.map((p) => ({
                  id: p.id,
                  name: p.name,
                  slug: p.slug,
                  valueType: p.valueType,
                  unit: p.unit,
                  isRequired: p.isRequired,
                })),
              }))}
            />
          </div>
        )}
      </div>

      {/* Main Inventory View with Instant Live Skeleton Feedback */}
      <InventoryViewContainer
        universalParams={(filterResult.universalParams || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          valueType: p.valueType,
          unit: p.unit,
          isRequired: p.isRequired,
        }))}
        totalMatches={filterResult.totalMatches ?? filterResult.totalCount ?? 0}
        items={filterResult.items || []}
        folders={folders}
        userRole={userRole}
        isFilterOrSortActive={isFilterOrSortActive}
      />
    </div>
  );
}
