'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Package, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter, usePathname } from 'next/navigation';
import { ItemCard } from './item-card';

interface FilteredItemGridProps {
  items: any[];
  userRole?: string;
  hasActiveFilters?: boolean;
}

const CHUNK_SIZE = 15;

export function FilteredItemGrid({
  items,
  userRole = 'STAFF',
  hasActiveFilters = false,
}: FilteredItemGridProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Progressive batch loading state
  const [visibleCount, setVisibleCount] = useState(CHUNK_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Reset visible count when item list changes
  useEffect(() => {
    setVisibleCount(CHUNK_SIZE);
  }, [items]);

  // Load next chunk with snappy transition
  const loadNextChunk = useCallback(() => {
    if (visibleCount >= items.length || isLoadingMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + CHUNK_SIZE, items.length));
      setIsLoadingMore(false);
    }, 120); // Snappy 120ms progressive load
  }, [visibleCount, items.length, isLoadingMore]);

  // Trigger element ref (placed at the 10th item threshold)
  const triggerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && visibleCount < items.length) {
            loadNextChunk();
          }
        },
        { rootMargin: '200px' }
      );

      observerRef.current.observe(node);
    },
    [visibleCount, items.length, loadNextChunk]
  );

  if (items.length === 0) {
    return (
      <div className="glass-panel flex flex-col items-center justify-center p-12 rounded-3xl text-center border border-border border-dashed min-h-[350px]">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Package className="w-8 h-8 text-primary/60" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-1">No items matched your filter</h3>
        <p className="text-muted-foreground text-xs max-w-sm mb-6">
          Try adjusting your universal parameter ranges or clearing keyword filters to see more results.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.replace(pathname)}
          className="gap-2 bg-muted border-border text-foreground rounded-xl hover:bg-muted"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
        </Button>
      </div>
    );
  }

  const visibleItems = items.slice(0, visibleCount);
  const triggerIndex = Math.max(0, visibleCount - 6); // Trigger next batch when reaching item 10 of 15

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {visibleItems.map((item, idx) => {
          const isTriggerItem = idx === triggerIndex;

          return (
            <div
              key={item.id}
              ref={isTriggerItem ? triggerRef : undefined}
              className="h-full"
            >
              <ItemCard
                item={item}
                userRole={userRole}
              />
            </div>
          );
        })}
      </div>

      {/* Loading More Skeletons when fetching next 15 items */}
      {isLoadingMore && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pt-2">
          {Array.from({ length: Math.min(4, items.length - visibleCount) }).map((_, i) => (
            <div
              key={i}
              className="glass-card overflow-hidden rounded-2xl border border-border/80 bg-muted/50 shadow-blend flex flex-col justify-between"
            >
              <div className="aspect-[16/10] w-full bg-muted/80 animate-pulse" />
              <div className="p-4 space-y-3 bg-white/95">
                <Skeleton className="h-4 w-3/4 bg-muted rounded-md" />
                <div className="flex gap-2">
                  <Skeleton className="h-3 w-16 bg-muted rounded" />
                  <Skeleton className="h-4 w-12 bg-muted rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* End of list count indicator */}
      {visibleCount < items.length && (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={loadNextChunk}
            disabled={isLoadingMore}
            className="text-xs font-semibold rounded-xl bg-white hover:bg-muted/50 border-border/80 text-muted-foreground gap-2 cursor-pointer"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                Loading items...
              </>
            ) : (
              `Load more (${items.length - visibleCount} remaining)`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
