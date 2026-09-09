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
      entity: {
        include: {
          targetRelationships: {
            where: { relationshipTypeCode: 'ITEM_COMPATIBLE_TV_MODEL' },
            select: { id: true },
          },
        },
      },
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

  const linkedBacklightCount = model.entity?.targetRelationships?.length ?? 0;
  const hasLinkedBacklights = linkedBacklightCount > 0;
  const isAdmin = user?.role === 'ADMIN';
  const effectiveFolderCount =
    !isAdmin && !hasLinkedBacklights
      ? Math.max(1, model.knowledgeFolders.length - 1)
      : model.knowledgeFolders.length;

  return (
    <div
      className="space-y-4 sm:space-y-6 p-2 sm:p-4 max-w-7xl mx-auto"
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.25rem)' }}
    >
      {/* Sleek Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground overflow-x-auto pb-1.5 pt-0.5 no-scrollbar whitespace-nowrap touch-pan-x select-none">
        <Link
          href={`/knowledge-base/brands/${model.brand.id}`}
          className="px-2.5 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/90 hover:bg-slate-200/80 hover:text-slate-900 text-slate-600 dark:text-slate-300 transition-all font-bold shrink-0 min-h-[34px] inline-flex items-center gap-1.5 shadow-2xs cursor-pointer group"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:-translate-x-0.5 transition-transform" />
          <span>{cleanBrandName}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        <span className="px-2.5 py-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-700/80 text-slate-800 dark:text-slate-100 border border-slate-300/80 dark:border-slate-600/80 font-black shrink-0 min-h-[34px] inline-flex items-center gap-1">
          {cleanModelNumber}
        </span>
      </nav>

      {/* Model Header Banner (Mobile-Optimized & Balanced) */}
      <div className="relative p-4 sm:p-6 bg-white dark:bg-slate-900 border border-border/70 rounded-2xl sm:rounded-3xl shadow-2xs">
        <div className="flex items-start gap-3.5 sm:gap-4 pr-10 sm:pr-0">
          <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/90 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0 shadow-2xs">
            <Monitor className="w-5 h-5 sm:w-7 sm:h-7 text-slate-500 dark:text-slate-400" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-3xl font-black tracking-tight text-foreground break-words [word-break:normal] [overflow-wrap:anywhere] [text-wrap:pretty] leading-tight min-w-0">
                {cleanModelNumber}
              </h1>
              <span className="text-xs text-muted-foreground/70 font-bold">({cleanBrandName})</span>
              {model.screenSize && (
                <Badge variant="outline" className="text-[10px] sm:text-xs font-black bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-slate-700/90 px-2 py-0.5 rounded-md">
                  {model.screenSize}&quot;
                </Badge>
              )}
              {model.displayType && (
                <Badge variant="secondary" className="text-[9px] sm:text-[10px] uppercase font-black bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-slate-700/90 px-2 py-0.5 rounded-md">
                  {model.displayType}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1.5 flex-wrap">
              {model.chassisNo && (
                <span className="font-mono text-slate-600 dark:text-slate-300 font-bold bg-slate-100/90 dark:bg-slate-800/90 px-2 py-0.5 rounded-md text-[11px] border border-slate-200/90 dark:border-slate-700/90">
                  Chassis: {model.chassisNo}
                </span>
              )}
              {model.notes && (
                <span className="text-muted-foreground/70 italic text-[11px] truncate max-w-[240px] sm:max-w-none font-medium">
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
              brandId={model.brand.id}
              screenSize={model.screenSize}
              currentDescription={model.notes}
              brandName={cleanBrandName}
              folderCount={effectiveFolderCount}
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
        hasLinkedBacklights={hasLinkedBacklights}
        linkedBacklightCount={linkedBacklightCount}
      />
    </div>
  );
}
