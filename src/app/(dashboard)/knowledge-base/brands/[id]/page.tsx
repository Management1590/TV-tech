import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Monitor, ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { Badge } from '@/components/ui/badge';
import { ModelListView } from '@/components/knowledge-base/model-list-view';
import { CreateTvModelDialog } from '@/components/knowledge-base/create-tv-model-dialog';
import { FolderSilhouetteThumbnail } from '@/components/knowledge-base/folder-silhouette-thumbnail';
import { BrandContextMenu } from '@/components/knowledge-base/brand-context-menu';

export const dynamic = 'force-dynamic';

export default async function TvBrandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const brand = await prisma.tvBrand.findUnique({
    where: { id },
    include: {
      models: {
        orderBy: { modelNumber: 'asc' },
        include: {
          _count: { select: { knowledgeFolders: true } },
          entity: {
            include: {
              targetRelationships: {
                where: { relationshipTypeCode: 'ITEM_COMPATIBLE_TV_MODEL' },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });

  if (!brand) {
    notFound();
  }

  const isAdmin = user?.role === 'ADMIN';
  const cleanBrandName = brand.name.replace(/_\d{10,}$/, '');

  const formattedModels = brand.models.map((m) => {
    const hasLinkedBacklights = (m.entity?.targetRelationships?.length ?? 0) > 0;
    const rawFolderCount = m._count?.knowledgeFolders ?? 2;
    // For non-admin (user panel), if no linked backlight items, Backlight folder is hidden
    const effectiveFolderCount = !isAdmin && !hasLinkedBacklights
      ? Math.max(1, rawFolderCount - 1)
      : rawFolderCount;

    return {
      ...m,
      _count: {
        knowledgeFolders: effectiveFolderCount,
      },
      brand: { name: brand.name },
    };
  });

  return (
    <div
      className="space-y-4 sm:space-y-6 p-2 sm:p-4 max-w-7xl mx-auto"
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.25rem)' }}
    >
      {/* Breadcrumb Navigation - Touch-Friendly Pill Track with Smooth Horizontal Scroll */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground overflow-x-auto pb-1.5 pt-0.5 no-scrollbar whitespace-nowrap touch-pan-x select-none">
        <Link
          href="/knowledge-base"
          className="px-2.5 py-1.5 rounded-xl bg-white border border-border/80 hover:bg-slate-50 hover:text-blue-600 active:bg-muted/80 text-foreground/70 transition-all font-bold shrink-0 min-h-[34px] inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-blue-600" />
          <span>Knowledge Base</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        <span className="px-2.5 py-1.5 rounded-xl bg-blue-500/10 text-blue-700 border border-blue-400/20 font-extrabold shrink-0 min-h-[34px] inline-flex items-center gap-1">
          {cleanBrandName}
        </span>
      </nav>

      {/* Brand Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-6 bg-white border border-border/70 rounded-2xl sm:rounded-3xl shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3 sm:gap-4">
          <FolderSilhouetteThumbnail
            thumbnailUrl={brand.logoUrl}
            name={cleanBrandName}
            className="w-16 sm:w-24"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 truncate">
              {cleanBrandName}
            </h1>
            <p className="hidden sm:block text-xs text-muted-foreground/80 mt-1 font-semibold tracking-wide">
              Select or register a TV model number to manage technical folders, backlights, and diagnostic notes.
            </p>
          </div>
        </div>

        {/* Upper Actions: Model Counter Badge + Add Model Button */}
        <div className="flex items-center gap-2 sm:gap-3 self-stretch sm:self-auto shrink-0 justify-between sm:justify-end">
          <div className="flex items-center px-3 h-9 sm:h-10 rounded-xl sm:rounded-2xl bg-blue-50 border border-blue-200/80 text-xs font-extrabold text-blue-700 shadow-2xs">
            {brand.models.length} {brand.models.length === 1 ? 'Model' : 'Models'}
          </div>

          {!!user && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <CreateTvModelDialog
                brands={[{ id: brand.id, name: cleanBrandName }]}
                preselectedBrandId={brand.id}
                existingModels={brand.models.map((m) => m.modelNumber)}
              />
              <BrandContextMenu
                brandId={brand.id}
                brandName={brand.name}
                entityId={brand.entityId}
                modelCount={brand.models.length}
                currentDescription={brand.description}
                currentLogoUrl={brand.logoUrl}
                userRole={user?.role}
              />
            </div>
          )}
        </div>
      </div>

      {/* Model List View */}
      <div className="space-y-3">
        <div id="registered-models-header" className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-extrabold text-foreground flex items-center gap-2">
            <Monitor className="w-4 h-4 text-blue-600" />
            <span>Registered TV Models</span>
            <span className="text-muted-foreground/70 font-bold">({brand.models.length})</span>
          </h2>
        </div>

        <ModelListView
          models={formattedModels}
          brandName={cleanBrandName}
          brandId={brand.id}
          brands={[{ id: brand.id, name: cleanBrandName }]}
          userRole={user?.role}
        />
      </div>
    </div>
  );
}
