'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Monitor,
  Search,
  X,
  FolderOpen,
  ArrowRight,
  Sparkles,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { matchesOrderedPattern, calculateMatchScore } from '@/lib/search-utils';
import { recordModelOpen, getModelOpenCounts } from '@/lib/kb-tracking-utils';
import { ModelContextMenu } from './model-context-menu';
import { CreateTvModelDialog } from './create-tv-model-dialog';
import { ModelRowSkeleton, SearchDropdownRowSkeleton } from './kb-skeletons';
import {
  KbSortOption,
  KbSortButton,
  KbSortBottomSheet,
} from './kb-sort-bottom-sheet';

export interface TvModelListItem {
  id: string;
  modelNumber: string;
  slug: string;
  screenSize?: number | null;
  displayType?: string | null;
  chassisNo?: string | null;
  notes?: string | null;
  createdAt: Date | string;
  _count?: {
    knowledgeFolders?: number;
  };
  brand?: {
    name: string;
  };
}

interface ModelListViewProps {
  models: TvModelListItem[];
  brandName?: string;
  brandId?: string;
  brands?: { id: string; name: string }[];
  userRole?: string;
}

const ITEMS_PER_PAGE = 15;
const TRIGGER_OFFSET = 5; // Triggers loading next batch when user reaches (visibleCount - 5) which is the 10th item

