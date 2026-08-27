import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Tag } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import { CreateFolderDialog } from '@/components/inventory/create-folder-dialog';
import { CreateItemDialog } from '@/components/inventory/create-item-dialog';
import { LinkExistingItemDialog } from '@/components/inventory/link-existing-item-dialog';
import { ManageParametersDialog } from '@/components/inventory/manage-parameters-dialog';
import { FolderViewContainer } from '@/components/inventory/folder-view-container';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { SmartSortMode } from '@/features/analytics/services/analytics.service';
import { getEffectiveParameterDefinitions } from '@/features/inventory/services/parameter.service';
import { filterUniversalInventoryItems } from '@/features/inventory/services/inventory-filter.service';

export const dynamic = 'force-dynamic';

export default async function NestedFolderViewPage(props: {
  params: Promise<{ path: string[] }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await props.params;
  const searchParams = props.searchParams ? await props.searchParams : {};
  const { path } = params;
  const folderId = path[path.length - 1];

  const user = await getCurrentUser();
  const userRole = user?.role || 'STAFF';

  // Extract query, sort, and parameter filters
  const q = typeof searchParams.q === 'string' ? searchParams.q : undefined;
  const sort =
    typeof searchParams.sort === 'string' && searchParams.sort !== 'NONE'
      ? (searchParams.sort as SmartSortMode)
      : undefined;

  const paramFilters: Record<
    string,
    { min?: number; max?: number; boolValue?: boolean; textQuery?: string }
  > = {};

  for (const [key, val] of Object.entries(searchParams)) {
    if (typeof val !== 'string' || !val) continue;
    if (key.startsWith('p_') && key.endsWith('_min')) {
      const slug = key.slice(2, -4);
      if (!paramFilters[slug]) paramFilters[slug] = {};
      paramFilters[slug].min = Number(val);
    } else if (key.startsWith('p_') && key.endsWith('_max')) {
      const slug = key.slice(2, -4);
      if (!paramFilters[slug]) paramFilters[slug] = {};
      paramFilters[slug].max = Number(val);
    } else if (key.startsWith('p_') && key.endsWith('_bool')) {
      const slug = key.slice(2, -5);
      if (!paramFilters[slug]) paramFilters[slug] = {};
      paramFilters[slug].boolValue = val === 'true';
    } else if (key.startsWith('p_') && key.endsWith('_text')) {
      const slug = key.slice(2, -5);
      if (!paramFilters[slug]) paramFilters[slug] = {};
      paramFilters[slug].textQuery = val;
    }
  }

  const isFilterOrSortActive =
    !!q || Object.keys(paramFilters).length > 0 || !!sort;

  // Fetch the current folder by ID, Entity ID, Slug, or Materialized Path
  const folder = await prisma.folder.findFirst({
    where: {
      OR: [
        { id: folderId },
        { entityId: folderId },
        { slug: folderId },
        { materializedPath: path.join('/') },
      ],
    },
    include: {
      children: {
        orderBy: [
          { openCount: 'desc' },
          { sortOrder: 'asc' },
        ],
        include: {
          _count: { select: { folderItems: true, children: true } },
        },
      },
      folderItems: {
        orderBy: { sortOrder: 'asc' },
        include: {
          item: {
            include: {
              supplierRecords: {
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
              stockSettings: true,
              entity: {
                include: {
                  mediaAttachments: {
                    include: { media: true },
                    orderBy: [
                      { sortOrder: 'asc' },
                      { createdAt: 'desc' },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      parameterDefinitions: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  if (!folder) return notFound();

  // Increment folder open count asynchronously for "Most Opened" directory ranking
  prisma.folder
    .update({
      where: { id: folder.id },
      data: { openCount: { increment: 1 } },
    })
    .catch((err) => {
      console.error('[FOLDER OPEN TRACKING ERROR]', err);
    });

  // Run dynamic subtree filter scoped to this folder & its descendant subfolders
  const filterResult = await filterUniversalInventoryItems({
    folderId: folder.id,
    searchQuery: q,
    sortMode: sort,
    paramFilters,
  });

  // Build breadcrumb chain from materializedPath
  const pathSegments = folder.materializedPath.split('/').filter(Boolean);
  const breadcrumbFolders =
    pathSegments.length > 0
      ? await prisma.folder.findMany({
          where: { id: { in: pathSegments } },
          select: { id: true, name: true },
        })
      : [];

  // Order breadcrumbs by their position in the path
  const breadcrumbMap = new Map(breadcrumbFolders.map((f) => [f.id, f]));
  const breadcrumbs = pathSegments
    .map((id) => breadcrumbMap.get(id))
    .filter(Boolean) as { id: string; name: string }[];

  // Get complete effective parameter definitions (Universal + Ancestors + Folder)
  const effectiveParams = await getEffectiveParameterDefinitions(folder.id);
  const allParams = effectiveParams.map((p) => ({
    ...p,
    folder: { name: p.inheritedFromFolderName || folder.name },
  }));

  const hasChildren = folder.children.length > 0;
  const hasItems = folder.folderItems.length > 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Breadcrumb & Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3 sm:pb-4">
        <div>
          <nav className="flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto pb-0.5 max-w-full">
            {userRole === 'ADMIN' && (
              <>
                <Link href="/" className="hover:text-foreground transition-colors shrink-0">
                  Dashboard
                </Link>
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
              </>
            )}
            <Link href="/inventory" className="hover:text-foreground transition-colors shrink-0">
              Inventory
            </Link>
            {breadcrumbs.map((bc) => (
              <React.Fragment key={bc.id}>
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                <Link
                  href={`/inventory/folders/${[...pathSegments.slice(0, pathSegments.indexOf(bc.id) + 1)].join('/')}`}
                  className="hover:text-foreground transition-colors shrink-0 capitalize"
                >
                  {bc.name}
                </Link>
              </React.Fragment>
            ))}
          </nav>

          <div className="flex items-center gap-2.5 mt-0.5 sm:mt-1">
            <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-foreground">{folder.name}</h1>
            <Badge
              variant="secondary"
              className="bg-primary/10 text-primary border-primary/20 px-2 py-0.5 text-[11px] sm:text-xs font-semibold rounded-full shrink-0"
            >
              {hasItems ? `${folder.folderItems.length} Items` : `${folder.children.length} Subfolders`}
            </Badge>
          </div>
          {folder.description && (
            <p className="text-xs text-muted-foreground mt-0.5 sm:mt-1">{folder.description}</p>
          )}
        </div>

        {/* Top Right: Manage Parameters & Quick Actions */}
        {userRole === 'ADMIN' && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <CreateFolderDialog parentId={folder.id} />
            <CreateItemDialog folderId={folder.id} parameterDefinitions={allParams} />
            <LinkExistingItemDialog folderId={folder.id} folderName={folder.name} />
            <ManageParametersDialog
              folderId={folder.id}
              folderName={folder.name}
              existingParameters={folder.parameterDefinitions}
            />
          </div>
        )}
      </div>

      {/* Inherited Parameter Specs Bar: Only visible to ADMIN (Hidden for Staff) */}
      {userRole === 'ADMIN' && allParams.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {allParams.map((param) => (
            <Badge key={param.id} variant="outline" className="shrink-0 text-[11px] sm:text-xs gap-1.5 bg-slate-50 border-border/80 text-foreground py-0.5 px-2 rounded-lg shadow-2xs">
              <Tag className="h-2.5 w-2.5 text-primary" />
              <span className="font-semibold">{param.name}</span>
              <span className="text-muted-foreground font-normal">({param.folder.name})</span>
            </Badge>
          ))}
        </div>
      )}

      {/* Main Folder Content with Subtree Parameter Filter, Live Search & Shimmer Skeletons */}
      <FolderViewContainer
        folder={folder}
        path={path}
        effectiveParams={filterResult.universalParams}
        filteredItems={filterResult.items}
        totalMatches={filterResult.totalCount}
        userRole={userRole}
        isFilterOrSortActive={isFilterOrSortActive}
      />
    </div>
  );
}
