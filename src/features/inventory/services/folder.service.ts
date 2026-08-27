// ============================================================
// Folder Service — Adjacency List + Materialized Path
// ============================================================
// Manages nested inventory folders.
// Enforces:
// 1. Entity Registry registration for every folder
// 2. Circular movement prevention (cannot move folder into self or descendant)
// 3. Folder content rule (containsItems=true means leaf folder with items)
// 4. Materialized path recalculation for subtree on folder move
// 5. Audit logging for CREATE, RENAME, MOVE, DELETE operations

import { prisma } from '@/lib/prisma';
import { Folder } from '@prisma/client';
import { recordAuditLog } from '@/lib/audit';
import { ensureEntityType } from '@/lib/ensure-entity-types';

export interface CreateFolderInput {
  name: string;
  description?: string;
  parentId?: string | null;
  containsItems?: boolean;
  thumbnailUrl?: string;
  thumbnailPublicId?: string;
  createdById?: string;
}

export interface UpdateFolderInput {
  name?: string;
  description?: string;
  containsItems?: boolean;
  thumbnailUrl?: string;
  thumbnailPublicId?: string;
}

export async function getUniqueFolderSlug(
  tx: any,
  parentId: string | null | undefined,
  baseNameOrSlug: string,
  excludeFolderId?: string
): Promise<string> {
  const baseSlug = (baseNameOrSlug || 'folder')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'folder';

  let candidateSlug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await tx.folder.findFirst({
      where: {
        parentId: parentId || null,
        slug: candidateSlug,
        ...(excludeFolderId ? { id: { not: excludeFolderId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) {
      return candidateSlug;
    }

    candidateSlug = `${baseSlug}-${counter}`;
    counter++;
  }
}

/**
 * Creates a new Folder entity registered in the Entity Registry.
 */
export async function createFolder(input: CreateFolderInput): Promise<Folder> {
  // Determine depth & materializedPath from parent if specified
  let depth = 0;
  let parentPath = '';

  if (input.parentId) {
    const parentFolder = await prisma.folder.findUnique({
      where: { id: input.parentId },
      select: { id: true, depth: true, materializedPath: true, containsItems: true },
    });

    if (!parentFolder) {
      throw new Error(`Parent folder with ID ${input.parentId} not found`);
    }

    if (parentFolder.containsItems) {
      throw new Error('Cannot create sub-folders inside a folder that directly contains items.');
    }

    depth = parentFolder.depth + 1;
    parentPath = parentFolder.materializedPath;
  }

  // Create folder inside a Prisma transaction (Entity + Folder)
  const folder = await prisma.$transaction(async (tx) => {
    // 0. Ensure EntityType exists
    await ensureEntityType('FOLDER', tx);

    const uniqueSlug = await getUniqueFolderSlug(tx, input.parentId, input.name);

    // 1. Create Entity record
    const entity = await tx.entity.create({
      data: {
        entityTypeCode: 'FOLDER',
        displayName: input.name,
        searchText: `${input.name} ${input.description || ''}`.trim(),
        createdBy: input.createdById,
      },
    });

    const folderId = entity.id;
    const materializedPath = parentPath ? `${parentPath}/${folderId}` : folderId;

    // 2. Create Folder record
    const newFolder = await tx.folder.create({
      data: {
        entityId: entity.id,
        name: input.name,
        description: input.description,
        slug: uniqueSlug,
        parentId: input.parentId || null,
        materializedPath,
        depth,
        containsItems: input.containsItems || false,
        thumbnailUrl: input.thumbnailUrl,
        thumbnailPublicId: input.thumbnailPublicId,
        createdById: input.createdById,
      },
    });

    // 3. If parent folder exists, increment childFolderCount
    if (input.parentId) {
      await tx.folder.update({
        where: { id: input.parentId },
        data: { childFolderCount: { increment: 1 } },
      });
    }

    return newFolder;
  });

  // Audit Log
  await recordAuditLog({
    userId: input.createdById,
    action: 'CREATE',
    entityType: 'FOLDER',
    entityId: folder.id,
    changes: { name: folder.name, parentId: folder.parentId },
  });

  return folder;
}

/**
 * Renames a Folder and updates its slug and Entity displayName.
 */
export async function renameFolder(folderId: string, newName: string, userId?: string): Promise<Folder> {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
  });

  if (!folder) {
    throw new Error(`Folder ${folderId} not found`);
  }

  const oldName = folder.name;

  const updatedFolder = await prisma.$transaction(async (tx) => {
    const uniqueSlug = await getUniqueFolderSlug(tx, folder.parentId, newName, folderId);

    const updated = await tx.folder.update({
      where: { id: folderId },
      data: {
        name: newName,
        slug: uniqueSlug,
      },
    });

    await tx.entity.update({
      where: { id: folder.entityId },
      data: { displayName: newName },
    });

    return updated;
  });

  // Audit Log
  await recordAuditLog({
    userId,
    action: 'RENAME',
    entityType: 'FOLDER',
    entityId: folderId,
    changes: { oldName, newName },
  });

  return updatedFolder;
}

/**
 * Moves a folder to a new parent, validating circular hierarchy and updating materialized_path for entire subtree.
 */
export async function moveFolder(folderId: string, newParentId: string | null, userId?: string): Promise<Folder> {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
  });

  if (!folder) {
    throw new Error(`Folder ${folderId} not found`);
  }

  if (folder.parentId === newParentId) {
    return folder; // No move needed
  }

  let newDepth = 0;
  let newParentPath = '';

  if (newParentId) {
    if (newParentId === folderId) {
      throw new Error('Cannot move a folder into itself.');
    }

    const newParent = await prisma.folder.findUnique({
      where: { id: newParentId },
      select: { id: true, depth: true, materializedPath: true, containsItems: true },
    });

    if (!newParent) {
      throw new Error(`Target parent folder ${newParentId} not found`);
    }

    if (newParent.materializedPath.includes(folderId)) {
      throw new Error('Cannot move a folder into one of its own sub-folders.');
    }

    if (newParent.containsItems) {
      throw new Error('Target parent folder is marked as containing items and cannot have sub-folders.');
    }

    newDepth = newParent.depth + 1;
    newParentPath = newParent.materializedPath;
  }

  const oldPath = folder.materializedPath;
  const oldParentId = folder.parentId;
  const newPath = newParentPath ? `${newParentPath}/${folder.id}` : folder.id;
  const depthDelta = newDepth - folder.depth;

  const updatedFolder = await prisma.$transaction(async (tx) => {
    // Deduplicate slug in destination parent
    const uniqueSlug = await getUniqueFolderSlug(tx, newParentId, folder.slug, folderId);

    const updated = await tx.folder.update({
      where: { id: folderId },
      data: {
        parentId: newParentId,
        slug: uniqueSlug,
        materializedPath: newPath,
        depth: newDepth,
      },
    });

    if (oldParentId) {
      await tx.folder.update({
        where: { id: oldParentId },
        data: { childFolderCount: { decrement: 1 } },
      });
    }
    if (newParentId) {
      await tx.folder.update({
        where: { id: newParentId },
        data: { childFolderCount: { increment: 1 } },
      });
    }

    const descendants = await tx.folder.findMany({
      where: { materializedPath: { startsWith: `${oldPath}/` } },
    });

    for (const desc of descendants) {
      const descNewPath = desc.materializedPath.replace(oldPath, newPath);
      await tx.folder.update({
        where: { id: desc.id },
        data: {
          materializedPath: descNewPath,
          depth: desc.depth + depthDelta,
        },
      });
    }

    return updated;
  });

  // Audit Log
  await recordAuditLog({
    userId,
    action: 'MOVE',
    entityType: 'FOLDER',
    entityId: folderId,
    changes: { oldParentId, newParentId, oldPath, newPath },
  });

  return updatedFolder;
}

/**
 * Deletes a Folder with safety checks.
 * Prevents accidental item deletion (Rule 4): Only deletes Folder and FolderItem links, never Items.
 */
export async function deleteFolder(folderId: string, userId?: string): Promise<void> {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: { id: true, entityId: true, parentId: true, childFolderCount: true },
  });

  if (!folder) return;

  if (folder.childFolderCount > 0) {
    throw new Error('Cannot delete a folder that contains sub-folders. Move or delete sub-folders first.');
  }

  await prisma.$transaction(async (tx) => {
    // 1. If folder has parent, decrement childFolderCount
    if (folder.parentId) {
      await tx.folder.update({
        where: { id: folder.parentId },
        data: { childFolderCount: { decrement: 1 } },
      });
    }

    // 2. Delete Entity (cascades to Folder and FolderItems, preserving Items)
    await tx.entity.delete({
      where: { id: folder.entityId },
    });
  });

  // Audit Log
  await recordAuditLog({
    userId,
    action: 'DELETE',
    entityType: 'FOLDER',
    entityId: folderId,
  });
}
