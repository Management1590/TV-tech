// ============================================================
// Knowledge Base Page Service
// ============================================================
// Manages repair documentation pages, schematics, voltage test points,
// and failure notes inside TV Model KB folders.

import { prisma } from '@/lib/prisma';
import { KnowledgePage } from '@prisma/client';
import { ensureEntityType } from '@/lib/ensure-entity-types';

export interface CreateKbPageInput {
  kbFolderId: string;
  title: string;
  contentJson?: Record<string, unknown>;
  contentHtml?: string;
  createdById?: string;
}

export interface UpdateKbPageInput {
  title?: string;
  contentJson?: Record<string, unknown>;
  contentHtml?: string;
}

export async function createKbPage(input: CreateKbPageInput): Promise<KnowledgePage> {
  return await prisma.$transaction(async (tx) => {
    await ensureEntityType('KNOWLEDGE_PAGE', tx);
    const entity = await tx.entity.create({
      data: {
        entityTypeCode: 'KNOWLEDGE_PAGE',
        displayName: input.title,
        searchText: `${input.title} ${input.contentHtml || ''}`.trim(),
        createdBy: input.createdById,
      },
    });

    return await tx.knowledgePage.create({
      data: {
        entityId: entity.id,
        kbFolderId: input.kbFolderId,
        title: input.title,
        contentJson: input.contentJson ? (input.contentJson as any) : undefined,
        contentHtml: input.contentHtml,
        createdById: input.createdById,
      },
    });
  });
}

export async function getKbPageById(pageId: string) {
  return await prisma.knowledgePage.findUnique({
    where: { id: pageId },
    include: {
      kbFolder: {
        include: {
          model: {
            include: { brand: true },
          },
        },
      },
      createdBy: { select: { id: true, fullName: true, email: true } },
    },
  });
}

export async function updateKbPage(pageId: string, input: UpdateKbPageInput): Promise<KnowledgePage> {
  const page = await prisma.knowledgePage.update({
    where: { id: pageId },
    data: {
      title: input.title,
      contentJson: input.contentJson ? (input.contentJson as any) : undefined,
      contentHtml: input.contentHtml,
    },
  });

  if (input.title) {
    await prisma.entity.update({
      where: { id: page.entityId },
      data: { displayName: input.title },
    });
  }

  return page;
}

export async function deleteKbPage(pageId: string): Promise<void> {
  const page = await prisma.knowledgePage.findUnique({
    where: { id: pageId },
    select: { entityId: true },
  });

  if (!page) return;

  await prisma.entity.delete({
    where: { id: page.entityId },
  });
}
