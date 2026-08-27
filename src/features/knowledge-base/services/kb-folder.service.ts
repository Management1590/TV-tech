// ============================================================
// Knowledge Folder Domain Service (1-Level Under Model Rule)
// ============================================================
import { prisma } from '@/lib/prisma';
import { KnowledgeFolder } from '@prisma/client';
import { ensureEntityType } from '@/lib/ensure-entity-types';

export interface CreateKbFolderInput {
  modelId: string;
  name: string;
}

function generateSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-');
}

/**
 * Creates a custom Knowledge Folder directly under a TV Model (1-level depth strictly enforced).
 */
export async function createKnowledgeFolder(input: CreateKbFolderInput): Promise<KnowledgeFolder> {
  const slug = generateSlug(input.name);

  return await prisma.$transaction(async (tx) => {
    await ensureEntityType('KNOWLEDGE_FOLDER', tx);

    const model = await tx.tvModel.findUnique({
      where: { id: input.modelId },
      include: { brand: true },
    });

    if (!model) {
      throw new Error('TV Model not found');
    }

    // Get current max sort order
    const maxSort = await tx.knowledgeFolder.aggregate({
      where: { modelId: input.modelId, parentId: null },
      _max: { sortOrder: true },
    });
    const nextSort = (maxSort._max.sortOrder ?? 0) + 1;

    const entity = await tx.entity.create({
      data: {
        entityTypeCode: 'KNOWLEDGE_FOLDER',
        displayName: `${model.modelNumber} - ${input.name}`,
        searchText: `${model.brand.name} ${model.modelNumber} ${input.name}`,
      },
    });

    return await tx.knowledgeFolder.create({
      data: {
        entityId: entity.id,
        modelId: input.modelId,
        name: input.name,
        slug,
        parentId: null, // Strictly root-level under Model (no nested subfolders)
        sortOrder: nextSort,
        isSystem: false,
      },
    });
  });
}

/**
 * Deletes a Knowledge Folder (only non-system folders can be deleted).
 */
export async function deleteKnowledgeFolder(folderId: string): Promise<void> {
  const folder = await prisma.knowledgeFolder.findUnique({
    where: { id: folderId },
  });

  if (!folder) throw new Error('Folder not found');
  if (folder.isSystem) throw new Error('System default folders (Backlight, More info) cannot be deleted.');

  await prisma.$transaction(async (tx) => {
    // Delete entity which cascades
    await tx.entity.delete({
      where: { id: folder.entityId },
    });
  });
}
