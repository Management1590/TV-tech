import React from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { recordItemView } from '@/features/analytics/services/analytics.service';
import { getEffectiveParameterDefinitions } from '@/features/inventory/services/parameter.service';
import { ItemProductShowcase } from '@/components/inventory/item-product-showcase';

export const dynamic = 'force-dynamic';

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  // Support looking up by Item ID or Entity ID (from Search Index)
  const item = await prisma.item.findFirst({
    where: {
      OR: [
        { id },
        { entityId: id },
      ],
    },
    include: {
      folderItems: {
        include: { folder: { select: { id: true, name: true, materializedPath: true } } },
      },
      supplierRecords: {
        orderBy: { createdAt: 'desc' },
        include: { supplier: true },
      },
      stockMovements: {
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: { performedBy: { select: { fullName: true } } },
      },
      parameterValues: {
        include: { parameterDefinition: true },
      },
      stockSettings: true,
      entity: {
        include: {
          mediaAttachments: {
            include: { media: true },
            orderBy: { sortOrder: 'asc' },
          },
          sourceRelationships: {
            include: {
              relationshipType: true,
              targetEntity: {
                include: { tvModel: { include: { brand: true } } },
              },
            },
          },
          targetRelationships: {
            include: {
              relationshipType: true,
              sourceEntity: {
                include: { tvModel: { include: { brand: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!item) return notFound();

  // Record item view asynchronously for popularity tracking
  recordItemView(item.id, user?.id).catch(() => {});

  // Fetch effective parameter definitions from all folders this item is linked to
  const effectiveDefsMap = new Map<string, any>();
  for (const fi of item.folderItems) {
    try {
      const defs = await getEffectiveParameterDefinitions(fi.folder.id);
      for (const d of defs) {
        if (!effectiveDefsMap.has(d.id)) {
          effectiveDefsMap.set(d.id, {
            id: d.id,
            name: d.name,
            slug: d.slug,
            valueType: d.valueType,
            unit: d.unit,
            inheritedFromFolderName: d.inheritedFromFolderName || fi.folder.name,
          });
        }
      }
    } catch (e) {
      console.error('Error resolving effective parameter definitions for folder', fi.folder.id, e);
    }
  }

  // Also include any parameter definitions from existing parameterValues that might not be in effectiveDefs
  for (const pv of item.parameterValues) {
    if (pv.parameterDefinition && !effectiveDefsMap.has(pv.parameterDefinition.id)) {
      effectiveDefsMap.set(pv.parameterDefinition.id, {
        id: pv.parameterDefinition.id,
        name: pv.parameterDefinition.name,
        slug: pv.parameterDefinition.slug,
        valueType: pv.parameterDefinition.valueType,
        unit: pv.parameterDefinition.unit,
      });
    }
  }

  const allParameterDefinitions = Array.from(effectiveDefsMap.values());

  // Map media items
  const mediaItems =
    item.entity?.mediaAttachments?.map((a) => ({
      id: a.media.id,
      mediaType: a.media.mediaType,
      url: a.media.url,
      secureUrl: a.media.secureUrl,
      publicId: a.media.publicId,
      filename: a.media.filename,
      mimeType: a.media.mimeType,
      sizeBytes: a.media.sizeBytes,
      width: a.media.width,
      height: a.media.height,
      purpose: a.purpose,
    })) ?? [];

  // Map compatible TV Models
  const compatibleModels = [
    ...item.entity.sourceRelationships
      .filter((r) => r.relationshipType.code === 'ITEM_COMPATIBLE_TV_MODEL')
      .map((r) => r.targetEntity.tvModel)
      .filter(Boolean),
    ...item.entity.targetRelationships
      .filter((r) => r.relationshipType.code === 'ITEM_COMPATIBLE_TV_MODEL')
      .map((r) => r.sourceEntity.tvModel)
      .filter(Boolean),
  ].map((m: any) => ({
    id: m.id,
    modelNumber: m.modelNumber,
    screenSize: m.screenSize,
    displayType: m.displayType,
    brand: m.brand ? { id: m.brand.id, name: m.brand.name } : null,
  }));

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
      <ItemProductShowcase
        item={item}
        mediaItems={mediaItems}
        compatibleModels={compatibleModels}
        allParameterDefinitions={allParameterDefinitions}
        userRole={user?.role}
      />
    </div>
  );
}
