'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { FolderCard } from '@/components/inventory/folder-card';
import { FolderGridSkeleton } from '@/components/inventory/folder-grid-skeleton';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ArrowUpDown, FolderOpen, Flame, ArrowDownAZ, ArrowUpAZ, Package } from 'lucide-react';

export type FolderSortMode = 'MOST_OPENED' | 'NAME_ASC' | 'NAME_DESC' | 'MOST_ITEMS';

type FolderGridProps = {
  folders: any[];
  userRole?: string;
  title?: string;
  showSort?: boolean;
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const CHUNK_SIZE = 15;

export function FolderGrid({
  folders,
  userRole = 'STAFF',
  title,
  showSort = true,
}: FolderGridProps) {
  const [folderSort, setFolderSort] = useState<FolderSortMode>('MOST_OPENED');

  // Sort folders based on selected option
  const sortedFolders = useMemo(() => {
    const list = [...folders];
    switch (folderSort) {
      case 'NAME_ASC':
        return list.sort((a, b) =>
          (a.name || '').localeCompare(b.name || '', undefined, {
            numeric: true,
            sensitivity: 'base',
          })
        );
      case 'NAME_DESC':
        return list.sort((a, b) =>
          (b.name || '').localeCompare(a.name || '', undefined, {
            numeric: true,
            sensitivity: 'base',
          })
        );
      case 'MOST_ITEMS':
        return list.sort((a, b) => {
          const aCount = a._count?.folderItems ?? a.itemCount ?? 0;
          const bCount = b._count?.folderItems ?? b.itemCount ?? 0;
          return bCount - aCount;
        });
      case 'MOST_OPENED':
      default:
        return list.sort((a, b) => (b.openCount ?? 0) - (a.openCount ?? 0));
    }
  }, [folders, folderSort]);

  // Progressive chunk loading with Session Storage scroll & count persistence
  const [visibleCount, setVisibleCount] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const lastElementId = sessionStorage.getItem('last_active_element_id');
      if (lastElementId && lastElementId.startsWith('folder-card-')) {
        const targetFolderId = lastElementId.replace('folder-card-', '');
        const foundIdx = folders.findIndex((f) => f.id === targetFolderId);
        if (foundIdx !== -1) {
          return Math.max(CHUNK_SIZE, Math.min(folders.length, foundIdx + 8));
        }
      }
      const savedCount = sessionStorage.getItem('inventory_folder_grid_visible_count');
      if (savedCount) return Math.max(CHUNK_SIZE, parseInt(savedCount, 10));
    }
    return CHUNK_SIZE;
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Restore previous scroll position on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedScroll = sessionStorage.getItem('inventory_scroll_y');
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
        sessionStorage.setItem('inventory_scroll_y', window.scrollY.toString());
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const loadNextChunk = useCallback(() => {
    if (visibleCount >= sortedFolders.length || isLoadingMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => {
        const next = Math.min(prev + CHUNK_SIZE, sortedFolders.length);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('inventory_folder_grid_visible_count', next.toString());
        }
        return next;
      });
      setIsLoadingMore(false);
    }, 120);
  }, [visibleCount, sortedFolders.length, isLoadingMore]);

  const triggerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && visibleCount < sortedFolders.length) {
            loadNextChunk();
          }
        },
        { rootMargin: '200px' }
      );

      observerRef.current.observe(node);
    },
    [visibleCount, sortedFolders.length, loadNextChunk]
  );

  const visibleFolders = sortedFolders.slice(0, visibleCount);
  const triggerIndex = Math.max(0, visibleCount - 6);

  return (
    <div className="space-y-4">
      {/* Folder Sort & Summary Header */}
      {showSort && folders.length > 0 && (
        <div className="flex items-center justify-between gap-2 pb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <FolderOpen className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="text-xs font-bold text-foreground truncate">
              {title || `Folders (${folders.length})`}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="hidden sm:flex text-xs text-muted-foreground font-semibold items-center gap-1">
              <ArrowUpDown className="w-3 h-3 text-primary" />
              Sort Directory:
            </span>
            <Select
              value={folderSort}
              onValueChange={(val: string | null) => {
                if (val) setFolderSort(val as FolderSortMode);
              }}
            >
              <SelectTrigger className="h-8 w-[135px] sm:w-[190px] text-xs font-semibold bg-card border-border text-foreground rounded-xl shadow-2xs hover:bg-muted/50 focus:ring-primary">
                <SelectValue placeholder="Sort folders..." />
              </SelectTrigger>
              <SelectContent className="bg-background border-border text-foreground text-xs shadow-lg rounded-xl">
                <SelectItem value="MOST_OPENED">
                  <span className="flex items-center gap-1.5 font-medium text-amber-600">
                    <Flame className="w-3.5 h-3.5 text-amber-600" />
                    Most Opened
                  </span>
                </SelectItem>
                <SelectItem value="NAME_ASC">
                  <span className="flex items-center gap-1.5 font-medium">
                    <ArrowDownAZ className="w-3.5 h-3.5 text-primary" />
                    Name (A → Z)
                  </span>
                </SelectItem>
                <SelectItem value="NAME_DESC">
                  <span className="flex items-center gap-1.5 font-medium">
                    <ArrowUpAZ className="w-3.5 h-3.5 text-primary" />
                    Name (Z → A)
                  </span>
                </SelectItem>
                <SelectItem value="MOST_ITEMS">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Package className="w-3.5 h-3.5 text-emerald-600" />
                    Most Items
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6"
      >
        {visibleFolders.map((folder, idx) => {
          const isTrigger = idx === triggerIndex;
          return (
            <motion.div
              key={folder.id}
              ref={isTrigger ? triggerRef : undefined}
              variants={item}
              className="h-full"
            >
              <FolderCard
                folder={folder}
                linkHref={`/inventory/folders/${folder.id}`}
                userRole={userRole}
              />
            </motion.div>
          );
        })}
      </motion.div>

      {/* Loading More Folder Skeletons */}
      {isLoadingMore && (
        <div className="pt-2">
          <FolderGridSkeleton count={Math.min(4, sortedFolders.length - visibleCount)} />
        </div>
      )}

      {/* Load More Button fallback if scrolling doesn't trigger */}
      {visibleCount < sortedFolders.length && (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={loadNextChunk}
            disabled={isLoadingMore}
            className="text-xs font-semibold rounded-xl bg-card hover:bg-muted/50 border-border/80 text-muted-foreground gap-2 cursor-pointer"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                Loading categories...
              </>
            ) : (
              `Load more (${sortedFolders.length - visibleCount} remaining)`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
