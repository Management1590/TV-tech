'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Package, FolderOpen, Loader2 } from 'lucide-react';
import { UniversalItemFilter, UniversalParamDef } from './universal-item-filter';
import { FilteredItemGrid } from './filtered-item-grid';
import { ItemGridSkeleton } from './item-grid-skeleton';
import { FolderGrid } from '@/app/(dashboard)/inventory/folder-grid';
import { CreateFolderDialog } from './create-folder-dialog';

interface InventoryViewContainerProps {
  universalParams: UniversalParamDef[];
  totalMatches: number;
  items: any[];
  folders: any[];
  userRole?: string;
  isFilterOrSortActive: boolean;
}

export function InventoryViewContainer({
  universalParams,
  totalMatches,
  items,
  folders,
  userRole = 'STAFF',
  isFilterOrSortActive,
}: InventoryViewContainerProps) {
  const searchParams = useSearchParams();
  const [isSearching, setIsSearching] = useState(false);

  // When items prop updates from server component, reset searching state
  useEffect(() => {
    setIsSearching(false);
  }, [items]);

  return (
    <div className="space-y-6">
      {/* Universal Parameter Filter & Quick Search Bar */}
      <UniversalItemFilter
        universalParams={universalParams}
        totalMatches={totalMatches}
        onSearchStateChange={setIsSearching}
      />

      {/* Main Content: Skeleton OR Filtered Grid OR Folder Hierarchy */}
      {isSearching ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              Searching inventory items...
            </h2>
          </div>
          <ItemGridSkeleton count={8} />
        </div>
      ) : isFilterOrSortActive ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <span>
                {searchParams?.get('stock') === 'out'
                  ? `Showing Out of Stock Items (${totalMatches})`
                  : searchParams?.get('stock') === 'low'
                  ? `Showing Low Stock Items (${totalMatches})`
                  : searchParams?.get('view') === 'all'
                  ? `Showing All Catalog Items (${totalMatches})`
                  : `Showing Filtered Items (${totalMatches})`}
              </span>
            </h2>
            <Link
              href="/inventory"
              className="text-xs text-primary hover:text-primary/80 transition-colors font-medium hover:underline"
            >
              View Categories / Folders →
            </Link>
          </div>
          <FilteredItemGrid
            items={items}
            userRole={userRole}
            hasActiveFilters={isFilterOrSortActive}
          />
        </div>
      ) : folders.length === 0 ? (
        <div className="glass-panel flex flex-col items-center justify-center p-12 rounded-3xl text-center border border-border border-dashed min-h-[400px]">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <FolderOpen className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">No folders found</h2>
          <p className="text-muted-foreground max-w-md mb-8">
            Create your first inventory folder to start organizing your spare parts and electronics components.
          </p>
          <CreateFolderDialog />
        </div>
      ) : (
        <div className="space-y-4">
          <FolderGrid
            folders={folders}
            userRole={userRole}
            title={`Categories & Root Folders (${folders.length})`}
            showSort={true}
          />
        </div>
      )}
    </div>
  );
}
