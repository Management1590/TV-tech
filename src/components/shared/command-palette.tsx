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
  ChevronDown,
  ChevronUp,
  Folder,
  Layers,
  Building2,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

interface GroupedSearchResultsData {
  items: SearchResult[];
  folders: SearchResult[];
  tvBrands: SearchResult[];
  tvModels: SearchResult[];
  kbFolders: SearchResult[];
  suppliers: SearchResult[];
}

const ENTITY_ICONS: Record<string, typeof Package> = {
  ITEM: Package,
  FOLDER: FolderOpen,
  TV_MODEL: Monitor,
  TV_BRAND: Tv,
  KB_FOLDER: Folder,
  SUPPLIER: Tag,
  CODE: Hash,
};

const CATEGORY_LABELS: Record<string, string> = {
  TV_BRAND: 'TV Brand',
  TV_MODEL: 'TV Model',
  KB_FOLDER: 'KB Folder',
  ITEM: 'Item',
  CODE: 'Code',
  FOLDER: 'Folder',
  SUPPLIER: 'Supplier',
};

const INITIAL_SECTION_LIMIT = 5;

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
  const [groupedData, setGroupedData] = useState<GroupedSearchResultsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
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

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults([]);
      setGroupedData(null);
      setSelectedIndex(0);
      setExpandedSections({});
    }
  }, [open]);

  // Debounced search with contextual directory scope
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setGroupedData(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          q: query,
          scope,
          limit: '50',
          ...(brandId ? { brandId } : {}),
        });

        const res = await fetch(`/api/search?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
          if (data.data) {
            setGroupedData({
              items: (data.data.items || []).map(formatRawResult),
              folders: (data.data.folders || []).map(formatRawResult),
              tvBrands: (data.data.tvBrands || []).map(formatRawResult),
              tvModels: (data.data.tvModels || []).map(formatRawResult),
              kbFolders: (data.data.kbFolders || []).map(formatRawResult),
              suppliers: (data.data.suppliers || []).map(formatRawResult),
            });
          } else {
            setGroupedData(null);
          }
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

  function formatRawResult(r: any): SearchResult {
    return {
      id: r.id,
      entityType: r.entityType,
      title: (r.title || '').replace(/_\d{10,}$/, ''),
      subtitle: r.subtitle,
      entityId: r.id,
      thumbnailUrl: r.thumbnailUrl,
      linkUrl: r.linkUrl,
      shortCode: r.shortCode,
      score: r.matchScore ?? r.score ?? 0,
    };
  }

  // 5/5/5 Section Categorization
  const sections = useMemo(() => {
    if (scope !== 'all') {
      // Scoped Knowledge Base Search (Single List)
      return [
        {
          key: 'scoped',
          title: scope === 'brands' ? 'TV Brands' : 'TV Models',
          icon: scope === 'brands' ? Tv : Monitor,
          items: results.map((r) => ({
            ...r,
            title: r.title.replace(/_\d{10,}$/, ''),
          })),
        },
      ];
    }

    // Universal Search: 3 core sections (Items -> Directory/Folders -> Knowledge Base -> Suppliers)
    const itemsList = (groupedData?.items || results.filter((r) => r.entityType === 'ITEM')).map((r) => ({
      ...r,
      title: r.title.replace(/_\d{10,}$/, ''),
    }));

    const foldersList = (groupedData?.folders || results.filter((r) => r.entityType === 'FOLDER')).map((r) => ({
      ...r,
      title: r.title.replace(/_\d{10,}$/, ''),
    }));

    const kbList: SearchResult[] = (
      groupedData
        ? [...groupedData.tvBrands, ...groupedData.tvModels, ...groupedData.kbFolders]
        : results.filter((r) => ['TV_BRAND', 'TV_MODEL', 'KB_FOLDER'].includes(r.entityType))
    )
      .sort((a, b) => b.score - a.score)
      .map((r) => ({
        ...r,
        title: r.title.replace(/_\d{10,}$/, ''),
      }));

    const suppliersList = (groupedData?.suppliers || results.filter((r) => r.entityType === 'SUPPLIER')).map((r) => ({
      ...r,
      title: r.title.replace(/_\d{10,}$/, ''),
    }));

    const resultSections = [];

    // 1. Top Matched Items (5 Initial)
    if (itemsList.length > 0) {
      resultSections.push({
        key: 'items',
        title: 'Inventory Items',
        icon: Package,
        items: itemsList,
      });
    }

    // 2. Currently Opened Directory / Inventory Folders (5 Initial)
    if (foldersList.length > 0) {
      resultSections.push({
        key: 'folders',
        title: 'Directory & Folders',
        icon: FolderOpen,
        items: foldersList,
      });
    }

    // 3. Knowledge Base Module (Brands, Models & Folders) (5 Initial)
    if (kbList.length > 0) {
      resultSections.push({
        key: 'kb',
        title: 'Knowledge Base',
        icon: Tv,
        items: kbList,
      });
    }

    // 4. Suppliers (if any match)
    if (suppliersList.length > 0) {
      resultSections.push({
        key: 'suppliers',
        title: 'Suppliers',
        icon: Building2,
        items: suppliersList,
      });
    }

    return resultSections;
  }, [results, groupedData, scope]);

  // Flatten currently visible items for continuous arrow keyboard navigation
  const flatVisibleResults = useMemo(() => {
    const list: SearchResult[] = [];
    sections.forEach((sec) => {
      const isExpanded = expandedSections[sec.key];
      const visibleCount = isExpanded ? sec.items.length : INITIAL_SECTION_LIMIT;
      list.push(...sec.items.slice(0, visibleCount));
    });
    return list;
  }, [sections, expandedSections]);

  const toggleSection = (sectionKey: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const navigateToResult = useCallback(
    (result: SearchResult) => {
      if (result.linkUrl) {
        router.push(result.linkUrl);
      } else if (result.entityType === 'TV_BRAND') {
        router.push(`/knowledge-base/brands/${result.entityId || result.id}`);
      } else if (result.entityType === 'TV_MODEL') {
        router.push(`/knowledge-base/models/${result.entityId || result.id}`);
      } else if (result.entityType === 'FOLDER') {
        router.push(`/inventory/folders/${result.entityId || result.id}`);
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
      setSelectedIndex((prev) => Math.min(prev + 1, flatVisibleResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && flatVisibleResults[selectedIndex]) {
      e.preventDefault();
      navigateToResult(flatVisibleResults[selectedIndex]);
    }
  };

  if (isSearchDisabled) {
    return null;
  }

  // Count total matches across all sections
  const totalMatchesCount = sections.reduce((acc, s) => acc + s.items.length, 0);

  return (
    <>
      {/* Top Header Trigger Button */}
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center justify-between gap-3 px-3.5 py-2 sm:py-1.5 min-h-[44px] sm:min-h-0 w-full max-w-md text-xs rounded-xl border transition-all duration-200 active:scale-[0.98] cursor-pointer shadow-sm-2xs ${
          isKbRoute
            ? 'bg-primary/5 hover:bg-primary/5 border-primary/20 hover:border-primary/25 text-primary hover:shadow-sm'
            : 'bg-muted/90 hover:bg-white border-border/80 hover:border-primary/40 text-muted-foreground hover:text-foreground hover:shadow-sm'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {isKbRoute ? (
            <div className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
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
              className="hidden sm:inline-flex text-[9px] py-0 px-1.5 bg-white text-primary border-primary/20 font-bold uppercase tracking-wider"
            >
              {scope === 'brands' ? 'Brands Only' : 'Models Only'}
            </Badge>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-semibold bg-white border border-border px-1.5 py-0.5 rounded-md shadow-sm-2xs">
            ⌘K
          </kbd>
        </div>
      </button>

      {/* Full-Featured Command Palette / Search Window Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] sm:max-h-none sm:max-w-[620px] p-0 gap-0 overflow-hidden bg-white border border-border/80 shadow-sm-2xl rounded-2xl">
          {/* Header Context Scoping Banner */}
          {isKbRoute && (
            <div className="px-4 py-2.5 bg-gradient-to-r from-primary/5 via-indigo-50/40 to-slate-50 border-b border-primary/8/80 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-primary/90 font-bold">
                <div className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <Tv className="w-3.5 h-3.5" />
                </div>
                <span>{scopeTitle}</span>
              </div>
              <Badge
                variant="outline"
                className="text-[10px] bg-white text-primary border-primary/20 font-bold"
              >
                Directory Scope: {scope === 'brands' ? 'Brands' : 'Models'}
              </Badge>
            </div>
          )}

          {/* Search Input Bar */}
          <div className="flex items-center gap-3 px-4 py-3.5 sm:py-3.5 bg-muted/80 border-b border-border/80">
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

          {/* Results List with 5/5/5 Section Grouping */}
          <div className="max-h-[62vh] sm:max-h-[420px] overflow-y-auto divide-y divide-border/40">
            {query.length < 2 && (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                <p className="font-medium">
                  {isKbRoute
                    ? scope === 'brands'
                      ? 'Type a TV Brand name (e.g. Samsung, LG, Sony, TCL)...'
                      : 'Type a TV Model number or chassis code (e.g. 55NU7100, OLED)...'
                    : 'Type at least 2 characters to search across all modules...'}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Subsequence character matching enabled
                </p>
              </div>
            )}

            {query.length >= 2 && !isLoading && totalMatchesCount === 0 && (
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

            {/* Render 5/5/5 Categorized Sections */}
            {sections.map((section) => {
              const isExpanded = expandedSections[section.key] || false;
              const visibleItems = isExpanded ? section.items : section.items.slice(0, INITIAL_SECTION_LIMIT);
              const remainingCount = section.items.length - INITIAL_SECTION_LIMIT;
              const SectionIcon = section.icon;

              return (
                <div key={section.key} className="py-1">
                  {/* Section Header */}
                  <div className="px-4 py-2 flex items-center justify-between bg-muted/90 border-y border-border/40">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                        <SectionIcon className="w-3 h-3" />
                      </div>
                      <span className="text-[11px] font-black text-foreground/90 uppercase tracking-wider">
                        {section.title}
                      </span>
                    </div>

                    <Badge
                      variant="secondary"
                      className="text-[10px] font-bold px-1.5 py-0 bg-white border border-border/80 text-foreground/80 shadow-sm-2xs"
                    >
                      {isExpanded
                        ? `All ${section.items.length}`
                        : `${Math.min(visibleItems.length, section.items.length)} of ${section.items.length}`}
                    </Badge>
                  </div>

                  {/* Section Items */}
                  <div className="divide-y divide-border/30">
                    {visibleItems.map((result) => {
                      const Icon = ENTITY_ICONS[result.entityType] ?? Package;
                      const globalIdx = flatVisibleResults.findIndex((r) => r.id === result.id && r.entityType === result.entityType);
                      const isSelected = globalIdx === selectedIndex;
                      const parsedThumbnail = parseThumbnailUrl(result.thumbnailUrl);

                      return (
                        <button
                          key={`${result.entityType}_${result.id}`}
                          onClick={() => navigateToResult(result)}
                          className={`w-full flex items-center justify-between gap-3 px-4 py-3 sm:py-2.5 min-h-[50px] sm:min-h-0 text-left transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-primary/10 text-foreground'
                              : 'hover:bg-muted/50 text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Rich Proportional Thumbnail Preview */}
                            <div
                              className={`w-10 h-10 rounded-xl border flex items-center justify-center overflow-hidden shrink-0 shadow-sm-2xs relative ${
                                parsedThumbnail.url
                                  ? 'bg-muted border-border/80'
                                  : result.entityType === 'FOLDER' || result.entityType === 'KB_FOLDER'
                                  ? 'bg-primary/5 border-primary/20 text-primary'
                                  : result.entityType === 'ITEM'
                                  ? 'bg-indigo-50/90 border-indigo-200/90 text-indigo-600'
                                  : result.entityType === 'TV_BRAND'
                                  ? 'bg-violet-50/90 border-violet-200/90 text-violet-600'
                                  : result.entityType === 'TV_MODEL'
                                  ? 'bg-muted border-border text-foreground/80'
                                  : 'bg-amber-50/90 border-amber-200/90 text-amber-600'
                              }`}
                            >
                              {parsedThumbnail.url ? (
                                <img
                                  src={parsedThumbnail.url}
                                  alt={result.title}
                                  className="w-full h-full object-cover object-center"
                                  loading="lazy"
                                />
                              ) : (
                                <Icon className="h-5 w-5" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-bold truncate text-foreground leading-tight">
                                {result.title}
                              </p>
                              {result.subtitle && (
                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                  {result.subtitle}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {result.shortCode && (
                              <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 text-primary border-primary/30 bg-primary/5">
                                #{result.shortCode}
                              </Badge>
                            )}
                            <Badge
                              variant="secondary"
                              className="text-[9px] sm:text-[10px] font-semibold bg-muted text-foreground/80 py-0"
                            >
                              {CATEGORY_LABELS[result.entityType] || result.entityType}
                            </Badge>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Expand / Show More Button for this Section */}
                  {section.items.length > INITIAL_SECTION_LIMIT && (
                    <div className="px-4 py-1.5 bg-muted/40">
                      <button
                        type="button"
                        onClick={() => toggleSection(section.key)}
                        className="w-full py-1.5 px-3 rounded-xl border border-dashed border-border/80 hover:border-primary/40 bg-white hover:bg-muted/50 text-xs font-bold text-primary flex items-center justify-center gap-1.5 transition-all shadow-sm-2xs cursor-pointer active:scale-[0.99]"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5" />
                            <span>Show fewer {section.title.toLowerCase()}</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5" />
                            <span>
                              Show {remainingCount} more {section.title.toLowerCase()}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer with Keyboard Shortcuts & Total Results Count */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/80 border-t border-border text-[11px] text-muted-foreground">
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
            <span className="font-bold text-foreground">
              {totalMatchesCount} total {totalMatchesCount === 1 ? 'match' : 'matches'}
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

