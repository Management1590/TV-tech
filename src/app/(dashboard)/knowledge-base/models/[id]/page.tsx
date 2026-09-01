import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Monitor, ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { Badge } from '@/components/ui/badge';
import { KbModelFoldersContainer } from '@/components/knowledge-base/kb-model-folders-container';
import { ModelContextMenu } from '@/components/knowledge-base/model-context-menu';

export const dynamic = 'force-dynamic';

export default async function TvModelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  const model = await prisma.tvModel.findUnique({
    where: { id },
    include: {
      brand: true,
      knowledgeFolders: {
        where: { parentId: null }, // Strictly 1-level folders under Model
        orderBy: { sortOrder: 'asc' },
        include: {
          pages: { select: { id: true } },
          entity: {
            include: {
              mediaAttachments: { select: { id: true } },
              targetRelationships: { select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!model) return notFound();

  const cleanBrandName = model.brand.name.replace(/_\d{10,}$/, '');
  const cleanModelNumber = model.modelNumber.replace(/_\d{10,}$/, '');

  return (
    <div
      className="space-y-4 sm:space-y-6 p-2 sm:p-4 max-w-7xl mx-auto"
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.25rem)' }}
    >
      {/* Sleek Breadcrumb Navigation - Touch-Friendly Pill Track with Smooth Horizontal Scroll */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground overflow-x-auto pb-1.5 pt-0.5 no-scrollbar whitespace-nowrap touch-pan-x select-none">
        <Link
          href={`/knowledge-base/brands/${model.brand.id}`}
          className="px-2.5 py-1.5 rounded-xl bg-white border border-border/80 hover:bg-muted hover:text-primary active:bg-muted/80 text-foreground/80 transition-all font-semibold shrink-0 min-h-[34px] inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-primary" />
          <span>{cleanBrandName}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        <span className="px-2.5 py-1.5 rounded-xl bg-primary/10 text-primary border border-primary/20 font-bold shrink-0 min-h-[34px] inline-flex items-center gap-1 truncate max-w-[160px] sm:max-w-none">
          {cleanModelNumber}
        </span>
      </nav>

      {/* Model Header Banner (Mobile-Optimized & Balanced) */}
      <div className="relative p-4 sm:p-6 bg-white border border-border/80 rounded-2xl sm:rounded-3xl shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3.5 sm:gap-4 pr-10 sm:pr-0">
          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-primary/15 to-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-2xs">
            <Monitor className="w-5 h-5 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-black tracking-tight text-foreground truncate max-w-full">
                {cleanModelNumber}
              </h1>
              <span className="text-xs text-muted-foreground font-bold">({cleanBrandName})</span>
              {model.screenSize && (
                <Badge variant="outline" className="text-[10px] sm:text-xs font-bold bg-muted px-1.5 py-0.5">
                  {model.screenSize}&quot;
                </Badge>
              )}
              {model.displayType && (
                <Badge variant="secondary" className="text-[9px] sm:text-[10px] uppercase font-bold bg-primary/5 text-primary border-primary/20 px-1.5 py-0.5">
                  {model.displayType}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
              {model.chassisNo && (
                <span className="font-mono text-foreground/80 font-semibold bg-muted px-1.5 py-0.5 rounded-md text-[11px]">
                  Chassis: {model.chassisNo}
                </span>
              )}
              {model.notes && (
                <span className="text-muted-foreground italic text-[11px] truncate max-w-[240px] sm:max-w-none">
                  • {model.notes}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions: Top-right positioned context menu */}
        {!!user && (
          <div className="absolute top-3.5 right-3.5 sm:top-5 sm:right-5">
            <ModelContextMenu
              modelId={model.id}
              modelNumber={model.modelNumber}
              screenSize={model.screenSize}
              brandName={cleanBrandName}
              folderCount={model.knowledgeFolders.length}
              userRole={user?.role}
            />
          </div>
        )}
      </div>

      {/* Model Folders Grid with Ordered Pattern Search */}
      <KbModelFoldersContainer
        modelId={model.id}
        modelNumber={cleanModelNumber}
        brandName={cleanBrandName}
        folders={model.knowledgeFolders}
        userRole={user?.role}
      />
    </div>
  );
}
