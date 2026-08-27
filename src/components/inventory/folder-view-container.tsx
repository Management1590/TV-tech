'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Package, MapPin, Tag, ArrowRight, Loader2, FolderOpen } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatShortCode } from '@/lib/utils';
import { formatMoney } from '@/lib/config/currency';
import { UniversalItemFilter, UniversalParamDef } from './universal-item-filter';
import { FilteredItemGrid } from './filtered-item-grid';
import { ItemGridSkeleton } from './item-grid-skeleton';
import { FolderGrid } from '@/app/(dashboard)/inventory/folder-grid';
import { ItemCard } from './item-card';
import { parseThumbnailUrl } from '@/lib/thumbnail-utils';

interface FolderViewContainerProps {
  folder: {
    id: string;
    name: string;
    description?: string | null;
    children: any[];
    folderItems: any[];
  };
  path: string[];
  effectiveParams: UniversalParamDef[];
  filteredItems: any[];
  totalMatches: number;
  userRole?: string;
  isFilterOrSortActive: boolean;
}

const CHUNK_SIZE = 15;

export function FolderViewContainer({
  folder,
  path,
  effectiveParams,
  filteredItems,
  totalMatches,
  userRole = 'STAFF',
  isFilterOrSortActive,
}: FolderViewContainerProps) {
  const [isSearching, setIsSearching] = useState(false);
  const scrollKey = `folder_view_scroll_${folder.id}`;
  const visibleCountKey = `folder_view_items_count_${folder.id}`;

  // Progressive batch loading for direct items with session storage persistence
  const [visibleItemsCount, setVisibleItemsCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const lastElementId = sessionStorage.getItem('last_active_element_id');
      if (lastElementId && lastElementId.startsWith('item-card-')) {
        const targetItemId = lastElementId.replace('item-card-', '');
        const foundIdx = folder.folderItems.findIndex(
          (fi: any) => fi.item?.id === targetItemId || fi.id === targetItemId
        );
        if (foundIdx !== -1) {
          return Math.max(CHUNK_SIZE, Math.min(folder.folderItems.length, foundIdx + 8));
        }
      }
      const savedCount = sessionStorage.getItem(visibleCountKey);
      if (savedCount) return Math.max(CHUNK_SIZE, parseInt(savedCount, 10));
    }
    return CHUNK_SIZE;
  });
  const [isLoadingMoreItems, setIsLoadingMoreItems] = useState(false);
  const itemsObserverRef = useRef<IntersectionObserver | null>(null);

  // Restore scroll position on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedScroll = sessionStorage.getItem(scrollKey);
    if (savedScroll) {
      const targetY = parseInt(savedScroll, 10);
      if (!isNaN(targetY) && targetY > 0) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: targetY, behavior: 'instant' });
        });
      }
    }

    const handleScroll = () => {
      if (window.scrollY > 0) {
        sessionStorage.setItem(scrollKey, window.scrollY.toString());
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrollKey]);

  // When filteredItems update from server, clear searching skeleton
  useEffect(() => {
    setIsSearching(false);
  }, [filteredItems, folder]);

  const loadNextItemsChunk = useCallback(() => {
    if (visibleItemsCount >= folder.folderItems.length || isLoadingMoreItems) return;
    setIsLoadingMoreItems(true);
    setTimeout(() => {
      setVisibleItemsCount((prev) => {
        const next = Math.min(prev + CHUNK_SIZE, folder.folderItems.length);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(visibleCountKey, next.toString());
        }
        return next;
      });
      setIsLoadingMoreItems(false);
    }, 120);
  }, [visibleItemsCount, folder.folderItems.length, isLoadingMoreItems, visibleCountKey]);

  const itemsTriggerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (itemsObserverRef.current) itemsObserverRef.current.disconnect();
      if (!node) return;

      itemsObserverRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && visibleItemsCount < folder.folderItems.length) {
            loadNextItemsChunk();
          }
        },
        { rootMargin: '200px' }
      );

      itemsObserverRef.current.observe(node);
    },
    [visibleItemsCount, folder.folderItems.length, loadNextItemsChunk]
  );

  const hasChildren = folder.children && folder.children.length > 0;
  const hasItems = folder.folderItems && folder.folderItems.length > 0;

  const visibleFolderItems = (folder.folderItems || []).slice(0, visibleItemsCount);
  const itemTriggerIndex = Math.max(0, visibleItemsCount - 6);

  return (
    <div className="space-y-6">
      {/* Folder-Scoped Dynamic Filter & Real-Time Search Bar */}
      <UniversalItemFilter
        universalParams={effectiveParams}
        totalMatches={totalMatches}
        onSearchStateChange={setIsSearching}
        folderName={folder.name}
      />

      {/* Main Content Area */}
      {isSearching ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              Searching items in {folder.name} & subfolders...
            </h2>
          </div>
          <ItemGridSkeleton count={8} />
        </div>
      ) : isFilterOrSortActive ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              Showing Filtered Items in &ldquo;{folder.name}&rdquo; ({totalMatches})
            </h2>
            <Link
              href={`/inventory/folders/${path.join('/')}`}
              className="text-xs text-primary hover:text-primary/80 transition-colors font-medium hover:underline"
            >
              Reset to Folder View →
            </Link>
          </div>
          <FilteredItemGrid
            items={filteredItems}
            userRole={userRole}
            hasActiveFilters={isFilterOrSortActive}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Sub-folders Grid with Progressive Loading & Directory Sorting */}
          {hasChildren && (
            <div className="space-y-3">
              <FolderGrid
                folders={folder.children}
                userRole={userRole}
                title={`Sub-folders in ${folder.name} (${folder.children.length})`}
                showSort={true}
              />
            </div>
          )}

          {/* Direct Items Grid with Progressive 15-Item Chunking */}
          {hasItems && (
            <div className="space-y-3">
              <h2 className="text-xs uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-primary" />
                Direct Items ({folder.folderItems.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibleFolderItems.map((fi, idx) => {
                  const item = fi.item;
                  const isTrigger = idx === itemTriggerIndex;

                  return (
                    <div
                      key={item.id}
                      ref={isTrigger ? itemsTriggerRef : undefined}
                      className="h-full"
                    >
                      <ItemCard
                        item={item}
                        folderId={folder.id}
                        folderName={folder.name}
                        userRole={userRole}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Loading More Item Skeletons */}
              {isLoadingMoreItems && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-2">
                  {Array.from({ length: Math.min(4, folder.folderItems.length - visibleItemsCount) }).map((_, i) => (
                    <div
                      key={i}
                      className="glass-card overflow-hidden rounded-2xl border border-border/80 bg-slate-50/70 shadow-blend flex flex-col justify-between"
                    >
                      <div className="aspect-[16/10] w-full bg-slate-200/80 animate-pulse" />
                      <div className="p-4 space-y-3 bg-white/95">
                        <Skeleton className="h-4 w-3/4 bg-slate-100 rounded-md" />
                        <div className="flex gap-2">
                          <Skeleton className="h-3 w-16 bg-slate-100 rounded" />
                          <Skeleton className="h-4 w-12 bg-slate-100 rounded" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Load More Button fallback */}
              {visibleItemsCount < folder.folderItems.length && (
                <div className="flex justify-center pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={loadNextItemsChunk}
                    disabled={isLoadingMoreItems}
                    className="text-xs font-semibold rounded-xl bg-white hover:bg-slate-50 border-border/80 text-muted-foreground gap-2 cursor-pointer"
                  >
                    {isLoadingMoreItems ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                        Loading items...
                      </>
                    ) : (
                      `Load more (${folder.folderItems.length - visibleItemsCount} remaining)`
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
