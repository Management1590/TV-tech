'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Monitor,
  Search,
  X,
  FolderOpen,
  ArrowRight,
  Sparkles,
  ChevronRight,
  Flame,
  ArrowDownAZ,
  SlidersHorizontal,
  Loader2,
  Plus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { matchesOrderedPattern, calculateMatchScore } from '@/lib/search-utils';
import { recordModelOpen, getModelOpenCounts } from '@/lib/kb-tracking-utils';
import { ModelContextMenu } from './model-context-menu';
import { CreateTvModelDialog } from './create-tv-model-dialog';
import { ModelRowSkeleton, SearchDropdownRowSkeleton } from './kb-skeletons';

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
  const [sortBy, setSortBy] = useState<'most-opened' | 'name'>('most-opened');
  const [openCounts, setOpenCounts] = useState<Record<string, number>>({});
  const [visibleCount, setVisibleCount] = useState<number>(ITEMS_PER_PAGE);
  const [isLoadingNext, setIsLoadingNext] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const handleSearchFocus = useCallback(() => {
    setIsSearchFocused(true);
    // Smoothly scroll search bar to top of mobile viewport so results are visible above keyboard
    setTimeout(() => {
      if (searchContainerRef.current) {
        const rect = searchContainerRef.current.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const targetY = rect.top + scrollTop - 10;
        window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
      }
    }, 120);
  }, []);

  const handleSearchBlur = useCallback(() => {
    setTimeout(() => {
      setIsSearchFocused(false);
    }, 200);
  }, []);

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

    // Apply Sort By: "Most Opened" (Default) or "Name A-Z"
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

    // Sort by Name (A-Z)
    return [...list].sort((a, b) => {
      const nameA = a.modelNumber.replace(/_\d{10,}$/, '');
      const nameB = b.modelNumber.replace(/_\d{10,}$/, '');
      return nameA.localeCompare(nameB);
    });
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
    <div className="space-y-4">
      {/* Sticky Real-time Contextual Model Search Bar + Filter Segmented Control */}
      <div
        ref={searchContainerRef}
        className={`transition-all duration-300 ${
          isSearchFocused || searchQuery.trim()
            ? 'sticky top-1 sm:top-2 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl p-2 sm:p-2.5 rounded-2xl shadow-md border border-border/80'
            : 'relative'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 flex-wrap">
          {/* In-Place Search Bar with Premium Theme Highlight */}
          <div className="relative flex-1 min-w-0 group">
            <div className="relative flex items-center">
              {/* Premium Theme Icon Badge */}
              <div className="absolute left-2.5 z-10 w-7 h-7 rounded-xl bg-gradient-to-tr from-primary/20 via-blue-600/15 to-indigo-500/10 border border-primary/25 flex items-center justify-center text-primary shadow-2xs pointer-events-none group-focus-within:border-primary/50 group-focus-within:scale-105 transition-all">
                <Search className="w-3.5 h-3.5" />
              </div>

              <Input
                ref={inputRef}
                type="text"
                placeholder={`Search ${brandName ? brandName.replace(/_\d{10,}$/, '') : 'brand'} models...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={handleSearchFocus}
                onBlur={handleSearchBlur}
                className="pl-12 pr-14 h-11 bg-white/95 dark:bg-slate-900 border-2 border-primary/25 hover:border-primary/45 focus-visible:border-primary rounded-2xl shadow-xs hover:shadow-sm focus-visible:shadow-md focus-visible:ring-4 focus-visible:ring-primary/15 text-xs sm:text-sm font-semibold transition-all duration-200"
              />

              {/* Clear / Dismiss Button or Quick Tag */}
              <div className="absolute right-2.5 flex items-center gap-1.5 z-10">
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      inputRef.current?.focus();
                    }}
                    className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-muted text-[10px] font-bold text-muted-foreground/70 border border-border/80">
                    Search
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Filter Segmented Control Bar */}
          <div className="inline-flex items-center p-1 bg-muted/60 border border-border/80 rounded-2xl shadow-2xs self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setSortBy('most-opened')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                sortBy === 'most-opened'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/80'
              }`}
            >
              <Flame className={`w-3.5 h-3.5 ${sortBy === 'most-opened' ? 'text-amber-400' : 'text-amber-500'}`} />
              <span>Open Many Times</span>
              {sortBy === 'most-opened' && (
                <span className="ml-0.5 text-[10px] bg-white/20 dark:bg-black/20 px-1.5 py-0.2 rounded-md font-extrabold">
                  Default
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSortBy('name')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                sortBy === 'name'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/80'
              }`}
            >
              <ArrowDownAZ className="w-3.5 h-3.5" />
              <span>By Name</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Search Results Indicator */}
      {debouncedQuery.trim() && !isSearching && (
        <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
          <span className="font-medium">
            Showing <strong className="text-foreground">{filteredModels.length}</strong> of {models.length} models matching &ldquo;{debouncedQuery}&rdquo;
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
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary/20 via-blue-600/15 to-indigo-500/10 border border-primary/30 flex items-center justify-center mx-auto mb-3.5 text-primary shadow-2xs">
            <Monitor className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-foreground text-base sm:text-lg">
            {searchQuery ? `No model found matching "${searchQuery}"` : 'No models registered'}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-md mx-auto mb-5 leading-relaxed">
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
          <div className="divide-y divide-border/70 bg-white border border-border/80 rounded-3xl shadow-blend overflow-hidden">
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
                    className="group flex items-center justify-between p-4 sm:p-5 hover:bg-muted/50 transition-all duration-200 cursor-pointer"
                  >
                    {/* Left Side: Model Info */}
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-primary/15 to-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-105 group-hover:border-primary/40 group-hover:shadow-sm transition-all shrink-0">
                        <Monitor className="w-5 h-5" />
                      </div>

                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground text-sm sm:text-base tracking-tight group-hover:text-primary transition-colors truncate">
                            {cleanModelNumber}
                          </span>

                          {model.screenSize && (
                            <Badge variant="outline" className="text-[11px] font-bold px-2 py-0.5 bg-muted">
                              {model.screenSize}&quot;
                            </Badge>
                          )}

                          {model.displayType && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] uppercase font-bold px-1.5 py-0 bg-primary/5 text-primary border-primary/20"
                            >
                              {model.displayType}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          {model.chassisNo && (
                            <span className="font-mono text-[11px]">Chassis: {model.chassisNo}</span>
                          )}
                          {model.notes && (
                            <span className="truncate max-w-xs text-[11px] italic text-muted-foreground">
                              {model.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Side: Folders Count, 3-Dots Menu, & Action Pill */}
                    <div className="flex items-center gap-2.5 shrink-0 ml-4">
                      <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted border border-border/60 text-xs font-semibold text-muted-foreground">
                        <FolderOpen className="w-3.5 h-3.5 text-primary" />
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

                      <div className="w-8 h-8 rounded-xl bg-muted group-hover:bg-primary group-hover:text-white flex items-center justify-center text-muted-foreground transition-all duration-200">
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
            <div className="flex items-center justify-center pt-2 pb-4 text-xs text-muted-foreground font-medium">
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
