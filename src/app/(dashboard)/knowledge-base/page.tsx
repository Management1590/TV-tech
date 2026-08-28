import React from 'react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { KbBrandViewContainer } from '@/components/knowledge-base/kb-brand-view-container';

export const dynamic = 'force-dynamic';

export default async function KnowledgeBasePage() {
  const user = await getCurrentUser();

  const brands = await prisma.tvBrand.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { models: true } },
    },
  });

  return (
    <div className="p-2 sm:p-4">
      <KbBrandViewContainer
        initialBrands={brands.map((b) => ({
          id: b.id,
          entityId: b.entityId,
          name: b.name,
          slug: b.slug,
          description: b.description,
          logoUrl: b.logoUrl,
          modelCount: b._count.models,
          _count: b._count,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
        }))}
        userRole={user?.role}
      />
    </div>
  );
}
