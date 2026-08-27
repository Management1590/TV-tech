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

  return (
    <div className="space-y-6 p-2 sm:p-4">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/knowledge-base" className="hover:text-primary transition-colors font-medium">
          Knowledge Base
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-bold">{brand.name}</span>
      </nav>

      {/* Brand Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-7 bg-white/90 backdrop-blur-xl border border-border/80 rounded-3xl shadow-blend">
        <div className="flex items-center gap-4">
          <FolderSilhouetteThumbnail
            thumbnailUrl={brand.logoUrl}
            name={brand.name}
            className="w-20 sm:w-24"
          />
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
              {brand.name}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select or register a TV model number to manage technical folders, backlights, and diagnostic notes.
            </p>
          </div>
        </div>

        {/* Upper Actions: Model Counter Badge + Add Model Button */}
        <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
          <div className="flex items-center px-3.5 h-10 rounded-2xl bg-slate-100/90 border border-border/80 text-xs font-bold text-slate-700 shadow-2xs">
            {brand.models.length} {brand.models.length === 1 ? 'Model' : 'Models'}
          </div>

          {!!user && (
            <CreateTvModelDialog
              brands={[{ id: brand.id, name: brand.name }]}
              preselectedBrandId={brand.id}
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
          brandName={brand.name}
          userRole={user?.role}
        />
      </div>
    </div>
  );
}
