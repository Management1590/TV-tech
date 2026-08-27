'use client';

import React, { useId } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

// Curved Folder Silhouette SVG clip for Skeleton cards
export function FolderSilhouetteClip({ clipId }: { clipId: string }) {
  return (
    <svg className="w-0 h-0 absolute pointer-events-none" aria-hidden="true">
      <defs>
        <clipPath id={`folder-skeleton-clip-${clipId}`} clipPathUnits="objectBoundingBox">
          <path d="M 0.06,1 A 0.06,0.08 0 0,1 0,0.92 L 0,0.08 A 0.06,0.08 0 0,1 0.06,0 L 0.30,0 C 0.34,0 0.33,0.135 0.37,0.135 L 0.94,0.135 A 0.06,0.08 0 0,1 1,0.215 L 1,0.92 A 0.06,0.08 0 0,1 0.94,1 Z" />
        </clipPath>
      </defs>
    </svg>
  );
}

// 1. Brand / Category Curved Folder Skeleton Card
export function BrandFolderCardSkeleton() {
  const clipId = useId().replace(/:/g, '');

  return (
    <div className="relative h-full flex flex-col select-none animate-pulse">
      <FolderSilhouetteClip clipId={clipId} />

      <div
        className="relative w-full min-h-[190px] sm:min-h-[220px] bg-slate-100/90 overflow-hidden flex flex-col justify-end p-4 border border-slate-200/80 rounded-3xl"
        style={{
          clipPath: `url(#folder-skeleton-clip-${clipId})`,
        }}
      >
        {/* Shimmer background */}
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-200/80 via-slate-100/70 to-slate-200/60 animate-pulse" />

        {/* Center Icon Skeleton */}
        <div className="relative z-10 flex items-center justify-center pb-12">
          <div className="w-14 h-14 rounded-2xl bg-white/70 shadow-sm border border-slate-200/80 flex items-center justify-center">
            <div className="w-7 h-7 rounded-xl bg-slate-300/80" />
          </div>
        </div>

        {/* Bottom Bar Info Skeleton */}
        <div className="relative z-10 space-y-2 bg-white/90 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28 rounded-lg bg-slate-300/80" />
            <Skeleton className="h-4 w-12 rounded-full bg-slate-200" />
          </div>
          <Skeleton className="h-3 w-36 rounded-md bg-slate-200/90" />
        </div>
      </div>
    </div>
  );
}

// 2. Model List Row Skeleton
export function ModelRowSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 sm:p-5 bg-white hover:bg-slate-50 border-b border-border/70 animate-pulse">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {/* Left Monitor Icon Silhouette */}
        <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
          <div className="w-5 h-5 rounded-lg bg-slate-300/80" />
        </div>

        <div className="space-y-2 flex-1 min-w-0 max-w-md">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-36 sm:w-48 rounded-lg bg-slate-300/80" />
            <Skeleton className="h-4 w-12 rounded-full bg-slate-200" />
            <Skeleton className="h-4 w-14 rounded-full bg-slate-200" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-3 w-24 rounded-md bg-slate-200" />
            <Skeleton className="h-3 w-40 rounded-md bg-slate-200" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0 ml-4">
        <Skeleton className="h-7 w-20 rounded-xl bg-slate-200 hidden sm:block" />
        <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
          <div className="w-3.5 h-3.5 rounded bg-slate-300" />
        </div>
      </div>
    </div>
  );
}

// 3. Grid of Brand Folder Skeletons (Default 15 items)
export function BrandViewSkeletonGrid({ count = 15 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <BrandFolderCardSkeleton key={i} />
      ))}
    </div>
  );
}

// 4. List of Model Row Skeletons (Default 15 items)
export function ModelViewSkeletonList({ count = 15 }: { count?: number }) {
  return (
    <div className="bg-white border border-border/80 rounded-3xl shadow-blend overflow-hidden divide-y divide-border/70">
      {Array.from({ length: count }).map((_, i) => (
        <ModelRowSkeleton key={i} />
      ))}
    </div>
  );
}

// 5. Search Dropdown Preview Row Skeleton
export function SearchDropdownRowSkeleton() {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5 bg-white border-b border-border/60 animate-pulse">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 shrink-0" />
        <div className="space-y-1">
          <Skeleton className="h-3.5 w-28 rounded bg-slate-300/80" />
          <Skeleton className="h-2.5 w-20 rounded bg-slate-200" />
        </div>
      </div>
      <Skeleton className="h-4 w-14 rounded-full bg-slate-200" />
    </div>
  );
}

// 6. Complete Folder Content View Skeleton (Gallery, Voice, Documents)
export function FolderContentSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Section 1: Photo & Video Gallery Skeleton */}
      <Card className="bg-white border border-border/80 shadow-blend rounded-3xl p-5 sm:p-7 space-y-6">
        <div className="flex items-center justify-between border-b border-border/70 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center">
              <div className="w-5 h-5 rounded-lg bg-blue-300" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-44 rounded-lg bg-slate-300/80" />
              <Skeleton className="h-3 w-64 rounded bg-slate-200" />
            </div>
          </div>
          <Skeleton className="h-10 w-36 rounded-2xl bg-slate-200" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="aspect-video rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden relative"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-slate-200/80 to-slate-100/50 animate-pulse" />
            </div>
          ))}
        </div>
      </Card>

      {/* Section 2: Audio Skeleton */}
      <Card className="bg-white border border-border/80 shadow-blend rounded-3xl p-5 sm:p-7 space-y-5">
        <div className="flex items-center justify-between border-b border-border/70 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-violet-50 border border-violet-200 flex items-center justify-center">
              <div className="w-5 h-5 rounded-lg bg-violet-300" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-48 rounded-lg bg-slate-300/80" />
              <Skeleton className="h-3 w-60 rounded bg-slate-200" />
            </div>
          </div>
          <Skeleton className="h-10 w-40 rounded-2xl bg-slate-200" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-32 rounded bg-slate-300" />
                <Skeleton className="h-3 w-16 rounded bg-slate-200" />
              </div>
              <Skeleton className="h-8 w-full rounded-xl bg-slate-200" />
            </div>
          ))}
        </div>
      </Card>

      {/* Section 3: Documents Stack Skeleton */}
      <Card className="bg-white border border-border/80 shadow-blend rounded-3xl p-5 sm:p-7 space-y-6">
        <div className="flex items-center justify-between border-b border-border/70 pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <div className="w-5 h-5 rounded-lg bg-emerald-300" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-52 rounded-lg bg-slate-300/80" />
              <Skeleton className="h-3 w-72 rounded bg-slate-200" />
            </div>
          </div>
          <Skeleton className="h-10 w-36 rounded-2xl bg-slate-200" />
        </div>

        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-64 rounded-lg bg-slate-300/80" />
                <Skeleton className="h-7 w-16 rounded-xl bg-slate-200" />
              </div>
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <Skeleton className="h-3.5 w-full rounded bg-slate-200" />
                <Skeleton className="h-3.5 w-4/5 rounded bg-slate-200" />
                <Skeleton className="h-3.5 w-2/3 rounded bg-slate-200" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
