"use client";

import React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpDown } from 'lucide-react';

interface SortFilterBarProps {
  folderId?: string;
  onSortChange?: (mode: string) => void;
}

export function SortFilterBar({ folderId, onSortChange }: SortFilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const sortMode = searchParams.get('sort') || 'RECENTLY_ADDED';

  const handleSortChange = (value: string | null) => {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', value);
    // Remove any leftover filter parameters
    params.delete('inStock');
    params.delete('outOfStock');
    params.delete('hasImages');
    router.replace(`${pathname}?${params.toString()}`);
    if (onSortChange) onSortChange(value);
  };

  return (
    <div className="flex items-center justify-end gap-2 w-full">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
          <ArrowUpDown className="w-3.5 h-3.5 text-primary" />
          Sort by:
        </span>
        <Select value={sortMode} onValueChange={handleSortChange}>
          <SelectTrigger className="h-8.5 w-[180px] sm:w-[200px] text-xs bg-muted border-border text-foreground rounded-xl focus:ring-primary">
            <SelectValue placeholder="Sort By" />
          </SelectTrigger>
          <SelectContent className="bg-background border-border text-foreground text-xs">
            <SelectItem value="MOST_SELLING">Most Selling</SelectItem>
            <SelectItem value="LEAST_SELLING">Least Selling</SelectItem>
            <SelectItem value="FAST_MOVING">Fast Moving</SelectItem>
            <SelectItem value="SLOW_MOVING">Slow Moving</SelectItem>
            <SelectItem value="MOST_VIEWED">Most Viewed</SelectItem>
            <SelectItem value="RECENTLY_ADDED">Recently Added</SelectItem>
            <SelectItem value="RECENTLY_UPDATED">Recently Updated</SelectItem>
            <SelectItem value="RECENTLY_PURCHASED">Recently Purchased</SelectItem>
            <SelectItem value="HIGHEST_PROFIT">Highest Profit</SelectItem>
            <SelectItem value="LOWEST_PROFIT">Lowest Profit</SelectItem>
            <SelectItem value="HIGHEST_COST_PRICE">Highest Cost Price</SelectItem>
            <SelectItem value="LOWEST_COST_PRICE">Lowest Cost Price</SelectItem>
            <SelectItem value="HIGHEST_SELLING_PRICE">Highest Selling Price</SelectItem>
            <SelectItem value="LOWEST_SELLING_PRICE">Lowest Selling Price</SelectItem>
            <SelectItem value="NAME_ASC">Name (A-Z)</SelectItem>
            <SelectItem value="NAME_DESC">Name (Z-A)</SelectItem>
            <SelectItem value="QUANTITY_HIGH_TO_LOW">Highest Quantity</SelectItem>
            <SelectItem value="QUANTITY_LOW_TO_HIGH">Lowest Quantity</SelectItem>
            <SelectItem value="NOT_SOLD_RECENTLY">Not Sold Recently</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
