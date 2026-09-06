import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, FolderOpen, Lightbulb, Info, ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { Badge } from '@/components/ui/badge';
import { KbBacklightLinker } from '@/components/knowledge-base/kb-backlight-linker';
import { KbFolderContentViewer } from '@/components/knowledge-base/kb-folder-content-viewer';

export const dynamic = 'force-dynamic';

export default async function KbFolderDetailPage({
  params,
}: {
  params: Promise<{ id: string; folderId: string }>;
}) {
  const { id: modelId, folderId } = await params;
  const user = await getCurrentUser();

  const folder = await prisma.knowledgeFolder.findUnique({
    where: { id: folderId },
    include: {
      model: {
        include: {
          brand: true,
        },
      },
      pages: {
        orderBy: { createdAt: 'asc' },
      },
      entity: {
        include: {
          mediaAttachments: {
            include: {
              media: true,
            },
            orderBy: { sortOrder: 'asc' },
          },
          targetRelationships: {
            where: { relationshipType: { code: 'ITEM_COMPATIBLE_TV_MODEL' } },
            include: {
              sourceEntity: {
                include: {
                  item: {
                    include: {
                      supplierRecords: { orderBy: { createdAt: 'desc' }, take: 1 },
                      folderItems: { include: { folder: { select: { name: true } } }, take: 1 },
                      entity: {
                        include: {
                          mediaAttachments: {
                            include: { media: true },
                            take: 1,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!folder || folder.modelId !== modelId) return notFound();

  const isBacklight = folder.name.toLowerCase() === 'backlight';
  const cleanBrandName = folder.model.brand.name.replace(/_\d{10,}$/, '');
  const cleanModelNumber = folder.model.modelNumber.replace(/_\d{10,}$/, '');
  const modelFullName = `${cleanBrandName} ${cleanModelNumber}`;

  // Fetch model compatible backlight items from entity relationships
  const modelEntity = await prisma.entity.findUnique({
    where: { id: folder.model.entityId },
    include: {
      targetRelationships: {
        where: { relationshipType: { code: 'ITEM_COMPATIBLE_TV_MODEL' } },
        include: {
          sourceEntity: {
            include: {
              item: {
                include: {
                  supplierRecords: { orderBy: { createdAt: 'desc' }, take: 1 },
                  folderItems: { include: { folder: { select: { name: true } } }, take: 1 },
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
        },
      },
    },
  });

  const linkedBacklights = (modelEntity?.targetRelationships || [])
    .map((r) => r.sourceEntity.item)
    .filter(Boolean);

  const formattedMedia = (folder.entity.mediaAttachments || []).map((a) => ({
    id: a.media.id,
    mediaType: a.media.mediaType,
    url: a.media.url,
    secureUrl: a.media.secureUrl,
    publicId: a.media.publicId,
    filename: a.media.filename,
    createdAt: a.media.createdAt,
  }));

  return (
    <div
      className="space-y-4 sm:space-y-6 p-2 sm:p-4 max-w-7xl mx-auto"
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.25rem)' }}
    >
      {/* Sleek Breadcrumb & Back Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground overflow-x-auto pb-1.5 pt-0.5 no-scrollbar whitespace-nowrap touch-pan-x select-none">
        <Link
          href={`/knowledge-base/models/${folder.model.id}`}
          className="px-2.5 py-1.5 rounded-xl bg-white border border-border/80 hover:bg-slate-50 hover:text-blue-600 active:bg-muted/80 text-foreground/70 transition-all font-bold shrink-0 min-h-[34px] inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-blue-600" />
          <span>{cleanModelNumber}</span>
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        <span className={`px-2.5 py-1.5 rounded-xl font-extrabold shrink-0 min-h-[34px] inline-flex items-center gap-1 ${
          isBacklight
            ? 'bg-amber-50 text-amber-700 border border-amber-300/50'
            : 'bg-indigo-50 text-indigo-700 border border-indigo-300/50'
        }`}>
          {folder.name}
        </span>
      </nav>

      {/* Main Content: Backlight Linker OR 3-Tier Photo/Video, Audio, Text Viewer */}
      {isBacklight ? (
        <>
          {/* Backlight Folder Header */}
          <div className="p-4 sm:p-6 bg-white border border-border/70 rounded-2xl sm:rounded-3xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3.5 sm:gap-4">
              <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs bg-amber-500/15 border border-amber-300/80 text-amber-600">
                <Lightbulb className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 truncate">
                    {folder.name}
                  </h1>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] sm:text-xs font-extrabold py-0.5 px-2.5 shadow-2xs">
                    Backlight Linker
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground/80 mt-0.5 truncate font-semibold">
                  {modelFullName} · Backlight Inventory Linker
                </p>
              </div>
            </div>
          </div>

          <KbBacklightLinker
            modelId={folder.model.id}
            modelName={modelFullName}
            linkedItems={linkedBacklights as any}
            userRole={user?.role}
          />
        </>
      ) : (
        <KbFolderContentViewer
          folderId={folder.id}
          folderName={folder.name}
          entityId={folder.entityId}
          modelName={modelFullName}
          mediaAttachments={formattedMedia}
          pages={folder.pages}
          userRole={user?.role}
        />
      )}
    </div>
  );
}
