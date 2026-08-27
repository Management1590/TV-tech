'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { createKnowledgeFolder, deleteKnowledgeFolder } from '@/features/knowledge-base/services/kb-folder.service';

export async function createKnowledgeFolderAction(modelId: string, name: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized: Authentication required.' };
  }

  if (!name || !name.trim()) {
    return { success: false, error: 'Folder name is required.' };
  }

  try {
    const folder = await createKnowledgeFolder({
      modelId,
      name: name.trim(),
    });

    revalidatePath(`/knowledge-base/models/${modelId}`);
    return { success: true, folderId: folder.id };
  } catch (error: any) {
    console.error('Create Knowledge Folder error:', error);
    return { success: false, error: error.message || 'Failed to create folder.' };
  }
}

export async function deleteKnowledgeFolderAction(folderId: string, modelId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized: Authentication required.' };
  }

  try {
    await deleteKnowledgeFolder(folderId);
    revalidatePath(`/knowledge-base/models/${modelId}`);
    return { success: true };
  } catch (error: any) {
    console.error('Delete Knowledge Folder error:', error);
    return { success: false, error: error.message || 'Failed to delete folder.' };
  }
}
