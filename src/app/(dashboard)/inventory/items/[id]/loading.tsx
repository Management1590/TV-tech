import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export default function ItemDetailLoading() {
  return (
    <div className="space-y-6 p-4 md:p-8 animate-in fade-in duration-200">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-36 rounded" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-72 rounded-xl" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-28 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      {/* Main Content: 2-Column Product Showcase Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Image Gallery Skeleton */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="bg-white border border-border/80 shadow-blend rounded-3xl overflow-hidden p-4 space-y-4">
            <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
            <div className="flex gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="w-16 h-16 rounded-xl shrink-0" />
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: Specs, Price codes & stock history Skeleton */}
        <div className="lg:col-span-7 space-y-5">
          {/* Price & Code Card */}
          <Card className="bg-white border border-border/80 shadow-blend rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-32 rounded-md" />
              <Skeleton className="h-7 w-24 rounded-lg" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-3 bg-slate-50 border border-border/60 rounded-xl space-y-1.5">
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-5 w-24 rounded" />
                </div>
              ))}
            </div>
          </Card>

          {/* Parameters & Attributes Card */}
          <Card className="bg-white border border-border/80 shadow-blend rounded-3xl p-6 space-y-4">
            <Skeleton className="h-5 w-44 rounded-md" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-3 bg-slate-50 border border-border/60 rounded-xl space-y-1.5">
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-4 w-28 rounded" />
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
