'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Filter,
  ArrowUpDown,
  Search,
  X,
  RotateCcw,
  SlidersHorizontal,
  Check,
  Tag,
  Hash,
  Layers,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface UniversalParamDef {
  id: string;
  name: string;
  slug: string;
  valueType: string;
  unit: string | null;
  isRequired: boolean;
}

interface UniversalItemFilterProps {
  universalParams: UniversalParamDef[];
  totalMatches: number;
  onSearchStateChange?: (isSearching: boolean) => void;
  folderName?: string;
}

export function UniversalItemFilter({
  universalParams,
  totalMatches,
  onSearchStateChange,
  folderName,
}: UniversalItemFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);

  // Local state initialized from searchParams
  const [searchVal, setSearchVal] = useState(searchParams.get('q') || '');
  const [sortVal, setSortVal] = useState(searchParams.get('sort') || 'NONE');
  const [paramInputs, setParamInputs] = useState<Record<string, {
    min?: string;
    max?: string;
    bool?: string;
    text?: string;
  }>>({});

  // Sync state from URL parameters
  useEffect(() => {
    const urlQ = searchParams.get('q') || '';
    setSearchVal(urlQ);
    setSortVal(searchParams.get('sort') || 'NONE');

    const newInputs: Record<string, { min?: string; max?: string; bool?: string; text?: string }> = {};
    for (const param of universalParams) {
      const min = searchParams.get(`p_${param.slug}_min`) || '';
      const max = searchParams.get(`p_${param.slug}_max`) || '';
      const bool = searchParams.get(`p_${param.slug}_bool`) || '';
      const text = searchParams.get(`p_${param.slug}_text`) || '';

      if (min || max || bool || text) {
        newInputs[param.slug] = { min, max, bool, text };
      }
    }
    setParamInputs(newInputs);
  }, [searchParams, universalParams]);

  // Real-time debounced live search: auto-sync query as user types without pressing Enter
  useEffect(() => {
    const currentUrlQ = searchParams.get('q') || '';
    if (searchVal === currentUrlQ) return;

    if (onSearchStateChange) onSearchStateChange(true);

    const timer = setTimeout(() => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (searchVal.trim()) {
          params.set('q', searchVal.trim());
        } else {
          params.delete('q');
        }
        router.replace(`${pathname}?${params.toString()}`);
      });
    }, 200);

    return () => clearTimeout(timer);
  }, [searchVal, searchParams, pathname, router, onSearchStateChange]);

  // Compute active filters
  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];

  const currentQ = searchParams.get('q');
  if (currentQ) {
    activeChips.push({
      key: 'q',
      label: `Search: "${currentQ}"`,
      onRemove: () => removeFilterParam(['q']),
    });
  }

  const currentSort = searchParams.get('sort');
  if (currentSort && currentSort !== 'NONE') {
    const sortLabels: Record<string, string> = {
      RECENTLY_ADDED: 'Recently Added',
      MOST_SELLING: 'Most Selling',
      LEAST_SELLING: 'Least Selling',
      MOST_VIEWED: 'Most Viewed',
      HIGHEST_PROFIT: 'Highest Profit',
      LOWEST_PROFIT: 'Lowest Profit',
      HIGHEST_COST_PRICE: 'Highest Cost Price',
      LOWEST_COST_PRICE: 'Lowest Cost Price',
      HIGHEST_SELLING_PRICE: 'Highest Selling Price',
      LOWEST_SELLING_PRICE: 'Lowest Selling Price',
      QUANTITY_HIGH_TO_LOW: 'Highest Quantity',
      QUANTITY_LOW_TO_HIGH: 'Lowest Quantity',
      NAME_ASC: 'Name (A-Z)',
      NAME_DESC: 'Name (Z-A)',
      RECENTLY_UPDATED: 'Recently Updated',
    };
    activeChips.push({
      key: 'sort',
      label: `Sort: ${sortLabels[currentSort] || currentSort}`,
      onRemove: () => removeFilterParam(['sort']),
    });
  }

  for (const param of universalParams) {
    const min = searchParams.get(`p_${param.slug}_min`);
    const max = searchParams.get(`p_${param.slug}_max`);
    const bool = searchParams.get(`p_${param.slug}_bool`);
    const text = searchParams.get(`p_${param.slug}_text`);

    if (min || max) {
      const unitStr = param.unit ? ` ${param.unit}` : '';
      let rangeStr = '';
      if (min && max) rangeStr = `${min} - ${max}${unitStr}`;
      else if (min) rangeStr = `≥ ${min}${unitStr}`;
      else if (max) rangeStr = `≤ ${max}${unitStr}`;

      activeChips.push({
        key: `range_${param.slug}`,
        label: `${param.name}: ${rangeStr}`,
        onRemove: () => removeFilterParam([`p_${param.slug}_min`, `p_${param.slug}_max`]),
      });
    }

    if (bool) {
      activeChips.push({
        key: `bool_${param.slug}`,
        label: `${param.name}: ${bool === 'true' ? 'Yes' : 'No'}`,
        onRemove: () => removeFilterParam([`p_${param.slug}_bool`]),
      });
    }

    if (text) {
      activeChips.push({
        key: `text_${param.slug}`,
        label: `${param.name}: "${text}"`,
        onRemove: () => removeFilterParam([`p_${param.slug}_text`]),
      });
    }
  }

  const hasActiveFilters = activeChips.length > 0 || searchParams.has('sort') || searchParams.has('view');

  const removeFilterParam = (keys: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    keys.forEach((k) => params.delete(k));
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleApplyFilters = () => {
    const params = new URLSearchParams();

    if (searchVal.trim()) {
      params.set('q', searchVal.trim());
    }

    if (sortVal && sortVal !== 'RECENTLY_ADDED') {
      params.set('sort', sortVal);
    }

    for (const param of universalParams) {
      const input = paramInputs[param.slug];
      if (!input) continue;

      if (input.min && input.min.trim()) {
        params.set(`p_${param.slug}_min`, input.min.trim());
      }
      if (input.max && input.max.trim()) {
        params.set(`p_${param.slug}_max`, input.max.trim());
      }
      if (input.bool && input.bool !== 'ALL') {
        params.set(`p_${param.slug}_bool`, input.bool);
      }
      if (input.text && input.text.trim()) {
        params.set(`p_${param.slug}_text`, input.text.trim());
      }
    }

    setOpen(false);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleClearAll = () => {
    setSearchVal('');
    setSortVal('NONE');
    setParamInputs({});
    setOpen(false);
    router.replace(pathname);
  };

  const handleSortChange = (newSort: string | null) => {
    if (!newSort) return;
    setSortVal(newSort);
    const params = new URLSearchParams(searchParams.toString());
    if (newSort === 'NONE') {
      params.delete('sort');
    } else {
      params.set('sort', newSort);
    }
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="space-y-2.5 w-full">
      {/* Top Filter & Sort Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 p-2.5 sm:p-3 rounded-2xl bg-muted/90 border border-border shadow-blend">
        {/* Quick Keyword search in the bar (live debounced search as you type) */}
        <div className="relative flex-1 sm:max-w-md w-full order-1 sm:order-2">
          {isPending || searchVal !== (searchParams.get('q') || '') ? (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin pointer-events-none" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          )}
          <input
            type="text"
            placeholder={folderName ? `Search in ${folderName}...` : "Search items, shortcodes, notes..."}
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="w-full pl-9 pr-8 py-2 sm:py-2.5 bg-card border border-border/90 text-foreground text-xs sm:text-sm rounded-xl placeholder:text-muted-foreground outline-none shadow-xs focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
          />
          {searchVal && (
            <button
              type="button"
              onClick={() => {
                setSearchVal('');
                const params = new URLSearchParams(searchParams.toString());
                params.delete('q');
                router.replace(`${pathname}?${params.toString()}`);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Action Controls: Filter Trigger & Smart Sort */}
        <div className="flex items-center gap-2 order-2 sm:order-1 flex-1 sm:flex-initial">
          {/* Filter Modal Trigger */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger>
              <Button
                variant={activeChips.length > 0 ? 'default' : 'outline'}
                size="sm"
                className={
                  activeChips.length > 0
                    ? 'bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 font-semibold h-9 rounded-xl shadow-md shadow-primary/20 flex-1 sm:flex-initial'
                    : 'bg-card border-border hover:bg-muted/80 text-foreground gap-1.5 h-9 rounded-xl shadow-xs flex-1 sm:flex-initial'
                }
              >
                <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs">Filter</span>
                {activeChips.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-0.5 px-1.5 py-0 h-4.5 text-[10px] bg-white text-primary font-bold rounded-full border border-primary/20"
                  >
                    {activeChips.length}
                  </Badge>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[580px] max-h-[85vh] overflow-y-auto bg-background border-border text-foreground">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-foreground text-base sm:text-lg">
                  <SlidersHorizontal className="w-5 h-5 text-primary" />
                  {folderName ? `Filter Items in ${folderName}` : 'Filter Inventory by Universal Parameters'}
                </DialogTitle>
                <DialogDescription className="text-muted-foreground text-xs">
                  {folderName
                    ? `Filter spare parts in "${folderName}" and its subfolders using technical specifications.`
                    : 'Filter spare parts across all folders using global technical specifications.'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-foreground font-semibold flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-primary" />
                    Item Name, Short Code, or Notes
                  </Label>
                  <Input
                    placeholder={folderName ? `Search in ${folderName}, #4332...` : "Search by part name, #4332, or description..."}
                    value={searchVal}
                    onChange={(e) => setSearchVal(e.target.value)}
                    className="h-9 text-xs bg-muted/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl focus-visible:bg-white"
                  />
                </div>

                <div className="space-y-4 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-primary" />
                      {folderName ? `Available Parameters (${universalParams.length})` : `Universal Parameter Filters (${universalParams.length})`}
                    </h4>
                  </div>

                  {universalParams.length === 0 ? (
                    <div className="p-4 rounded-xl bg-muted border border-border/60 text-center text-xs text-muted-foreground">
                      {folderName
                        ? 'No parameters defined for this folder or globally.'
                        : 'No Universal Parameters defined yet. Click "Universal Parameters" on the inventory page to add global specifications.'}
                    </div>
                  ) : (
                    <div className="space-y-3.5 max-h-[340px] overflow-y-auto pr-1">
                      {universalParams.map((param) => {
                        const input = paramInputs[param.slug] || {};

                        return (
                          <div
                            key={param.id}
                            className="p-3 rounded-xl border border-border/60 bg-card space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <span>{param.name}</span>
                                {param.unit && (
                                  <span className="text-primary text-[11px] font-medium">
                                    ({param.unit})
                                  </span>
                                )}
                              </Label>
                              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {param.valueType}
                              </span>
                            </div>

                            {(param.valueType === 'NUMBER' || param.valueType === 'DECIMAL') && (
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <span className="text-[10px] text-muted-foreground">Min {param.unit || ''}</span>
                                  <Input
                                    type="number"
                                    step={param.valueType === 'DECIMAL' ? '0.01' : '1'}
                                    placeholder="Min"
                                    value={input.min || ''}
                                    onChange={(e) =>
                                      setParamInputs((prev) => ({
                                        ...prev,
                                        [param.slug]: { ...prev[param.slug], min: e.target.value },
                                      }))
                                    }
                                    className="h-8 text-xs bg-background border-border text-foreground rounded-lg"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[10px] text-muted-foreground">Max {param.unit || ''}</span>
                                  <Input
                                    type="number"
                                    step={param.valueType === 'DECIMAL' ? '0.01' : '1'}
                                    placeholder="Max"
                                    value={input.max || ''}
                                    onChange={(e) =>
                                      setParamInputs((prev) => ({
                                        ...prev,
                                        [param.slug]: { ...prev[param.slug], max: e.target.value },
                                      }))
                                    }
                                    className="h-8 text-xs bg-background border-border text-foreground rounded-lg"
                                  />
                                </div>
                              </div>
                            )}

                            {param.valueType === 'BOOLEAN' && (
                              <div className="flex items-center gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={!input.bool || input.bool === 'ALL' ? 'default' : 'outline'}
                                  onClick={() =>
                                    setParamInputs((prev) => ({
                                      ...prev,
                                      [param.slug]: { ...prev[param.slug], bool: 'ALL' },
                                    }))
                                  }
                                  className="h-7 text-xs flex-1 rounded-lg"
                                >
                                  All
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={input.bool === 'true' ? 'default' : 'outline'}
                                  onClick={() =>
                                    setParamInputs((prev) => ({
                                      ...prev,
                                      [param.slug]: { ...prev[param.slug], bool: 'true' },
                                    }))
                                  }
                                  className="h-7 text-xs flex-1 rounded-lg"
                                >
                                  Yes / True
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={input.bool === 'false' ? 'default' : 'outline'}
                                  onClick={() =>
                                    setParamInputs((prev) => ({
                                      ...prev,
                                      [param.slug]: { ...prev[param.slug], bool: 'false' },
                                    }))
                                  }
                                  className="h-7 text-xs flex-1 rounded-lg"
                                >
                                  No / False
                                </Button>
                              </div>
                            )}

                            {(param.valueType === 'TEXT' || param.valueType === 'SELECT') && (
                              <div>
                                <Input
                                  placeholder={`Search in ${param.name}...`}
                                  value={input.text || ''}
                                  onChange={(e) =>
                                    setParamInputs((prev) => ({
                                      ...prev,
                                      [param.slug]: { ...prev[param.slug], text: e.target.value },
                                    }))
                                  }
                                  className="h-8 text-xs bg-background border-border text-foreground placeholder:text-muted-foreground rounded-lg"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Dialog Footer Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                    className="text-xs text-muted-foreground hover:text-foreground h-8"
                  >
                    Reset
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleApplyFilters}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs px-5 h-9 rounded-xl shadow-lg shadow-primary/10"
                  >
                    Apply Filters
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Smart Sort Dropdown */}
          <div className="flex-1 sm:flex-initial">
            <Select value={sortVal} onValueChange={handleSortChange}>
              <SelectTrigger className="h-9 w-full sm:w-[180px] text-xs bg-card border-border text-foreground rounded-xl shadow-xs hover:bg-muted/50 focus:ring-primary">
                <div className="flex items-center gap-1.5 truncate">
                  <ArrowUpDown className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">
                    {sortVal === 'NONE' ? 'Sort By' : <SelectValue />}
                  </span>
                </div>
              </SelectTrigger>
              <SelectContent className="bg-background border-border text-foreground text-xs max-h-[260px]">
                <SelectItem value="NONE">None (Default View)</SelectItem>
                <SelectItem value="RECENTLY_ADDED">Recently Added Items</SelectItem>
                <SelectItem value="MOST_SELLING">Most Selling</SelectItem>
                <SelectItem value="LEAST_SELLING">Least Selling</SelectItem>
                <SelectItem value="MOST_VIEWED">Most Viewed</SelectItem>
                <SelectItem value="HIGHEST_PROFIT">Highest Profit</SelectItem>
                <SelectItem value="LOWEST_PROFIT">Lowest Profit</SelectItem>
                <SelectItem value="HIGHEST_COST_PRICE">Highest Cost Price</SelectItem>
                <SelectItem value="LOWEST_COST_PRICE">Lowest Cost Price</SelectItem>
                <SelectItem value="HIGHEST_SELLING_PRICE">Highest Selling Price</SelectItem>
                <SelectItem value="LOWEST_SELLING_PRICE">Lowest Selling Price</SelectItem>
                <SelectItem value="QUANTITY_HIGH_TO_LOW">Highest Quantity</SelectItem>
                <SelectItem value="QUANTITY_LOW_TO_HIGH">Lowest Quantity</SelectItem>
                <SelectItem value="NAME_ASC">Name (A-Z)</SelectItem>
                <SelectItem value="NAME_DESC">Name (Z-A)</SelectItem>
                <SelectItem value="RECENTLY_UPDATED">Recently Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Active Filter Chips Bar */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-0.5 pb-1">
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <Filter className="w-3 h-3 text-primary" />
            Filtered ({totalMatches}):
          </span>

          {activeChips.map((chip) => (
            <Badge
              key={chip.key}
              variant="secondary"
              className="bg-primary/10 text-primary border-primary/20 text-xs px-2.5 py-0.5 gap-1.5 rounded-lg flex items-center group cursor-pointer hover:bg-primary/15 transition-colors"
              onClick={chip.onRemove}
            >
              <span>{chip.label}</span>
              <X className="w-3 h-3 text-primary group-hover:text-foreground" />
            </Badge>
          ))}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
          >
            Clear All
          </Button>
        </div>
      )}
    </div>
  );
}
