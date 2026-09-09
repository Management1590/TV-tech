'use server';

import { revalidatePath } from 'next/cache';
import * as folderItemService from '../services/folder-item.service';
import { getCurrentUser } from '@/lib/auth/get-current-user';

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function linkItemToFolderAction(
  folderId: string,
  itemId: string
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') return { success: false, error: 'Permission denied.' };

  try {
    await folderItemService.linkItemToFolder(folderId, itemId, user.id);
    revalidatePath('/inventory');
    revalidatePath(`/inventory/items/${itemId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to link item to folder' };
  }
}

export async function unlinkItemFromFolderAction(
  folderId: string,
  itemId: string
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') return { success: false, error: 'Permission denied.' };

  try {
    await folderItemService.unlinkItemFromFolder(folderId, itemId, user.id);
    revalidatePath('/inventory');
    revalidatePath(`/inventory/items/${itemId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to remove item from folder' };
  }
}
