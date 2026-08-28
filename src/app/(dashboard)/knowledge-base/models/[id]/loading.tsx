import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { BrandFolderCardSkeleton } from '@/components/knowledge-base/kb-skeletons';

export default function TvModelDetailLoading() {
  return (
    <div className="space-y-6 p-2 sm:p-4 animate-in fade-in duration-150">
      {/* Breadcrumb Skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3.5 w-24 rounded bg-muted" />
        <Skeleton className="h-3 w-3 rounded bg-muted" />
        <Skeleton className="h-3.5 w-16 rounded bg-muted" />
        <Skeleton className="h-3 w-3 rounded bg-muted" />
        <Skeleton className="h-3.5 w-24 rounded bg-muted/80" />
      </div>

      {/* Model Header Banner Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white border border-border/80 rounded-3xl shadow-blend">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-muted/50 border border-border shrink-0" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-48 rounded-xl bg-muted/70" />
              <Skeleton className="h-5 w-14 rounded-full bg-muted" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-3.5 w-32 rounded bg-muted" />
              <Skeleton className="h-3.5 w-40 rounded bg-muted" />
            </div>
          </div>
        </div>

        <Skeleton className="h-10 w-10 rounded-2xl bg-muted" />
      </div>

      {/* Folders Section Skeleton */}
      <div className="space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-5 w-44 rounded-lg bg-muted/70" />
          <Skeleton className="h-3 w-72 rounded bg-muted" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
          <BrandFolderCardSkeleton />
          <BrandFolderCardSkeleton />
        </div>
      </div>
    </div>
  );
}

