import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderContentSkeleton } from '@/components/knowledge-base/kb-skeletons';

export default function KbFolderContentViewerLoading() {
  return (
    <div className="space-y-6 p-2 sm:p-4 animate-in fade-in duration-150">
      {/* Breadcrumbs Skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3.5 w-24 rounded bg-slate-200" />
        <Skeleton className="h-3 w-3 rounded bg-slate-200" />
        <Skeleton className="h-3.5 w-16 rounded bg-slate-200" />
        <Skeleton className="h-3 w-3 rounded bg-slate-200" />
        <Skeleton className="h-3.5 w-20 rounded bg-slate-200" />
        <Skeleton className="h-3 w-3 rounded bg-slate-200" />
        <Skeleton className="h-3.5 w-24 rounded bg-slate-300" />
      </div>

      {/* Header Banner Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-7 bg-white/90 border border-border/80 rounded-3xl shadow-blend">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 shrink-0" />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-40 rounded-xl bg-slate-300/80" />
              <Skeleton className="h-5 w-20 rounded-full bg-slate-200" />
            </div>
            <Skeleton className="h-3.5 w-64 rounded-md bg-slate-200" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-28 rounded-2xl bg-slate-200" />
        </div>
      </div>

      {/* Complete Folder Content Skeleton: Gallery, Audio, Documents */}
      <FolderContentSkeleton />
    </div>
  );
}
