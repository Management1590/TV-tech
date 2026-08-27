'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Search,
  Package,
  FolderOpen,
  Monitor,
  Tag,
  Hash,
  Loader2,
  Tv,
  Sparkles,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { parseThumbnailUrl } from '@/lib/thumbnail-utils';

interface SearchResult {
  id: string;
  entityType: string;
  title: string;
  subtitle?: string;
  thumbnailUrl?: string | null;
  entityId: string;
  shortCode?: string | null;
  score: number;
  linkUrl?: string;
}

const ENTITY_ICONS: Record<string, typeof Package> = {
  ITEM: Package,
  FOLDER: FolderOpen,
  TV_MODEL: Monitor,
  TV_BRAND: Tv,
  SUPPLIER: Tag,
  CODE: Hash,
};

const CATEGORY_LABELS: Record<string, string> = {
  TV_BRAND: 'TV Brands',
  TV_MODEL: 'TV Models',
  ITEM: 'Inventory Items',
  CODE: 'Short Codes',
  FOLDER: 'Folders',
  SUPPLIER: 'Suppliers',
};

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();

  // Determine current directory and search scope
  const { isKbRoute, isSearchDisabled, scope, brandId, scopeTitle, placeholderText } = useMemo(() => {
    if (!pathname.startsWith('/knowledge-base')) {
      return {
        isKbRoute: false,
        isSearchDisabled: false,
        scope: 'all',
        brandId: undefined,
        scopeTitle: 'Universal Search',
        placeholderText: 'Search items, folders, TV models...',
      };
    }

    // Inside /knowledge-base/brands/[id]
    const brandMatch = pathname.match(/^\/knowledge-base\/brands\/([^\/]+)/);
    if (brandMatch) {
      return {
        isKbRoute: true,
        isSearchDisabled: false,
        scope: 'models',
        brandId: brandMatch[1],
        scopeTitle: 'Brand Directory • Models Search',
        placeholderText: 'Search models under this brand (e.g. 55NU7100, OLED)...',
      };
    }

    // Inside /knowledge-base/models/[id] (Technical Folders - Search Disabled)
    const modelMatch = pathname.match(/^\/knowledge-base\/models\/([^\/]+)/);
    if (modelMatch) {
      return {
        isKbRoute: true,
        isSearchDisabled: true,
        scope: 'none',
        brandId: undefined,
        scopeTitle: '',
        placeholderText: '',
      };
    }

    // Root Knowledge Base: /knowledge-base
    return {
      isKbRoute: true,
      isSearchDisabled: false,
      scope: 'brands',
      brandId: undefined,
      scopeTitle: 'Root Directory • TV Brands Search',
      placeholderText: 'Search TV brands (e.g. Samsung, LG, Sony)...',
    };
  }, [pathname]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Listen for Ctrl/Cmd + K or '/'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      } else if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  // Debounced search with contextual directory scope
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          q: query,
          scope,
          ...(brandId ? { brandId } : {}),
        });

        const res = await fetch(`/api/search?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
          setSelectedIndex(0);
        }
      } catch {
        // Silently fail
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query, scope, brandId]);

  const navigateToResult = useCallback(
    (result: SearchResult) => {
      if (result.linkUrl) {
        router.push(result.linkUrl);
      } else if (result.entityType === 'TV_BRAND') {
        router.push(`/knowledge-base/brands/${result.entityId || result.id}`);
      } else if (result.entityType === 'TV_MODEL') {
        router.push(`/knowledge-base/models/${result.entityId || result.id}`);
      } else {
        router.push(`/inventory/items/${result.entityId || result.id}`);
      }
      setOpen(false);
    },
    [router]
  );

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      navigateToResult(results[selectedIndex]);
    }
  };

  if (isSearchDisabled) {
    return null;
  }

  return (
    <>
      {/* Top Header Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center justify-between gap-3 px-3.5 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 w-full max-w-md text-xs rounded-xl border transition-all duration-200 active:scale-[0.98] cursor-pointer shadow-2xs ${
          isKbRoute
            ? 'bg-blue-50/70 hover:bg-blue-50 border-blue-200/80 hover:border-blue-300 text-blue-950 hover:shadow-sm'
            : 'bg-slate-100/90 hover:bg-white border-border/80 hover:border-primary/40 text-muted-foreground hover:text-foreground hover:shadow-sm'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {isKbRoute ? (
            <div className="w-5 h-5 rounded-md bg-blue-600/10 text-blue-600 flex items-center justify-center shrink-0">
              <Tv className="h-3 w-3" />
            </div>
          ) : (
            <Search className="h-3.5 w-3.5 text-primary shrink-0" />
          )}
          <span className="truncate font-medium text-xs sm:hidden">
            {isKbRoute
              ? scope === 'brands'
                ? 'Search Brands...'
                : 'Search Models...'
              : 'Search...'}
          </span>
          <span className="truncate font-medium text-xs hidden sm:inline">
            {isKbRoute
              ? scope === 'brands'
                ? 'Search Brands in Directory...'
                : 'Search Models under this Brand...'
              : 'Search items, folders, TV models...'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isKbRoute && (
            <Badge
              variant="outline"
              className="hidden sm:inline-flex text-[9px] py-0 px-1.5 bg-white text-blue-600 border-blue-200 font-bold uppercase tracking-wider"
            >
              {scope === 'brands' ? 'Brands Only' : 'Models Only'}
            </Badge>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-semibold bg-white border border-border px-1.5 py-0.5 rounded-md shadow-2xs">
            ⌘K
          </kbd>
        </div>
      </button>

      {/* Full-Featured Command Palette / Search Window Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] sm:max-h-none sm:max-w-[600px] p-0 gap-0 overflow-hidden bg-white border border-border/80 shadow-2xl rounded-2xl">
          {/* Header Context Scoping Banner */}
          {isKbRoute && (
            <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50 via-indigo-50/40 to-slate-50 border-b border-blue-100/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-blue-900 font-bold">
                <div className="w-5 h-5 rounded-md bg-blue-600/10 text-blue-600 flex items-center justify-center">
                  <Tv className="w-3.5 h-3.5" />
                </div>
                <span>{scopeTitle}</span>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] bg-white text-blue-700 border-blue-200 font-bold"
              >
                Directory Scope: {scope === 'brands' ? 'Brands' : 'Models'}
              </Badge>
            </div>
          )}

          {/* Search Input Bar */}
          <div className="flex items-center gap-3 px-4 py-4 sm:py-3.5 bg-slate-50/80 border-b border-border/80">
            {isLoading ? (
              <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
            ) : isKbRoute ? (
              <Tv className="h-4 w-4 text-primary shrink-0" />
            ) : (
              <Search className="h-4 w-4 text-primary shrink-0" />
            )}
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholderText}
              className="flex-1 bg-transparent text-base sm:text-sm text-foreground placeholder:text-muted-foreground outline-none font-medium"
            />
          </div>

          {/* Results List with Thumbnail Preview */}
          <div className="max-h-[60vh] sm:max-h-[390px] overflow-y-auto divide-y divide-border/40">
            {query.length < 2 && (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                <p className="font-medium">
                  {isKbRoute
                    ? scope === 'brands'
                      ? 'Type a TV Brand name (e.g. Samsung, LG, Sony, TCL)...'
                      : 'Type a TV Model number or chassis code (e.g. 55NU7100, OLED)...'
                    : 'Type at least 2 characters to search...'}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Subsequence character matching enabled
                </p>
              </div>
            )}

            {query.length >= 2 && !isLoading && results.length === 0 && (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                <p className="font-bold text-foreground">No matches found for &ldquo;{query}&rdquo;</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {isKbRoute
                    ? scope === 'brands'
                      ? 'No TV brands found matching your search in this directory.'
                      : 'No models found under this directory.'
                    : 'Try checking for spelling or searching for a different keyword.'}
                </p>
              </div>
            )}

            {results.map((result, idx) => {
              const Icon = ENTITY_ICONS[result.entityType] ?? Package;
              const prevResult = results[idx - 1];
              const showCategoryHeader = !prevResult || prevResult.entityType !== result.entityType;

              // Parse thumbnail URL to cleanly extract the image
              const parsedThumbnail = parseThumbnailUrl(result.thumbnailUrl);

              return (
                <React.Fragment key={`${result.entityType}_${result.id}_${idx}`}>
                  {showCategoryHeader && !isKbRoute && (
                    <div className="px-4 pt-3 pb-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider bg-slate-50/60 border-t border-border/40 first:border-t-0 first:pt-2">
                      {CATEGORY_LABELS[result.entityType] || result.entityType}
                    </div>
                  )}
                  <button
                    onClick={() => navigateToResult(result)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 sm:py-3 min-h-[52px] sm:min-h-0 text-left transition-colors cursor-pointer ${
                      idx === selectedIndex
                        ? 'bg-primary/10 text-foreground'
                        : 'hover:bg-slate-50 text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Rich Thumbnail Preview */}
                      <div className="w-12 h-10 rounded-xl bg-slate-100 border border-border/80 flex items-center justify-center text-primary overflow-hidden shrink-0 shadow-2xs relative">
                        {parsedThumbnail.url ? (
                          <img
                            src={parsedThumbnail.url}
                            alt={result.title}
                            style={{
                              transform: `translate(${parsedThumbnail.x}px, ${parsedThumbnail.y}px) scale(${parsedThumbnail.scale})`,
                              transformOrigin: 'center center',
                            }}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Icon className="h-5 w-5 text-primary" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-bold truncate text-foreground">{result.title}</p>
                        {result.subtitle && (
                          <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {result.shortCode && (
                        <Badge variant="outline" className="font-mono text-[10px]">
                          #{result.shortCode}
                        </Badge>
                      )}
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-semibold bg-slate-100 text-slate-700"
                      >
                        {CATEGORY_LABELS[result.entityType] || result.entityType.replace('_', ' ')}
                      </Badge>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Footer with Keyboard Shortcuts & Status */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/80 border-t border-border text-[11px] text-muted-foreground">
            <div className="hidden sm:flex items-center gap-2">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-white border border-border rounded text-[10px]">↑↓</kbd> Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-white border border-border rounded text-[10px]">↵</kbd> Open
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-white border border-border rounded text-[10px]">Esc</kbd> Close
              </span>
            </div>
            <span className="font-semibold text-foreground">{results.length} results</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
