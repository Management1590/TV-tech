import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Monitor } from 'lucide-react';
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

  const modelFullName = `${model.brand.name} ${model.modelNumber}`;

  return (
    <div className="space-y-6 p-2 sm:p-4">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
        <Link href="/knowledge-base" className="hover:text-primary transition-colors font-medium">
          Knowledge Base
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link
          href={`/knowledge-base/brands/${model.brand.id}`}
          className="hover:text-primary transition-colors font-medium"
        >
          {model.brand.name}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-bold">{model.modelNumber}</span>
      </nav>

      {/* Model Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white border border-border/80 rounded-3xl shadow-blend">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-primary/15 to-blue-500/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-2xs">
            <Monitor className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {modelFullName}
              </h1>
              {model.screenSize && (
                <Badge variant="outline" className="text-xs font-bold bg-slate-100/80">
                  {model.screenSize}&quot;
                </Badge>
              )}
              {model.displayType && (
                <Badge variant="secondary" className="text-[10px] uppercase font-bold bg-blue-50 text-blue-700 border-blue-200">
                  {model.displayType}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
              {model.chassisNo && (
                <span className="font-mono text-slate-600 font-semibold">Chassis: {model.chassisNo}</span>
              )}
              {model.notes && (
                <span className="text-slate-500 italic">• {model.notes}</span>
              )}
            </div>
          </div>
        </div>

        {/* Actions: Model 3-dots context menu (Rename / Delete with warning) */}
        {!!user && (
          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
            <ModelContextMenu
              modelId={model.id}
              modelNumber={model.modelNumber}
              screenSize={model.screenSize}
              brandName={model.brand.name}
              folderCount={model.knowledgeFolders.length}
              userRole={user?.role}
            />
          </div>
        )}
      </div>

      {/* Model Folders Grid with Ordered Pattern Search */}
      <KbModelFoldersContainer
        modelId={model.id}
        modelNumber={model.modelNumber}
        brandName={model.brand.name}
        folders={model.knowledgeFolders}
        userRole={user?.role}
      />
    </div>
  );
}
