import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { BrandViewSkeletonGrid } from '@/components/knowledge-base/kb-skeletons';

export default function KnowledgeBaseLoading() {
  return (
    <div className="space-y-6 p-2 sm:p-4 animate-in fade-in duration-150">
      {/* Ultra-Premium Header Banner Skeleton */}
      <div className="rounded-3xl bg-white/90 border border-border/80 p-5 sm:p-7 shadow-blend space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 shrink-0" />
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-64 sm:w-80 rounded-xl bg-slate-300/80" />
                <Skeleton className="h-5 w-24 rounded-full bg-slate-200" />
              </div>
              <Skeleton className="h-3.5 w-72 sm:w-96 rounded-md bg-slate-200" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-24 rounded-2xl bg-slate-200" />
            <Skeleton className="h-10 w-32 rounded-2xl bg-slate-200" />
          </div>
        </div>
      </div>

      {/* Filter Bar Skeleton */}
      <div className="flex items-center justify-between gap-3 px-1">
        <Skeleton className="h-4 w-36 rounded bg-slate-200" />
        <Skeleton className="h-9 w-60 rounded-2xl bg-slate-200" />
      </div>

      {/* 15 Brand Folders Grid Skeleton */}
      <BrandViewSkeletonGrid count={15} />
    </div>
  );
}
