'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface FolderGridSkeletonProps {
  count?: number;
}

export function FolderGridSkeleton({ count = 8 }: FolderGridSkeletonProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 animate-in fade-in duration-200">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative w-full min-h-[155px] xs:min-h-[175px] sm:min-h-[220px] rounded-3xl bg-slate-100/90 border border-border/80 p-3 sm:p-5 flex flex-col justify-between overflow-hidden shadow-blend"
        >
          {/* Shimmer sweep effect */}
          <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/50 to-transparent" />

          {/* Top Folder Tab Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-xl bg-slate-200" />
              <Skeleton className="h-4 w-24 bg-slate-200 rounded-md" />
            </div>
            <Skeleton className="h-5 w-12 rounded-full bg-slate-200" />
          </div>

          {/* Bottom Folder Metadata */}
          <div className="space-y-2 pt-4 border-t border-border/60">
            <Skeleton className="h-5 w-3/4 bg-slate-200 rounded-md" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-16 bg-slate-200 rounded" />
              <Skeleton className="h-3 w-20 bg-slate-200 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
