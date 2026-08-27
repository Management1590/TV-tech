import React, { Suspense } from 'react';
import Link from 'next/link';
import { Search as SearchIcon, Package, FolderOpen, Monitor, Tag, Hash } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { universalSearch, SearchResultItem } from '@/features/search/services/search.service';

export const dynamic = 'force-dynamic';

interface SearchResult {
  id: string;
  entityType: string;
  title: string;
  subtitle?: string;
  entityId: string;
  linkUrl?: string;
  shortCode?: string | null;
  score: number;
  folders?: string[];
}

async function performSearch(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length < 1) return [];

  const grouped = await universalSearch(query, 50);

  const sortedItems = [...grouped.items].sort((a, b) => b.matchScore - a.matchScore);
  const sortedFolders = [...grouped.folders].sort((a, b) => b.matchScore - a.matchScore);
  const sortedTvModels = [...grouped.tvModels].sort((a, b) => b.matchScore - a.matchScore);
  const sortedSuppliers = [...grouped.suppliers].sort((a, b) => b.matchScore - a.matchScore);

  const flatList: SearchResult[] = [
    ...sortedItems,
    ...sortedFolders,
    ...sortedTvModels,
    ...sortedSuppliers,
  ].map((item) => ({
    id: `${item.entityType}_${item.id}`,
    entityType: item.entityType,
    title: item.title,
    subtitle: item.subtitle,
    entityId: item.id,
    linkUrl: item.linkUrl,
    shortCode: item.shortCode,
    score: item.matchScore,
  }));

  return flatList;
}

const ENTITY_ICONS: Record<string, typeof Package> = {
  ITEM: Package,
  FOLDER: FolderOpen,
  TV_MODEL: Monitor,
  TV_BRAND: Monitor,
  SUPPLIER: Tag,
  CODE: Hash,
};

const ENTITY_LINKS: Record<string, (id: string) => string> = {
  ITEM: (id) => `/inventory/items/${id}`,
  FOLDER: (id) => `/inventory/folders/${id}`,
  TV_MODEL: (id) => `/knowledge-base/models/${id}`,
  TV_BRAND: (id) => `/knowledge-base`,
  SUPPLIER: (id) => `/inventory`,
  CODE: (id) => `/inventory/items/${id}`,
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';
  let results = query.length >= 2 ? await performSearch(query) : [];

  // Fetch folders for ITEM results
  const itemIds = results.filter((r) => r.entityType === 'ITEM').map((r) => r.entityId);
  if (itemIds.length > 0) {
    const itemFolders = await prisma.folderItem.findMany({
      where: { itemId: { in: itemIds } },
      include: { folder: { select: { name: true } } },
    });

    const foldersByItem = itemFolders.reduce((acc, fi) => {
      if (!acc[fi.itemId]) acc[fi.itemId] = [];
      acc[fi.itemId].push(fi.folder.name);
      return acc;
    }, {} as Record<string, string[]>);

    results = results.map((r) => {
      if (r.entityType === 'ITEM' && foldersByItem[r.entityId]) {
        return { ...r, folders: foldersByItem[r.entityId] };
      }
      return r;
    });
  }

  // Group results by entity type
  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    const key = r.entityType;
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const groupOrder = ['ITEM', 'CODE', 'FOLDER', 'TV_MODEL', 'TV_BRAND', 'SUPPLIER'];
  const groupLabels: Record<string, string> = {
    ITEM: 'Inventory Items',
    CODE: 'Short Codes',
    FOLDER: 'Folders',
    TV_MODEL: 'TV Models',
    TV_BRAND: 'TV Brands',
    SUPPLIER: 'Suppliers',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Search Results</h1>
        {query && (
          <p className="text-sm text-muted-foreground mt-1">
            {results.length} results for &ldquo;{query}&rdquo;
          </p>
        )}
      </div>

      {!query && (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-50/80 border border-border/80 rounded-3xl p-8 shadow-blend">
          <div className="w-16 h-16 rounded-2xl bg-white border border-primary/20 flex items-center justify-center mb-4 shadow-sm">
            <SearchIcon className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold mb-1 text-foreground">Universal Search</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Search across items, folders, TV models, suppliers, codes, and more.
          </p>
        </div>
      )}

      {query && results.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-slate-50/80 border border-border/80 rounded-3xl p-8 shadow-blend">
          <div className="w-16 h-16 rounded-2xl bg-white border border-border flex items-center justify-center mb-4 shadow-sm">
            <SearchIcon className="h-8 w-8 text-muted-foreground/60" />
          </div>
          <h3 className="text-lg font-bold mb-1 text-foreground">No Results Found</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Try a different search term or check your spelling.
          </p>
        </div>
      )}

      {/* Grouped Results */}
      {groupOrder.map((type) => {
        const items = grouped[type];
        if (!items?.length) return null;
        const Icon = ENTITY_ICONS[type] ?? Package;
        const getLink = ENTITY_LINKS[type] ?? (() => '/');

        return (
          <div key={type} className="space-y-3">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Icon className="h-4 w-4 text-primary" />
              {groupLabels[type] ?? type}
              <Badge variant="secondary" className="text-[10px] bg-slate-100 text-foreground border border-border">{items.length}</Badge>
            </h2>
            <div className="space-y-2.5">
              {items.map((result) => (
                <Link key={result.id} href={result.linkUrl || getLink(result.entityId)} className="block group">
                  <Card className="glass-card p-4 bg-white border border-border/80 hover:border-primary/40 hover:shadow-lg transition-all duration-200 cursor-pointer group-hover:-translate-y-0.5 shadow-2xs">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-100/90 border border-border/80 flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
                        <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
                          {result.title}
                        </p>
                        {result.subtitle && (
                          <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                        )}
                        {result.folders && result.folders.length > 0 && (
                          <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
                            <span className="text-[10px] text-muted-foreground font-medium mr-1">Located in:</span>
                            {result.folders.map(folder => (
                              <Badge key={folder} variant="secondary" className="text-[10px] px-1.5 py-0 bg-slate-100 text-foreground border border-border/80">{folder}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      {result.shortCode && (
                        <Badge variant="outline" className="font-mono text-xs shrink-0 bg-primary/10 text-primary border-primary/20 font-semibold px-2 py-0.5">
                          #{result.shortCode}
                        </Badge>
                      )}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
            <Separator className="my-3 border-border/60" />
          </div>
        );
      })}
    </div>
  );
}
