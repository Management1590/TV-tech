import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export default function DashboardLoading() {
  return (
    <div className="space-y-8 p-4 md:p-8 animate-in fade-in duration-200">
      {/* Premium Dashboard Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-36 rounded-full" />
          <Skeleton className="h-9 w-64 rounded-xl" />
          <Skeleton className="h-4 w-48 rounded" />
        </div>
        <Skeleton className="h-9 w-32 rounded-full self-start sm:self-auto" />
      </div>

      {/* 4 Interactive KPI Stat Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-white border border-border/80 shadow-blend rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="w-10 h-10 rounded-2xl" />
              <Skeleton className="w-5 h-5 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
            <Skeleton className="h-3 w-32 rounded" />
          </Card>
        ))}
      </div>

      {/* Navigation Action Bar Skeleton */}
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-44 rounded-2xl" />
        ))}
      </div>

      {/* Interactive Analytics & Financial Graphs Skeleton */}
      <Card className="bg-white border border-border/80 shadow-blend rounded-3xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/70 pb-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-60 rounded-lg" />
            <Skeleton className="h-3.5 w-80 rounded" />
          </div>
          <Skeleton className="h-9 w-72 rounded-xl" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-3.5 bg-slate-50/90 border border-border/70 rounded-2xl space-y-2">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-6 w-28 rounded-md" />
              <Skeleton className="h-2.5 w-36 rounded" />
            </div>
          ))}
        </div>

        <div className="h-72 w-full bg-slate-50/80 rounded-2xl border border-dashed border-border/80 flex items-center justify-center">
          <div className="space-y-2 text-center">
            <Skeleton className="h-4 w-40 mx-auto rounded" />
            <Skeleton className="h-3 w-28 mx-auto rounded" />
          </div>
        </div>
      </Card>

      {/* Bottom Grid: Most Selling & Activity Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-6 w-44 rounded-lg" />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="min-w-[280px] p-4 space-y-3 bg-white border border-border/80 shadow-blend rounded-2xl">
                <Skeleton className="h-4 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
                <Skeleton className="h-4 w-1/3 rounded" />
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Skeleton className="h-6 w-36 rounded-lg" />
          <Card className="bg-white border border-border/80 shadow-blend rounded-2xl p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-border/60 last:border-0">
                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3.5 w-3/4 rounded" />
                  <Skeleton className="h-2.5 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
