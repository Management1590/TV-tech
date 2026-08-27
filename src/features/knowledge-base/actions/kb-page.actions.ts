'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { createKbPage, updateKbPage, deleteKbPage } from '@/features/knowledge-base/services/kb-page.service';
import { prisma } from '@/lib/prisma';

export async function createKbPageAction(data: {
  kbFolderId: string;
  title: string;
  contentHtml?: string;
  contentJson?: any;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized: Authentication required.' };
  }

  if (!data.title?.trim() || !data.kbFolderId) {
    return { success: false, error: 'Title and folder are required.' };
  }

  try {
    const page = await createKbPage({
      kbFolderId: data.kbFolderId,
      title: data.title.trim(),
      contentHtml: data.contentHtml,
      contentJson: data.contentJson,
      createdById: user.id,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entityType: 'KNOWLEDGE_PAGE',
        entityId: page.entityId,
        changes: { title: page.title, kbFolderId: page.kbFolderId },
      },
    });

    revalidatePath('/knowledge-base');
    return { success: true, pageId: page.id };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create page.' };
  }
}

export async function updateKbPageAction(pageId: string, data: {
  title?: string;
  contentHtml?: string;
  contentJson?: any;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized: Authentication required.' };
  }

  try {
    const page = await updateKbPage(pageId, data);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entityType: 'KNOWLEDGE_PAGE',
        entityId: page.entityId,
        changes: { title: page.title },
      },
    });

    revalidatePath('/knowledge-base');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update page.' };
  }
}

export async function deleteKbPageAction(pageId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized: Authentication required.' };
  }

  try {
    await deleteKbPage(pageId);
    revalidatePath('/knowledge-base');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete page.' };
  }
}
