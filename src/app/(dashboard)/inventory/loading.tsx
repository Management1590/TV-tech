import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderGridSkeleton } from '@/components/inventory/folder-grid-skeleton';

export default function InventoryLoading() {
  return (
    <div className="space-y-6 p-4 md:p-8 animate-in fade-in duration-200">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-8 w-56 rounded-xl" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-44 rounded-xl" />
        </div>
      </div>

      {/* Action Toolbar Skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>

      {/* Filter / Search Bar Skeleton */}
      <div className="p-4 bg-white border border-border/80 shadow-blend rounded-3xl space-y-3">
        <Skeleton className="h-11 w-full rounded-2xl" />
      </div>

      {/* Folder Grid Skeleton */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-48 rounded-lg" />
        </div>
        <FolderGridSkeleton count={8} />
      </div>
    </div>
  );
}
