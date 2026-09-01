'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Tv,
  FolderOpen,
  Plus,
  Flame,
  ArrowDownAZ,
  SlidersHorizontal,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreateTvBrandDialog } from './create-tv-brand-dialog';
import { BrandFolderCard, BrandFolderData } from './brand-folder-card';
import { BrandFolderCardSkeleton } from './kb-skeletons';
import { getBrandOpenCounts } from '@/lib/kb-tracking-utils';

interface KbBrandViewContainerProps {
  initialBrands: (BrandFolderData & {
    createdAt?: Date | string;
    updatedAt?: Date | string;
  })[];
  userRole?: string;
}

const ITEMS_PER_PAGE = 15;
const TRIGGER_OFFSET = 5; // Triggers loading next batch when user reaches (visibleCount - 5) which is the 10th item

export function KbBrandViewContainer({
  initialBrands,
  userRole = 'STAFF',
}: KbBrandViewContainerProps) {
  // Default filter set to "open many times" (most frequently opened)
  const [sortBy, setSortBy] = useState<'most-opened' | 'name'>('most-opened');
  const [openCounts, setOpenCounts] = useState<Record<string, number>>({});
  const [visibleCount, setVisibleCount] = useState<number>(ITEMS_PER_PAGE);
  const [isLoadingNext, setIsLoadingNext] = useState<boolean>(false);

  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    setOpenCounts(getBrandOpenCounts());
  }, []);

  // Reset pagination when sort changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [sortBy]);

  // Sorted brands based on selected filter
  const sortedBrands = useMemo(() => {
    const list = [...initialBrands];

    if (sortBy === 'most-opened') {
      return list.sort((a, b) => {
        const countA = (openCounts[a.id] || 0) * 100 + (a._count?.models ?? a.modelCount ?? 0);
        const countB = (openCounts[b.id] || 0) * 100 + (b._count?.models ?? b.modelCount ?? 0);
        if (countB !== countA) {
          return countB - countA;
        }
        return a.name.localeCompare(b.name);
      });
    }

    // Sort by Name (A - Z)
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [initialBrands, sortBy, openCounts]);

  const visibleBrands = useMemo(() => {
    return sortedBrands.slice(0, visibleCount);
  }, [sortedBrands, visibleCount]);

  const hasMore = visibleCount < sortedBrands.length;

  // Intersection callback to load next 15 items when reaching trigger item (e.g. 10th item)
  const triggerElementRef = useCallback(
    (node: HTMLElement | null) => {
      if (isLoadingNext) return;
      if (observerRef.current) observerRef.current.disconnect();

      if (node && hasMore) {
        observerRef.current = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
            setIsLoadingNext(true);
            setTimeout(() => {
              setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, sortedBrands.length));
              setIsLoadingNext(false);
            }, 180); // Crisp, snappy expansion
          }
        }, { threshold: 0.1, rootMargin: '100px' });

        observerRef.current.observe(node);
      }
    },
    [isLoadingNext, hasMore, sortedBrands.length]
  );

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* ========================================================================= */}
      {/* 1. ULTRA-PREMIUM KNOWLEDGE BASE HEADER BANNER                             */}
      {/* ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-border/80 p-4 sm:p-7 shadow-sm hover:shadow-md transition-shadow">
        {/* Soft Background Neon Glow Elements */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-5">
          {/* Title & Description */}
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-primary/20 via-blue-600/15 to-indigo-500/10 border border-primary/30 flex items-center justify-center text-primary shadow-2xs shrink-0">
              <Tv className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-foreground truncate">
                  TV Knowledge Base
                </h1>
                <Badge
                  variant="outline"
                  className="bg-primary/10 text-primary border-primary/20 text-[10px] sm:text-[11px] font-bold py-0.5 px-2"
                >
                  Root
                </Badge>
              </div>
              <p className="hidden sm:block text-xs text-muted-foreground mt-0.5">
                Select a manufacturer brand to explore TV model repair schematics, backlights, and diagnostic logs.
              </p>
              <p className="sm:hidden text-xs text-muted-foreground mt-0.5 font-medium">
                {sortedBrands.length} Brands Available
              </p>
            </div>
          </div>

          {/* Upper Actions: Brand Counter Badge + Premium Add Brand Button */}
          <div className="flex items-center gap-2 sm:gap-3 self-stretch sm:self-auto shrink-0 justify-between sm:justify-end">
            <div className="hidden sm:flex items-center px-3.5 h-10 rounded-2xl bg-muted/90 border border-border/80 text-xs font-bold text-foreground/80 shadow-2xs">
              {sortedBrands.length} {sortedBrands.length === 1 ? 'Brand' : 'Brands'}
            </div>

            {/* Ultra-Premium Add Brand Dialog Trigger */}
            {!!userRole && (
              <CreateTvBrandDialog
                trigger={
                  <Button
                    type="button"
                    className="h-9 sm:h-10 px-3.5 sm:px-5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:from-blue-500 hover:via-indigo-500 hover:to-primary text-white font-bold text-xs sm:text-sm shadow-sm hover:shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-white/20 cursor-pointer group w-full sm:w-auto"
                  >
                    <Plus className="w-3.5 h-3.5 text-white" />
                    <span>Add Brand</span>
                  </Button>
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ULTRA-PREMIUM FILTER BAR (Most Opened / Name A-Z)                       */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
        <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-foreground/80">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          <span>Sort & Filter:</span>
        </div>

        {/* Segmented Filter Control */}
        <div className="grid grid-cols-2 sm:inline-flex items-center p-1 bg-muted/60 border border-border/80 rounded-xl sm:rounded-2xl shadow-2xs w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSortBy('most-opened')}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              sortBy === 'most-opened'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/80'
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${sortBy === 'most-opened' ? 'text-amber-400' : 'text-amber-500'}`} />
            <span>Most Opened</span>
          </button>

          <button
            type="button"
            onClick={() => setSortBy('name')}
            className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
              sortBy === 'name'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/80'
            }`}
          >
            <ArrowDownAZ className="w-3.5 h-3.5" />
            <span>Name (A - Z)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. BRAND FOLDER CARDS GRID WITH CRISPY SKELETON INFINITE SCROLL           */}
      {/* ========================================================================= */}
      {sortedBrands.length === 0 ? (
        <div className="p-16 text-center bg-white border border-border/80 border-dashed rounded-3xl shadow-blend">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary">
            <FolderOpen className="w-8 h-8" />
          </div>
          <h3 className="font-bold text-foreground text-lg mb-1">No TV Brands Created</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-6">
            Click &ldquo;Add Brand&rdquo; above to create your first TV manufacturer brand (e.g. Samsung, LG, Sony).
          </p>
          {!!userRole && <CreateTvBrandDialog />}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            {visibleBrands.map((brand, idx) => {
              // Attach observer trigger at 10th item (visibleCount - 5)
              const isTriggerItem = idx === visibleCount - TRIGGER_OFFSET && hasMore;

              return (
                <div
                  key={brand.id}
                  ref={isTriggerItem ? (triggerElementRef as any) : undefined}
                  className="h-full"
                >
                  <BrandFolderCard brand={brand} userRole={userRole} />
                </div>
              );
            })}
          </div>

          {/* Skeleton placeholders when loading next batch */}
          {isLoadingNext && (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 pt-2 animate-in fade-in duration-200">
              {Array.from({ length: 4 }).map((_, i) => (
                <BrandFolderCardSkeleton key={`skeleton-${i}`} />
              ))}
            </div>
          )}

          {/* Footer indicator showing loaded / total count */}
          {sortedBrands.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-center pt-2 pb-4 text-xs text-muted-foreground font-medium">
              <span>
                Showing {Math.min(visibleCount, sortedBrands.length)} of {sortedBrands.length} brands
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
