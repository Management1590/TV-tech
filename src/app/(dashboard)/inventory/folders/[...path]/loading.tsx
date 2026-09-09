import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ItemGridSkeleton } from '@/components/inventory/item-grid-skeleton';
import { FolderGridSkeleton } from '@/components/inventory/folder-grid-skeleton';

export default function SubFolderLoading() {
  return (
    <div className="space-y-6 p-4 md:p-8 animate-in fade-in duration-200">
      {/* Breadcrumb & Subfolder Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40 rounded" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-60 rounded-xl" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-44 rounded-xl" />
        </div>
      </div>

      {/* Action Toolbar Skeleton (New Folder, New Item, Link Existing Item) */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 w-36 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>

      {/* Dynamic Filter / Search Bar Skeleton */}
      <div className="p-4 bg-white border border-border/80 shadow-blend rounded-3xl space-y-3">
        <Skeleton className="h-11 w-full rounded-2xl" />
      </div>

      {/* Subfolder & Items Grid Skeletons */}
      <div className="space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32 rounded-md" />
          <FolderGridSkeleton count={4} />
        </div>

        <div className="space-y-3 pt-2">
          <Skeleton className="h-4 w-32 rounded-md" />
          <ItemGridSkeleton count={8} />
        </div>
      </div>
    </div>
  );
}
