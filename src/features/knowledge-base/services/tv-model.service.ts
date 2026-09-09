// ============================================================
// TV Model Domain Service (with RD-4 Template Auto-Initialization)
// ============================================================
// Creates TV Model records in Knowledge Base.
// Automatically seeds 7 default KB folders (RD-4):
// Backlight Strips, Display Panel, Main Board, Power Board, T-Con Board, Software, Notes.

import { prisma } from '@/lib/prisma';
import { TvModel } from '@prisma/client';
import { ensureEntityType } from '@/lib/ensure-entity-types';
import { validateNameSimilarity } from '@/features/knowledge-base/utils/name-similarity-validator';

export interface CreateTvModelInput {
  brandId: string;
  modelNumber: string;
  screenSize?: number;
  displayType?: string;
  chassisNo?: string;
  notes?: string;
}

export const DEFAULT_KB_TEMPLATES = [
  'Backlight',
  'More info',
] as const;

function generateSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-');
}

/**
 * Creates a TV Model record, registers it in Entity Registry,
 * and auto-creates the 2 default system Knowledge Folders (Backlight & More info).
 */
export async function createTvModel(input: CreateTvModelInput): Promise<TvModel> {
  const cleanNumber = input.modelNumber.trim().toUpperCase();

  // Validate duplicate / 8-character sequential match against existing models in the same Brand directory
  const existingModels = await prisma.tvModel.findMany({
    where: { brandId: input.brandId },
    select: { modelNumber: true },
  });
  const collision = validateNameSimilarity(cleanNumber, existingModels.map((m) => m.modelNumber), 'Model');
  if (collision.hasConflict) {
    throw new Error(collision.message);
  }

  const slug = generateSlug(cleanNumber);

  return await prisma.$transaction(async (tx) => {
    // 0. Ensure EntityTypes exist
    await ensureEntityType('TV_MODEL', tx);
    await ensureEntityType('KNOWLEDGE_FOLDER', tx);

    // 1. Create Entity record
    const entity = await tx.entity.create({
      data: {
        entityTypeCode: 'TV_MODEL',
        displayName: cleanNumber,
        searchText: `${cleanNumber} ${input.chassisNo || ''} ${input.displayType || ''} ${input.notes || ''}`.trim(),
      },
    });

    // 2. Create TvModel record
    const tvModel = await tx.tvModel.create({
      data: {
        entityId: entity.id,
        brandId: input.brandId,
        modelNumber: cleanNumber,
        slug,
        screenSize: input.screenSize,
        displayType: input.displayType,
        chassisNo: input.chassisNo,
        notes: input.notes,
      },
    });

    // 3. Increment brand model count
    await tx.tvBrand.update({
      where: { id: input.brandId },
      data: { modelCount: { increment: 1 } },
    });

    // 4. Auto-initialize 7 default KB folders (RD-4)
    for (let idx = 0; idx < DEFAULT_KB_TEMPLATES.length; idx++) {
      const folderName = DEFAULT_KB_TEMPLATES[idx];
      const folderSlug = generateSlug(folderName);

      const kbFolderEntity = await tx.entity.create({
        data: {
          entityTypeCode: 'KNOWLEDGE_FOLDER',
          displayName: `${input.modelNumber} - ${folderName}`,
          searchText: `${input.modelNumber} ${folderName}`,
        },
      });

      await tx.knowledgeFolder.create({
        data: {
          entityId: kbFolderEntity.id,
          modelId: tvModel.id,
          name: folderName,
          slug: folderSlug,
          sortOrder: idx,
          isSystem: true,
        },
      });
    }

    return tvModel;
  }, { timeout: 20000, maxWait: 10000 });
}

/**
 * Fetches full Knowledge Base record for a TV Model, including all KB Folders, Pages, and compatible Spare Part Items.
 */
export async function getTvModelById(modelId: string) {
  const model = await prisma.tvModel.findUnique({
    where: { id: modelId },
    include: {
      brand: true,
      entity: true,
      knowledgeFolders: {
        orderBy: { sortOrder: 'asc' },
        include: {
          pages: {
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  });

  if (!model) {
    throw new Error(`TV Model with ID ${modelId} not found`);
  }

  // Fetch linked compatible spare part items via Universal Relationship Engine
  const compatibleRelationships = await prisma.entityRelationship.findMany({
    where: {
      targetEntityId: model.entityId,
      relationshipTypeCode: 'ITEM_COMPATIBLE_TV_MODEL',
    },
    include: {
      sourceEntity: {
        include: {
          item: {
            include: {
              supplierRecords: { take: 1, orderBy: { createdAt: 'desc' } },
            },
          },
        },
      },
    },
  });

  const compatibleItems = compatibleRelationships
    .map((r) => r.sourceEntity.item)
    .filter(Boolean);

  return {
    ...model,
    compatibleItems,
  };
}
