// ============================================================
// FolderItem Junction Service (Many-to-Many Architecture)
// ============================================================
// Enforces Master Spec Rules 1-4:
// Rule 1: Folder and Item are separate entities.
// Rule 2: One Item can appear in multiple Folders simultaneously.
// Rule 3: "Link Existing Item" creates FolderItem link only; never duplicates Item.
// Rule 4: "Remove From Folder" deletes FolderItem link only; Item survives.

import { prisma } from '@/lib/prisma';
import { FolderItem } from '@prisma/client';
import { recordAuditLog } from '@/lib/audit';

export interface FolderSummary {
  id: string;
  name: string;
  materializedPath: string;
  linkedAt: Date;
}

/**
 * Links an existing Item to a Folder via FolderItem junction table (Rule 3).
 */
export async function linkItemToFolder(
  folderId: string,
  itemId: string,
  linkedById?: string
): Promise<FolderItem> {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: { id: true, containsItems: true, childFolderCount: true, name: true },
  });

  if (!folder) {
    throw new Error(`Folder with ID ${folderId} not found`);
  }

  if (folder.childFolderCount > 0) {
    throw new Error('Items can only be linked to leaf folders that have no sub-folders.');
  }

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: { id: true, name: true },
  });

  if (!item) {
    throw new Error(`Item with ID ${itemId} not found`);
  }

  const existingLink = await prisma.folderItem.findUnique({
    where: {
      folderId_itemId: { folderId, itemId },
    },
  });

  if (existingLink) {
    throw new Error('This item is already linked to this folder.');
  }

  const link = await prisma.$transaction(async (tx) => {
    const newLink = await tx.folderItem.create({
      data: {
        folderId,
        itemId,
        linkedById,
      },
    });

    await tx.folder.update({
      where: { id: folderId },
      data: {
        containsItems: true,
        itemCount: { increment: 1 },
      },
    });

    return newLink;
  });

  // Audit Log
  await recordAuditLog({
    userId: linkedById,
    action: 'LINK',
    entityType: 'FOLDER_ITEM',
    entityId: link.id,
    changes: { folderId, folderName: folder.name, itemId, itemName: item.name },
  });

  return link;
}

/**
 * Removes an Item from a Folder by deleting the FolderItem junction link (Rule 4).
 * The Item itself continues to exist independently in the system.
 */
export async function unlinkItemFromFolder(
  folderId: string,
  itemId: string,
  unlinkedById?: string
): Promise<void> {
  const link = await prisma.folderItem.findUnique({
    where: {
      folderId_itemId: { folderId, itemId },
    },
    include: {
      folder: { select: { name: true } },
      item: { select: { name: true } },
    },
  });

  if (!link) {
    throw new Error('This item is not linked to this folder.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.folderItem.delete({
      where: { id: link.id },
    });

    const updatedFolder = await tx.folder.update({
      where: { id: folderId },
      data: {
        itemCount: { decrement: 1 },
      },
      select: { itemCount: true },
    });

    if (updatedFolder.itemCount <= 0) {
      await tx.folder.update({
        where: { id: folderId },
        data: { containsItems: false, itemCount: 0 },
      });
    }
  });

  // Audit Log
  await recordAuditLog({
    userId: unlinkedById,
    action: 'UNLINK',
    entityType: 'FOLDER_ITEM',
    entityId: link.id,
    changes: { folderId, folderName: link.folder.name, itemId, itemName: link.item.name },
  });
}

/**
 * Retrieves all folders that an Item is linked to.
 */
export async function getItemFolders(itemId: string): Promise<FolderSummary[]> {
  const folderItems = await prisma.folderItem.findMany({
    where: { itemId },
    include: {
      folder: {
        select: { id: true, name: true, materializedPath: true },
      },
    },
    orderBy: { linkedAt: 'desc' },
  });

  return folderItems.map((fi) => ({
    id: fi.folder.id,
    name: fi.folder.name,
    materializedPath: fi.folder.materializedPath,
    linkedAt: fi.linkedAt,
  }));
}

/**
 * Batch links multiple items to a folder (for reorganization / bulk import).
 */
export async function batchLinkItemsToFolder(
  folderId: string,
  itemIds: string[],
  linkedById?: string
): Promise<{ addedCount: number }> {
  let addedCount = 0;
  for (const itemId of itemIds) {
    try {
      await linkItemToFolder(folderId, itemId, linkedById);
      addedCount++;
    } catch {
      // Skip items already linked
    }
  }
  return { addedCount };
}