export function ModelListView({
  models,
  brandName,
  brandId,
  brands,
  userRole = 'STAFF',
}: ModelListViewProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
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
    // Dock to the Registered TV Models section header so it smoothly stays visible with the search bar
    const headerEl = document.getElementById('registered-models-header');
    const targetEl = headerEl || searchContainerRef.current;
    if (!targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
    // If not already near the top of the viewport
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

    // Smoothly scroll search bar to the top of the viewport so results are visible above keyboard
    setTimeout(() => {
      moveSearchBarToTop();
    }, 60);
    setTimeout(() => {
      moveSearchBarToTop();
    }, 240); // Secondary adjustment after mobile keyboard layout shift completes
  }, [moveSearchBarToTop]);

  const handleSearchBlur = useCallback(() => {
    setIsSearchFocused(false);
  }, []);

  // Dismiss mobile virtual keyboard on touch outside search input or when user scrolls down
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
        // If user scrolls up or down (> 10px movement), dismiss keyboard
        if (Math.abs(currentY - touchStartYRef.current) > 10) {
          inputRef.current?.blur();
        }
      }
    };

    const handleScroll = () => {
      if (isAutoScrollingRef.current) {
        return;
      }
      // Ignore initial browser viewport adjustments upon keyboard open (first 600ms)
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
    setOpenCounts(getModelOpenCounts());
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
  const filteredModels = useMemo(() => {
    const query = debouncedQuery.trim();

    let list = models;

    if (query) {
      list = models
        .map((model) => {
          const cleanName = model.modelNumber.replace(/_\d{10,}$/, '');
          const fullSearchText = [
            cleanName,
            model.chassisNo || '',
            model.displayType || '',
            model.screenSize ? `${model.screenSize} inch` : '',
            model.notes || '',
          ].join(' ');

          const modelScore = calculateMatchScore(query, cleanName);
          const textScore = calculateMatchScore(query, fullSearchText);
          const isOrderedMatch =
            matchesOrderedPattern(query, cleanName) ||
            matchesOrderedPattern(query, fullSearchText);

          const score = Math.max(modelScore, textScore, isOrderedMatch ? 40 : 0);

          return {
            model,
            score,
            isMatch: score > 0 || isOrderedMatch,
          };
        })
        .filter((item) => item.isMatch)
        .sort((a, b) => b.score - a.score)
        .map((item) => item.model);
    }

    // Apply Sort By: "Most Opened" (Default), "Name A-Z", "Recently Added", "Oldest Added"
    if (sortBy === 'most-opened') {
      return [...list].sort((a, b) => {
        const countA = (openCounts[a.id] || 0) * 100 + (a._count?.knowledgeFolders || 0);
        const countB = (openCounts[b.id] || 0) * 100 + (b._count?.knowledgeFolders || 0);
        if (countB !== countA) {
          return countB - countA;
        }
        const nameA = a.modelNumber.replace(/_\d{10,}$/, '');
        const nameB = b.modelNumber.replace(/_\d{10,}$/, '');
        return nameA.localeCompare(nameB);
      });
    }

    if (sortBy === 'name') {
      return [...list].sort((a, b) => {
        const nameA = a.modelNumber.replace(/_\d{10,}$/, '');
        const nameB = b.modelNumber.replace(/_\d{10,}$/, '');
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
        const nameA = a.modelNumber.replace(/_\d{10,}$/, '');
        const nameB = b.modelNumber.replace(/_\d{10,}$/, '');
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
        const nameA = a.modelNumber.replace(/_\d{10,}$/, '');
        const nameB = b.modelNumber.replace(/_\d{10,}$/, '');
        return nameA.localeCompare(nameB);
      });
    }

    return list;
  }, [models, debouncedQuery, sortBy, openCounts]);

  const visibleModels = useMemo(() => {
    return filteredModels.slice(0, visibleCount);
  }, [filteredModels, visibleCount]);

  const hasMore = visibleCount < filteredModels.length;

  // Intersection callback to load next 15 items when reaching trigger item (10th item)
  const triggerElementRef = useCallback(
    (node: HTMLElement | null) => {
      if (isLoadingNext) return;
      if (observerRef.current) observerRef.current.disconnect();

      if (node && hasMore) {
        observerRef.current = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
            setIsLoadingNext(true);
            setTimeout(() => {
              setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, filteredModels.length));
              setIsLoadingNext(false);
            }, 180); // Snappy expansion
          }
        }, { threshold: 0.1, rootMargin: '100px' });

        observerRef.current.observe(node);
      }
    },
    [isLoadingNext, hasMore, filteredModels.length]
  );

  return (
    <div className={`space-y-4 min-h-[calc(100dvh-180px)] transition-all duration-300 ${isSearchFocused ? 'pb-[70vh]' : 'pb-16'}`}>
      {/* Real-time Contextual Model Search Bar + Filter Segmented Control */}
      <div
        ref={searchContainerRef}
        className={`scroll-mt-2 transition-all duration-200 bg-white dark:bg-slate-950/95 p-3 sm:p-4 rounded-2xl sm:rounded-3xl border ${
          isSearchFocused || searchQuery.trim()
            ? 'shadow-md ring-2 ring-blue-500/20 border-blue-400/50'
            : 'border-border/80 shadow-xs hover:shadow-sm'
        }`}
      >
        <div className="space-y-2.5 sm:space-y-3">
          {/* Row 1: Real-time In-Place Search Bar */}
          <div
            className="relative w-full group cursor-text"
            onClick={() => {
              inputRef.current?.focus();
              moveSearchBarToTop();
            }}
          >
            <div className="relative flex items-center">
              {/* Premium Theme Icon Badge */}
              <div className="absolute left-2.5 z-10 w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-blue-600/20 via-indigo-500/15 to-primary/10 border border-blue-500/25 flex items-center justify-center text-blue-600 shadow-2xs pointer-events-none group-focus-within:border-blue-500/50 group-focus-within:scale-105 transition-all">
                <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
              </div>

              <Input
                ref={inputRef}
                type="text"
                placeholder={`Search ${brandName ? brandName.replace(/_\d{10,}$/, '') : 'brand'} models...`}
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
                className="pl-12 sm:pl-13 pr-14 h-11 sm:h-12 bg-slate-50/80 dark:bg-slate-900 border-2 border-slate-200 hover:border-blue-400/50 focus-visible:border-blue-500 rounded-xl sm:rounded-2xl shadow-2xs hover:shadow-xs focus-visible:shadow-md focus-visible:ring-4 focus-visible:ring-blue-500/15 text-sm font-semibold text-foreground placeholder:text-muted-foreground/60 placeholder:font-medium transition-all duration-200"
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
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-muted-foreground/70 border border-border/80">
                    Search
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Sort Directory Control Bar */}
          <div className="flex items-center justify-between gap-3 pt-2 sm:pt-2.5 border-t border-border/50">
            {/* Left: Explicit "Sort Directory" Title */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-blue-500/10 border border-blue-400/20 flex items-center justify-center text-blue-600 shrink-0">
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs sm:text-sm font-extrabold text-foreground tracking-tight whitespace-nowrap">
                  Sort Directory
                </span>
                <span className="text-[11px] text-muted-foreground/70 font-semibold hidden xs:inline truncate">
                  · {filteredModels.length} {filteredModels.length === 1 ? 'model' : 'models'}
                </span>
              </div>
            </div>

            {/* Right: Sort Button */}
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

      {/* iOS Style Bottom Sheet for Model Sorting */}
      <KbSortBottomSheet
        open={isSortOpen}
        onOpenChange={setIsSortOpen}
        sortBy={sortBy}
        onSortChange={setSortBy}
        title="Sort TV Models"
        subtitle={`Choose how models for ${brandName ? brandName.replace(/_\d{10,}$/, '') : 'this brand'} are ordered`}
      />

      {/* Active Search Results Indicator */}
      {debouncedQuery.trim() && !isSearching && (
        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-semibold text-muted-foreground/80">
            Showing <strong className="text-foreground font-extrabold">{filteredModels.length}</strong> of {models.length} models matching &ldquo;<span className="text-blue-600 font-bold">{debouncedQuery}</span>&rdquo;
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

      {/* Model List View / Zero-Results Empty State / Skeletons */}
      {isSearching ? (
        <div className="divide-y divide-border/70 bg-white border border-border/80 rounded-3xl shadow-blend overflow-hidden animate-in fade-in duration-150">
          <ModelRowSkeleton />
          <ModelRowSkeleton />
          <ModelRowSkeleton />
          <ModelRowSkeleton />
        </div>
      ) : filteredModels.length === 0 ? (
        <div className="p-8 sm:p-12 text-center bg-white border border-border/80 border-dashed rounded-3xl shadow-blend">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600/20 via-indigo-500/15 to-primary/10 border border-blue-400/30 flex items-center justify-center mx-auto mb-3.5 text-blue-600 shadow-2xs">
            <Monitor className="w-7 h-7" />
          </div>
          <h3 className="font-extrabold text-foreground text-base sm:text-lg tracking-tight">
            {searchQuery ? `No model found matching "${searchQuery}"` : 'No models registered'}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground/80 mt-1.5 max-w-md mx-auto mb-5 leading-relaxed font-medium">
            {searchQuery
              ? `This model is not registered under ${brandName ? brandName.replace(/_\d{10,}$/, '') : 'this brand'} yet. Create "${searchQuery.trim().toUpperCase()}" to automatically set up its technical folders (Backlight & More info).`
              : 'Add your first TV model for this brand to start organizing documentation.'}
          </p>

          <div className="flex items-center justify-center gap-3 flex-wrap">
            {searchQuery && !!userRole && (
              <CreateTvModelDialog
                brands={brands || (brandId ? [{ id: brandId, name: brandName || 'Brand' }] : [])}
                preselectedBrandId={brandId}
                initialModelNumber={searchQuery.trim().toUpperCase()}
                existingModels={models.map((m) => m.modelNumber)}
                trigger={
                  <Button
                    type="button"
                    className="h-10 px-5 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-primary hover:from-blue-500 hover:to-primary text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/20 hover:shadow-lg active:scale-95 transition-all flex items-center gap-2 border border-white/20 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Model &ldquo;{searchQuery.trim().toUpperCase()}&rdquo;</span>
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
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="divide-y divide-slate-100 bg-white border border-border/70 rounded-3xl shadow-blend overflow-hidden">
            {visibleModels.map((model, idx) => {
              const folderCount = model._count?.knowledgeFolders ?? 0;
              const cleanModelNumber = model.modelNumber.replace(/_\d{10,}$/, '');
              // Trigger element at 10th item (visibleCount - 5)
              const isTriggerItem = idx === visibleCount - TRIGGER_OFFSET && hasMore;

              return (
                <div
                  key={model.id}
                  ref={isTriggerItem ? (triggerElementRef as any) : undefined}
                >
                  <Link
                    href={`/knowledge-base/models/${model.id}`}
                    onClick={() => recordModelOpen(model.id)}
                    className="group flex items-center justify-between p-4 sm:p-5 hover:bg-slate-50/80 transition-all duration-200 cursor-pointer"
                  >
                    {/* Left Side: Model Info */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600/15 to-indigo-500/10 border border-blue-400/20 flex items-center justify-center text-blue-600 group-hover:scale-105 group-hover:border-blue-400/40 group-hover:shadow-sm transition-all shrink-0">
                        <Monitor className="w-5 h-5" />
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-900 text-sm sm:text-base tracking-tight group-hover:text-blue-600 transition-colors truncate">
                            {cleanModelNumber}
                          </span>

                          {model.screenSize && (
                            <Badge variant="outline" className="text-[11px] font-extrabold px-2 py-0.5 bg-slate-50 text-slate-700 border-slate-200">
                              {model.screenSize}&quot;
                            </Badge>
                          )}

                          {model.displayType && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] uppercase font-extrabold px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200/60"
                            >
                              {model.displayType}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs flex-wrap">
                          {model.chassisNo && (
                            <span className="font-mono text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-md">Chassis: {model.chassisNo}</span>
                          )}
                          {model.notes && (
                            <span className="truncate max-w-xs text-[11px] italic text-muted-foreground/70 font-medium">
                              {model.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Side: Folders Count, 3-Dots Menu, & Action Pill */}
                    <div className="flex items-center gap-2.5 shrink-0 ml-4">
                      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-600">
                        <FolderOpen className="w-3.5 h-3.5 text-blue-500" />
                        <span>
                          {folderCount} {folderCount === 1 ? 'Folder' : 'Folders'}
                        </span>
                      </div>

                      {/* 3-Dots Menu (Rename / Delete with warning) */}
                      {!!userRole && (
                        <div
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          className="z-10"
                        >
                          <ModelContextMenu
                            modelId={model.id}
                            modelNumber={model.modelNumber}
                            screenSize={model.screenSize}
                            brandName={brandName || model.brand?.name}
                            folderCount={folderCount}
                            userRole={userRole}
                            existingModels={models.map((m) => m.modelNumber)}
                          />
                        </div>
                      )}

                      <div className="w-8 h-8 rounded-xl bg-slate-100 group-hover:bg-blue-600 group-hover:text-white flex items-center justify-center text-slate-500 transition-all duration-200">
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}

            {/* Skeleton rows when loading next 15 models */}
            {isLoadingNext && (
              <>
                <ModelRowSkeleton />
                <ModelRowSkeleton />
                <ModelRowSkeleton />
              </>
            )}
          </div>

          {/* Footer count indicator */}
          {filteredModels.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-center pt-2 pb-4 text-xs text-muted-foreground font-semibold">
              <span>
                Showing {Math.min(visibleCount, filteredModels.length)} of {filteredModels.length} models
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
