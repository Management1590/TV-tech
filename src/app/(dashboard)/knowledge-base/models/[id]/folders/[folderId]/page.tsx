import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, FolderOpen, Lightbulb, Info } from 'lucide-react';
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
  const modelFullName = `${folder.model.brand.name} ${folder.model.modelNumber}`;

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
    <div className="space-y-6 p-2 sm:p-4">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
        <Link href="/knowledge-base" className="hover:text-primary transition-colors font-medium">
          Knowledge Base
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link
          href={`/knowledge-base/brands/${folder.model.brand.id}`}
          className="hover:text-primary transition-colors font-medium"
        >
          {folder.model.brand.name}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link
          href={`/knowledge-base/models/${folder.model.id}`}
          className="hover:text-primary transition-colors font-medium"
        >
          {folder.model.modelNumber}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-bold">{folder.name}</span>
      </nav>

      {/* Folder Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white border border-border/80 rounded-3xl shadow-blend">
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${
              isBacklight
                ? 'bg-amber-500/15 border border-amber-300 text-amber-600'
                : 'bg-primary/15 border border-primary/20 text-primary'
            }`}
          >
            {isBacklight ? <Lightbulb className="w-7 h-7" /> : <FolderOpen className="w-7 h-7" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {folder.name}
              </h1>
              {isBacklight ? (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 text-xs font-bold">
                  Backlight Inventory Linker
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
                  Photo • Audio • Text
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {modelFullName} • {isBacklight ? 'Dedicated Backlight Inventory Association' : 'Multimedia Troubleshooting & Repair Knowledge'}
            </p>
          </div>
        </div>
      </div>

      {/* Main Content: Backlight Linker OR 3-Tier Photo/Video, Audio, Text Viewer */}
      {isBacklight ? (
        <KbBacklightLinker
          modelId={folder.model.id}
          modelName={modelFullName}
          linkedItems={linkedBacklights as any}
          userRole={user?.role}
        />
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
