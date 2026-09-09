'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ItemGridSkeletonProps {
  count?: number;
}

export function ItemGridSkeleton({ count = 8 }: ItemGridSkeletonProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in duration-200">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="glass-card overflow-hidden h-full rounded-2xl border border-border/90 bg-muted/50 flex flex-col justify-between shadow-blend"
        >
          <div>
            {/* Seamless Aspect-ratio Image Shimmer (Zero Gap on Top) */}
            <div className="relative aspect-[16/10] w-full bg-muted/80 overflow-hidden border-b border-border/70 rounded-t-2xl">
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent" />
            </div>

            <div className="p-4 space-y-3 bg-white/95">
              {/* Title & Badge */}
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-4 w-3/4 bg-muted rounded-md" />
                <Skeleton className="h-4 w-16 bg-muted rounded-full shrink-0" />
              </div>

              {/* Location & Short code pill */}
              <div className="flex items-center gap-3 pt-1">
                <Skeleton className="h-3.5 w-20 bg-muted rounded" />
                <Skeleton className="h-4 w-14 bg-muted rounded-md" />
              </div>

              {/* Price skeleton */}
              <div className="flex items-baseline gap-2 pt-2 border-t border-border/60">
                <Skeleton className="h-5 w-20 bg-muted rounded-md" />
                <Skeleton className="h-3 w-12 bg-muted rounded" />
              </div>
            </div>
          </div>

          {/* Folder location footer skeleton */}
          <div className="px-4 py-2.5 bg-muted border-t border-border/80 flex items-center justify-between rounded-b-2xl">
            <Skeleton className="h-3.5 w-28 bg-muted rounded" />
            <Skeleton className="h-3.5 w-3.5 bg-muted rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
