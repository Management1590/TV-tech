import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6 p-4 md:p-8 animate-in fade-in duration-200">
      {/* Header Skeleton */}
      <div className="space-y-2 border-b border-border/80 pb-5">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-8 w-64 rounded-xl" />
      </div>

      {/* KPI Stats Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="bg-white border border-border/80 shadow-blend rounded-3xl p-5 space-y-3">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-7 w-20 rounded-lg" />
          </Card>
        ))}
      </div>

      {/* Chart Skeleton */}
      <Card className="bg-white border border-border/80 shadow-blend rounded-3xl p-6 space-y-4">
        <Skeleton className="h-6 w-48 rounded-lg" />
        <div className="h-72 w-full bg-slate-50 rounded-2xl border border-dashed border-border/80 flex items-center justify-center">
          <Skeleton className="h-4 w-36 rounded" />
        </div>
      </Card>
    </div>
  );
}
