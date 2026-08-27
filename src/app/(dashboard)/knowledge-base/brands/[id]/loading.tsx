import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ModelViewSkeletonList } from '@/components/knowledge-base/kb-skeletons';

export default function TvBrandDetailLoading() {
  return (
    <div className="space-y-6 p-2 sm:p-4 animate-in fade-in duration-150">
      {/* Breadcrumb Skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3.5 w-24 rounded bg-slate-200" />
        <Skeleton className="h-3 w-3 rounded bg-slate-200" />
        <Skeleton className="h-3.5 w-20 rounded bg-slate-300" />
      </div>

      {/* Brand Header Banner Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-7 bg-white/90 border border-border/80 rounded-3xl shadow-blend">
        <div className="flex items-center gap-4">
          <div className="w-20 sm:w-24 h-16 rounded-2xl bg-slate-100 border border-slate-200" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-44 rounded-xl bg-slate-300/80" />
            <Skeleton className="h-3.5 w-72 rounded-md bg-slate-200" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-24 rounded-2xl bg-slate-200" />
          <Skeleton className="h-10 w-32 rounded-2xl bg-slate-200" />
        </div>
      </div>

      {/* Search & Filter Bar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Skeleton className="h-10.5 w-full sm:w-80 md:w-96 rounded-2xl bg-slate-200/80" />
        <Skeleton className="h-9 w-60 rounded-2xl bg-slate-200" />
      </div>

      {/* 15 Model Rows Skeleton List */}
      <ModelViewSkeletonList count={15} />
    </div>
  );
}
