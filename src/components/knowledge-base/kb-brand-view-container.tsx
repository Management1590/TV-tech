'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Tv,
  FolderOpen,
  Plus,
  SlidersHorizontal,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { matchesOrderedPattern, calculateMatchScore } from '@/lib/search-utils';
import { CreateTvBrandDialog } from './create-tv-brand-dialog';
import { BrandFolderCard, BrandFolderData } from './brand-folder-card';
import { BrandFolderCardSkeleton } from './kb-skeletons';
import { getBrandOpenCounts } from '@/lib/kb-tracking-utils';
import {
  KbSortOption,
  KbSortButton,
  KbSortBottomSheet,
} from './kb-sort-bottom-sheet';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  // Default filter set to "most-opened"
  const [sortBy, setSortBy] = useState<KbSortOption>('most-opened');
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [openCounts, setOpenCounts] = useState<Record<string, number>>({});
  const [visibleCount, setVisibleCount] = useState<number>(ITEMS_PER_PAGE);
  const [isLoadingNext, setIsLoadingNext] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const focusTimeRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const isAutoScrollingRef = useRef(false);

  const moveSearchBarToTop = useCallback(() => {
    // Dock to the Brand Search Bar so it smoothly scrolls to the top of the viewport
    const targetEl = searchContainerRef.current;
    if (!targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
    // If not already near the top of the viewport (within 12px)
    if (rect.top > 12 || rect.top < 0) {
      isAutoScrollingRef.current = true;
      const targetScrollY = currentScrollY + rect.top - 8;
      window.scrollTo({
        top: Math.max(0, targetScrollY),
        behavior: 'smooth',
      });
      setTimeout(() => {
        isAutoScrollingRef.current = false;
      }, 650);
    }
  }, []);

  const handleSearchFocus = useCallback(() => {
    setIsSearchFocused(true);
    focusTimeRef.current = Date.now();
    isAutoScrollingRef.current = true;

    // Smoothly scroll search bar to top of viewport above virtual keyboard
    setTimeout(() => {
      moveSearchBarToTop();
    }, 60);
    setTimeout(() => {
      moveSearchBarToTop();
    }, 240);
  }, [moveSearchBarToTop]);

  const handleSearchBlur = useCallback(() => {
    setIsSearchFocused(false);
  }, []);

  // Dismiss mobile virtual keyboard on touch outside search input or when scrolling
  useEffect(() => {
    if (!isSearchFocused) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        touchStartYRef.current = e.touches[0].clientY;
      }
      const target = e.target as HTMLElement | null;
      if (
        searchContainerRef.current &&
        target &&
        !searchContainerRef.current.contains(target)
      ) {
        inputRef.current?.blur();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isAutoScrollingRef.current) return;
      if (e.touches.length > 0) {
        const currentY = e.touches[0].clientY;
        if (Math.abs(currentY - touchStartYRef.current) > 10) {
          inputRef.current?.blur();
        }
      }
    };

    const handleScroll = () => {
      if (isAutoScrollingRef.current) {
        return;
      }
      // Ignore initial browser viewport layout shifts upon keyboard open (first 600ms)
      if (Date.now() - focusTimeRef.current < 600) {
        return;
      }
      if (inputRef.current && document.activeElement === inputRef.current) {
        inputRef.current.blur();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        searchContainerRef.current &&
        target &&
        !searchContainerRef.current.contains(target)
      ) {
        inputRef.current?.blur();
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('mousedown', handleMouseDown, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isSearchFocused]);

  useEffect(() => {
    setOpenCounts(getBrandOpenCounts());
  }, []);

  // Snappy search debounce with instant loading feedback
  useEffect(() => {
    if (searchQuery !== debouncedQuery) {
      setIsSearching(true);
      const timer = setTimeout(() => {
        setDebouncedQuery(searchQuery);
        setIsSearching(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, debouncedQuery]);

  // Reset pagination when query or sort changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [debouncedQuery, sortBy]);

  // Ordered pattern search matching & ranking + Filter Sorting (Most Opened / Name)
  const filteredBrands = useMemo(() => {
    const query = debouncedQuery.trim();
    let list = initialBrands;

    if (query) {
      list = initialBrands
        .map((brand) => {
          const cleanName = brand.name.replace(/_\d{10,}$/, '');
          const fullSearchText = [
            cleanName,
            brand.description || '',
          ].join(' ');

          const brandScore = calculateMatchScore(query, cleanName);
          const textScore = calculateMatchScore(query, fullSearchText);
          const isOrderedMatch =
            matchesOrderedPattern(query, cleanName) ||
            matchesOrderedPattern(query, fullSearchText);

          const score = Math.max(brandScore, textScore, isOrderedMatch ? 40 : 0);

          return {
            brand,
            score,
            isMatch: score > 0 || isOrderedMatch,
          };
        })
        .filter((item) => item.isMatch)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.brand);
    }

    // Apply Sort By: "Most Opened" (Default), "Name A-Z", "Recently Added", "Oldest Added"
    if (sortBy === 'most-opened') {
      return [...list].sort((a, b) => {
        const countA = (openCounts[a.id] || 0) * 100 + (a._count?.models ?? a.modelCount ?? 0);
        const countB = (openCounts[b.id] || 0) * 100 + (b._count?.models ?? b.modelCount ?? 0);
        if (countB !== countA) {
          return countB - countA;
        }
        const nameA = a.name.replace(/_\d{10,}$/, '');
        const nameB = b.name.replace(/_\d{10,}$/, '');
        return nameA.localeCompare(nameB);
      });
    }

    if (sortBy === 'name') {
      return [...list].sort((a, b) => {
        const nameA = a.name.replace(/_\d{10,}$/, '');
        const nameB = b.name.replace(/_\d{10,}$/, '');
        return nameA.localeCompare(nameB);
      });
    }

    if (sortBy === 'recently-added') {
      return [...list].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeB !== timeA) {
          return timeB - timeA;
        }
        const nameA = a.name.replace(/_\d{10,}$/, '');
        const nameB = b.name.replace(/_\d{10,}$/, '');
        return nameA.localeCompare(nameB);
      });
    }

    if (sortBy === 'oldest-added') {
      return [...list].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeA !== timeB) {
          return timeA - timeB;
        }
        const nameA = a.name.replace(/_\d{10,}$/, '');
        const nameB = b.name.replace(/_\d{10,}$/, '');
        return nameA.localeCompare(nameB);
      });
    }

    return list;
  }, [initialBrands, debouncedQuery, sortBy, openCounts]);

  const visibleBrands = useMemo(() => {
    return filteredBrands.slice(0, visibleCount);
  }, [filteredBrands, visibleCount]);

  const hasMore = visibleCount < filteredBrands.length;

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
              setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, filteredBrands.length));
              setIsLoadingNext(false);
            }, 180); // Crisp, snappy expansion
          }
        }, { threshold: 0.1, rootMargin: '100px' });

        observerRef.current.observe(node);
      }
    },
    [isLoadingNext, hasMore, filteredBrands.length]
  );

  return (
    <div className={`space-y-4 sm:space-y-6 max-w-7xl mx-auto min-h-[calc(100dvh-180px)] transition-all duration-300 ${isSearchFocused ? 'pb-[70vh]' : 'pb-16'}`}>
      {/* ========================================================================= */}
      {/* 1. SEAMLESS EMBEDDED KNOWLEDGE BASE HEADER (Muted & Clean)               */}
      {/* ========================================================================= */}
      <div id="brand-directory-header" className="flex items-center justify-between gap-2.5 sm:gap-4 px-1 pt-1 pb-0.5">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-muted/70 dark:bg-slate-800/80 border border-border/70 flex items-center justify-center text-muted-foreground shadow-2xs shrink-0">
            <Tv className="w-5 h-5 sm:w-6 sm:h-6 text-foreground/70" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-foreground whitespace-nowrap">
                Brands
              </h1>
              <Badge
                variant="outline"
                className="bg-muted/60 dark:bg-slate-800/60 text-muted-foreground border-border/70 text-[10px] sm:text-xs font-bold py-0.5 px-2.5 rounded-full shrink-0 shadow-2xs whitespace-nowrap"
              >
                {initialBrands.length} Available
              </Badge>
            </div>
            <p className="hidden sm:block text-xs text-muted-foreground/70 mt-0.5 font-medium tracking-wide">
              Select a brand to explore TV model repair schematics, backlights, and diagnostic logs
            </p>
          </div>
        </div>

        {/* Highlighted Add Brand Button (Rich Knowledge Base Violet/Purple Theme) */}
        {!!userRole && (
          <div className="shrink-0">
            <CreateTvBrandDialog
              trigger={
                <Button
                  type="button"
                  className="h-9 sm:h-10 px-4 sm:px-5 rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm shadow-md shadow-violet-500/30 hover:shadow-lg hover:shadow-violet-500/40 active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-white/25 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white stroke-[2.5]" />
                  <span className="whitespace-nowrap font-black">Add Brand</span>
                </Button>
              }
            />
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. REAL-TIME BRAND SEARCH BAR + SORT DIRECTORY CONTROL CENTER            */}
      {/* ========================================================================= */}
      <div
        ref={searchContainerRef}
        className={`scroll-mt-2 transition-all duration-200 bg-white dark:bg-slate-950/95 p-3 sm:p-4 rounded-3xl border ${
          isSearchFocused || searchQuery.trim()
            ? 'shadow-md ring-2 ring-violet-500/25 border-violet-400/60'
            : 'border-border/70 shadow-xs hover:shadow-sm hover:border-violet-300/40'
        }`}
      >
        <div className="space-y-2.5 sm:space-y-3">
          {/* Row 1: Real-time In-Place Search Bar Themed to Knowledge Base Purple */}
          <div
            className="relative w-full group cursor-text"
            onClick={() => {
              inputRef.current?.focus();
              moveSearchBarToTop();
            }}
          >
            <div className="relative flex items-center">
              {/* Premium Knowledge Base Violet Theme Icon Badge */}
              <div className="absolute left-2.5 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-violet-600/20 via-purple-500/15 to-indigo-500/10 border border-violet-500/30 flex items-center justify-center text-violet-600 dark:text-violet-400 shadow-2xs pointer-events-none group-focus-within:border-violet-500/60 group-focus-within:scale-105 transition-all">
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-violet-600 dark:text-violet-400" />
              </div>

              <Input
                id="brand-search-input"
                ref={inputRef}
                type="text"
                placeholder="Search TV brands (e.g. Samsung, LG, Sony, TCL)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={() => {
                  moveSearchBarToTop();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    inputRef.current?.blur();
                  }
                }}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                className="pl-12 sm:pl-13 pr-14 h-11 sm:h-12 bg-violet-50/25 dark:bg-slate-900/90 border-2 border-violet-200/70 dark:border-violet-900/50 hover:border-violet-400/60 focus-visible:border-violet-500 rounded-full shadow-2xs hover:shadow-xs focus-visible:shadow-md focus-visible:ring-4 focus-visible:ring-violet-500/15 text-sm font-semibold text-foreground placeholder:text-muted-foreground/60 placeholder:font-medium transition-all duration-200"
              />

              {/* Clear / Dismiss Button or Quick Tag */}
              <div className="absolute right-2.5 flex items-center gap-1.5 z-10">
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchQuery('');
                      inputRef.current?.focus();
                    }}
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full bg-violet-100/70 dark:bg-violet-950/40 text-[10px] font-bold text-violet-700 dark:text-violet-300 border border-violet-200/70 dark:border-violet-800/50">
                    Search
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Sort Directory Control Bar (Muted Title on Left, Highlighted Sort Button on Right) */}
          <div className="flex items-center justify-between gap-3 pt-2 sm:pt-2.5 border-t border-border/50">
            {/* Left: Clean Muted "Sort Directory" Title */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-muted/80 dark:bg-slate-800 border border-border/70 flex items-center justify-center text-muted-foreground shrink-0">
                <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs sm:text-sm font-bold text-foreground/80 tracking-tight whitespace-nowrap">
                  Sort Directory
                </span>
                <span className="text-[11px] text-muted-foreground/60 font-medium hidden xs:inline truncate">
                  · {filteredBrands.length} {filteredBrands.length === 1 ? 'brand' : 'brands'}
                </span>
              </div>
            </div>

            {/* Right: Highlighted Sort Filter Button Trigger */}
            <KbSortButton
              sortBy={sortBy}
              onClick={() => {
                inputRef.current?.blur();
                setIsSortOpen(true);
              }}
              className="h-9 sm:h-9.5 shrink-0 ml-auto shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* iOS Style Bottom Sheet for Brand Sorting */}
      <KbSortBottomSheet
        open={isSortOpen}
        onOpenChange={setIsSortOpen}
        sortBy={sortBy}
        onSortChange={setSortBy}
        title="Sort TV Brands"
        subtitle="Choose how manufacturer brands are ordered"
      />

      {/* Active Search Results Indicator */}
      {debouncedQuery.trim() && !isSearching && (
        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-semibold text-muted-foreground/80">
            Showing <strong className="text-foreground font-extrabold">{filteredBrands.length}</strong> of {initialBrands.length} brands matching &ldquo;<span className="text-blue-600 font-bold">{debouncedQuery}</span>&rdquo;
          </span>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3 h-3" /> Clear filter
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. BRAND FOLDER CARDS GRID / ZERO RESULTS / SKELETONS                     */}
      {/* ========================================================================= */}
      {isSearching ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 animate-in fade-in duration-150">
          <BrandFolderCardSkeleton />
          <BrandFolderCardSkeleton />
          <BrandFolderCardSkeleton />
          <BrandFolderCardSkeleton />
        </div>
      ) : filteredBrands.length === 0 ? (
        <div className="p-8 sm:p-12 text-center bg-white border border-border/80 border-dashed rounded-3xl shadow-blend">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600/20 via-indigo-500/15 to-primary/10 border border-blue-400/30 flex items-center justify-center mx-auto mb-3.5 text-blue-600 shadow-2xs">
            <Tv className="w-7 h-7" />
          </div>
          <h3 className="font-extrabold text-foreground text-base sm:text-lg tracking-tight">
            {searchQuery ? `No brand found matching "${searchQuery}"` : 'No TV Brands Created'}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground/80 mt-1.5 max-w-md mx-auto mb-5 leading-relaxed font-medium">
            {searchQuery
              ? `This brand is not registered in the TV Knowledge Base yet. Create "${searchQuery.trim()}" to set up its manufacturer directory and technical models.`
              : 'Add your first TV manufacturer brand (e.g. Samsung, LG, Sony) to start organizing models and documentation.'}
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            {searchQuery && !!userRole && (
              <CreateTvBrandDialog
                initialBrandName={searchQuery.trim()}
                trigger={
                  <Button
                    type="button"
                    className="h-10 px-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:from-blue-500 hover:to-primary text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 hover:shadow-lg active:scale-95 transition-all flex items-center gap-2 border border-white/20 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Brand &ldquo;{searchQuery.trim()}&rdquo;</span>
                  </Button>
                }
              />
            )}

            {searchQuery && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setSearchQuery('')}
                className="h-10 px-4 rounded-2xl text-xs font-semibold gap-1.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Clear Search Filter
              </Button>
            )}

            {!searchQuery && !!userRole && <CreateTvBrandDialog />}
          </div>
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
          {filteredBrands.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-center pt-2 pb-4 text-xs text-muted-foreground font-medium">
              <span>
                Showing {Math.min(visibleCount, filteredBrands.length)} of {filteredBrands.length} brands
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
