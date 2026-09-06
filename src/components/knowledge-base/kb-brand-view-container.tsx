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
    // Dock smoothly to the top of the page so header, brand title, and search bar stay in view
    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
    if (currentScrollY > 8) {
      isAutoScrollingRef.current = true;
      window.scrollTo({
        top: 0,
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
    <div className={`space-y-4 sm:space-y-6 max-w-7xl mx-auto min-h-[calc(100dvh-180px)] transition-all duration-300 ${isSearchFocused ? 'pb-32' : 'pb-16'}`}>
      {/* ========================================================================= */}
      {/* 1. SEAMLESS EMBEDDED KNOWLEDGE BASE HEADER (No Floating Card CTA)         */}
      {/* ========================================================================= */}
      <div id="brand-directory-header" className="flex items-center justify-between gap-3 px-1 pt-1 pb-0.5">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-primary/20 via-blue-600/15 to-indigo-500/10 border border-primary/30 flex items-center justify-center text-primary shadow-xs shrink-0">
            <Tv className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-xl font-black tracking-tight text-foreground whitespace-nowrap">
                Manufacturer Brands
              </h1>
              <Badge
                variant="outline"
                className="bg-primary/10 text-primary border-primary/25 text-[10px] sm:text-xs font-bold py-0.5 px-2.5 rounded-full shrink-0 shadow-2xs"
              >
                {initialBrands.length} Available
              </Badge>
            </div>
            <p className="hidden sm:block text-xs text-muted-foreground mt-0.5 font-medium">
              Select a manufacturer brand to explore TV model repair schematics, backlights, and diagnostic logs
            </p>
          </div>
        </div>

        {/* Embedded Add Brand Button */}
        {!!userRole && (
          <CreateTvBrandDialog
            trigger={
              <Button
                type="button"
                className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:from-blue-500 hover:via-indigo-500 hover:to-primary text-white font-extrabold text-xs sm:text-sm shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-white/25 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 text-white stroke-[2.5]" />
                <span className="whitespace-nowrap">Add Brand</span>
              </Button>
            }
          />
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. REAL-TIME BRAND SEARCH BAR + SORT DIRECTORY CONTROL CENTER            */}
      {/* ========================================================================= */}
      <div
        ref={searchContainerRef}
        className={`transition-all duration-200 bg-white/95 dark:bg-slate-950/95 p-2.5 sm:p-3.5 rounded-2xl sm:rounded-3xl border border-border/80 ${
          isSearchFocused || searchQuery.trim()
            ? 'shadow-md ring-2 ring-primary/20 border-primary/40'
            : 'shadow-xs hover:shadow-sm'
        }`}
      >
        <div className="space-y-2.5 sm:space-y-3">
          {/* Row 1: Real-time In-Place Search Bar with Premium Badge */}
          <div
            className="relative w-full group cursor-text"
            onClick={() => {
              inputRef.current?.focus();
              moveSearchBarToTop();
            }}
          >
            <div className="relative flex items-center">
              {/* Premium Theme Icon Badge */}
              <div className="absolute left-2.5 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-primary/20 via-blue-600/15 to-indigo-500/10 border border-primary/25 flex items-center justify-center text-primary shadow-2xs pointer-events-none group-focus-within:border-primary/50 group-focus-within:scale-105 transition-all">
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
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
                className="pl-12 sm:pl-13 pr-14 h-11 sm:h-12 bg-white/95 dark:bg-slate-900 border-2 border-primary/25 hover:border-primary/45 focus-visible:border-primary rounded-xl sm:rounded-2xl shadow-2xs hover:shadow-xs focus-visible:shadow-md focus-visible:ring-4 focus-visible:ring-primary/15 text-xs sm:text-sm font-semibold transition-all duration-200"
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
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-[10px] font-bold text-muted-foreground/70 border border-border/80">
                    Search
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Sort Directory Control Bar (Title on Left, Sort Button Shifted to Right) */}
          <div className="flex items-center justify-between gap-3 pt-2 sm:pt-2.5 border-t border-border/60">
            {/* Left: Explicit "Sort Directory" Title */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-2xs">
                <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs sm:text-sm font-extrabold text-foreground tracking-tight whitespace-nowrap">
                  Sort Directory
                </span>
                <span className="text-[11px] text-muted-foreground font-medium hidden xs:inline truncate">
                  • {filteredBrands.length} {filteredBrands.length === 1 ? 'brand' : 'brands'}
                </span>
              </div>
            </div>

            {/* Right: Ultra-Premium iOS Sort Button Trigger (Shifted to Right) */}
            <KbSortButton
              sortBy={sortBy}
              onClick={() => {
                inputRef.current?.blur();
                setIsSortOpen(true);
              }}
              className="h-9 sm:h-9.5 shrink-0 ml-auto shadow-2xs hover:shadow-xs"
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
        <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
          <span className="font-medium">
            Showing <strong className="text-foreground">{filteredBrands.length}</strong> of {initialBrands.length} brands matching &ldquo;{debouncedQuery}&rdquo;
          </span>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-primary font-bold hover:underline flex items-center gap-1 cursor-pointer"
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
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary/20 via-blue-600/15 to-indigo-500/10 border border-primary/30 flex items-center justify-center mx-auto mb-3.5 text-primary shadow-2xs">
            <Tv className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-foreground text-base sm:text-lg">
            {searchQuery ? `No brand found matching "${searchQuery}"` : 'No TV Brands Created'}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-md mx-auto mb-5 leading-relaxed">
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
