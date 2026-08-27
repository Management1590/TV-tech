import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export default function SearchLoading() {
  return (
    <div className="space-y-6 p-4 md:p-8 animate-in fade-in duration-200">
      {/* Search Header Skeleton */}
      <div className="space-y-2 border-b border-border/80 pb-5">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-8 w-56 rounded-xl" />
      </div>

      {/* Big Search Input Skeleton */}
      <div className="p-4 bg-white border border-border/80 shadow-blend rounded-3xl">
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>

      {/* Results Skeleton List */}
      <div className="space-y-4">
        <Skeleton className="h-4 w-40 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="bg-white border border-border/80 shadow-blend rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
