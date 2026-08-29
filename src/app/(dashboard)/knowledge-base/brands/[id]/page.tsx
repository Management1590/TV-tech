import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Monitor } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { Badge } from '@/components/ui/badge';
import { ModelListView } from '@/components/knowledge-base/model-list-view';
import { CreateTvModelDialog } from '@/components/knowledge-base/create-tv-model-dialog';
import { FolderSilhouetteThumbnail } from '@/components/knowledge-base/folder-silhouette-thumbnail';

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
        },
      },
    },
  });

  if (!brand) {
    notFound();
  }

  const cleanBrandName = brand.name.replace(/_\d{10,}$/, '');

  return (
    <div className="space-y-4 sm:space-y-6 p-2 sm:p-4 max-w-7xl mx-auto">
      {/* Breadcrumb Navigation - Touch-Friendly Pill Track with Smooth Horizontal Scroll */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground overflow-x-auto pb-1.5 pt-0.5 no-scrollbar whitespace-nowrap touch-pan-x select-none">
        <Link
          href="/knowledge-base"
          className="px-2.5 py-1.5 rounded-xl bg-white border border-border/80 hover:bg-muted hover:text-primary active:bg-muted/80 text-foreground/80 transition-all font-semibold shrink-0 min-h-[34px] inline-flex items-center gap-1 shadow-2xs cursor-pointer"
        >
          Knowledge Base
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        <span className="px-2.5 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20 font-bold shrink-0 min-h-[34px] inline-flex items-center gap-1">
          {cleanBrandName}
        </span>
      </nav>

      {/* Brand Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-7 bg-white border border-border/80 rounded-2xl sm:rounded-3xl shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3 sm:gap-4">
          <FolderSilhouetteThumbnail
            thumbnailUrl={brand.logoUrl}
            name={cleanBrandName}
            className="w-16 sm:w-24"
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg sm:text-2xl font-black tracking-tight text-foreground truncate">
              {cleanBrandName}
            </h1>
            <p className="hidden sm:block text-xs text-muted-foreground mt-0.5">
              Select or register a TV model number to manage technical folders, backlights, and diagnostic notes.
            </p>
          </div>
        </div>

        {/* Upper Actions: Model Counter Badge + Add Model Button */}
        <div className="flex items-center gap-2 sm:gap-3 self-stretch sm:self-auto shrink-0 justify-between sm:justify-end">
          <div className="flex items-center px-3 h-9 sm:h-10 rounded-xl sm:rounded-2xl bg-muted/90 border border-border/80 text-xs font-bold text-foreground/80 shadow-2xs">
            {brand.models.length} {brand.models.length === 1 ? 'Model' : 'Models'}
          </div>

          {!!user && (
            <CreateTvModelDialog
              brands={[{ id: brand.id, name: cleanBrandName }]}
              preselectedBrandId={brand.id}
              existingModels={brand.models.map((m) => m.modelNumber)}
            />
          )}
        </div>
      </div>

      {/* Model List View */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Monitor className="w-4 h-4 text-primary" />
            Registered TV Models ({brand.models.length})
          </h2>
        </div>

        <ModelListView
          models={brand.models.map((m) => ({
            ...m,
            brand: { name: brand.name },
          }))}
          brandName={cleanBrandName}
          brandId={brand.id}
          brands={[{ id: brand.id, name: cleanBrandName }]}
          userRole={user?.role}
        />
      </div>
    </div>
  );
}
