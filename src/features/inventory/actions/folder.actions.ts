// ============================================================
// TV Tech OS — Folder CRUD Server Actions
// ============================================================

'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import * as folderService from '@/features/inventory/services/folder.service';
import { matchesOrderedPattern, calculateMatchScore } from '@/features/search/services/search.service';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function createFolderAction(data: {
  name: string;
  description?: string;
  parentId?: string | null;
  thumbnailUrl?: string | null;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, error: 'Permission denied. Admin access required.' };
  }

  try {
    const result = await folderService.createFolder({
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
      parentId: data.parentId || null,
      thumbnailUrl: data.thumbnailUrl?.trim() || undefined,
      createdById: user.id,
    });

    revalidatePath('/inventory');
    revalidatePath('/inventory/folders');
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Create folder error:', error);
    return { success: false, error: error.message || 'Failed to create folder.' };
  }
}

export async function updateFolderThumbnailAction(folderId: string, thumbnailUrl: string | null) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, error: 'Permission denied. Admin access required.' };
  }

  try {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      select: { id: true, entityId: true, name: true },
    });

    if (!folder) return { success: false, error: 'Folder not found.' };

    await prisma.$transaction(async (tx) => {
      await tx.folder.update({
        where: { id: folderId },
        data: { thumbnailUrl },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          entityType: 'FOLDER',
          entityId: folder.entityId,
          changes: { thumbnailUrl },
        },
      });
    });

    revalidatePath('/inventory');
    revalidatePath('/inventory/folders');
    return { success: true };
  } catch (error: any) {
    console.error('Update folder thumbnail error:', error);
    return { success: false, error: error.message || 'Failed to update folder thumbnail.' };
  }
}

export async function updateFolderDescriptionAction(folderId: string, description: string | null) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, error: 'Permission denied. Admin access required.' };
  }

  try {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      select: { id: true, entityId: true, name: true },
    });

    if (!folder) return { success: false, error: 'Folder not found.' };

    await prisma.$transaction(async (tx) => {
      await tx.folder.update({
        where: { id: folderId },
        data: { description: description?.trim() || null },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          entityType: 'FOLDER',
          entityId: folder.entityId,
          changes: { description },
        },
      });
    });

    revalidatePath('/inventory');
    revalidatePath('/inventory/folders');
    return { success: true };
  } catch (error: any) {
    console.error('Update folder description error:', error);
    return { success: false, error: error.message || 'Failed to update folder description.' };
  }
}

export async function renameFolderAction(folderId: string, newName: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, error: 'Permission denied.' };
  }

  try {
    await folderService.renameFolder(folderId, newName.trim(), user.id);
    revalidatePath('/inventory');
    revalidatePath('/inventory/folders');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to rename folder.' };
  }
}

export async function deleteFolderAction(folderId: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, error: 'Permission denied.' };
  }

  try {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        _count: { select: { children: true, folderItems: true } },
      },
    });

    if (!folder) return { success: false, error: 'Folder not found.' };
    if (folder._count.children > 0) return { success: false, error: 'Cannot delete folder with sub-folders. Move or delete them first.' };
    if (folder._count.folderItems > 0) return { success: false, error: 'Cannot delete folder with linked items. Unlink them first.' };

    await prisma.$transaction(async (tx) => {
      // Update parent child count
      if (folder.parentId) {
        await tx.folder.update({
          where: { id: folder.parentId },
          data: { childFolderCount: { decrement: 1 } },
        });
      }

      // Audit log (before delete so entityId still exists)
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'DELETE',
          entityType: 'FOLDER',
          entityId: folder.entityId,
          changes: { name: folder.name },
        },
      });

      // Delete folder (Entity cascade will handle)
      await tx.entity.delete({ where: { id: folder.entityId } });
    });

    revalidatePath('/inventory');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete folder.' };
  }
}

export async function moveFolderAction(folderId: string, newParentId: string | null) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, error: 'Permission denied.' };
  }
  try {
    await folderService.moveFolder(folderId, newParentId, user.id);
    revalidatePath('/inventory');
    revalidatePath(`/inventory/folders`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to move folder.' };
  }
}

export async function createParameterDefinitionAction(data: {
  folderId?: string | null;
  name: string;
  valueType: string;
  unit?: string;
  isRequired?: boolean;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, error: 'Permission denied.' };
  }
  try {
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    await prisma.parameterDefinition.create({
      data: {
        folderId: data.folderId || null,
        name: data.name,
        slug,
        valueType: data.valueType as any,
        unit: data.unit || null,
        isRequired: data.isRequired ?? false,
        sortOrder: 0,
      },
    });
    revalidatePath('/inventory');
    revalidatePath('/inventory/folders');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create parameter.' };
  }
}

export async function deleteParameterDefinitionAction(parameterId: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, error: 'Permission denied. Admin access required.' };
  }
  try {
    const param = await prisma.parameterDefinition.findUnique({
      where: { id: parameterId },
      include: { folder: { select: { id: true, name: true, entityId: true } } },
    });

    if (!param) return { success: false, error: 'Parameter definition not found.' };

    await prisma.$transaction(async (tx) => {
      // Cascade delete parameter values linked to this definition
      await tx.itemParameterValue.deleteMany({
        where: { parameterDefinitionId: parameterId },
      });

      // Delete the definition
      await tx.parameterDefinition.delete({
        where: { id: parameterId },
      });

      // Audit log
      if (param.folder?.entityId) {
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: 'DELETE',
            entityType: 'FOLDER',
            entityId: param.folder.entityId,
            changes: { deletedParameter: param.name, slug: param.slug },
          },
        });
      }
    });

    revalidatePath('/inventory');
    revalidatePath('/inventory/folders');
    return { success: true };
  } catch (error: any) {
    console.error('Delete parameter error:', error);
    return { success: false, error: error.message || 'Failed to delete parameter.' };
  }
}

export async function getFoldersForMoveAction(
  currentFolderId: string,
  query?: string,
  browseParentId?: string | null
) {
  try {
    const cleanQuery = query?.trim().toLowerCase() || '';

    // Fetch current folder to inspect its materializedPath and parentId
    const currentFolder = await prisma.folder.findUnique({
      where: { id: currentFolderId },
      select: { id: true, name: true, parentId: true, materializedPath: true },
    });

    if (!currentFolder) {
      return { success: false, error: 'Current folder not found', folders: [], currentFolder: null };
    }

    let folders = await prisma.folder.findMany({
      where: browseParentId !== undefined && browseParentId !== null
        ? { parentId: browseParentId }
        : cleanQuery
        ? {}
        : { parentId: null },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { children: true, folderItems: true } },
      },
    });

    let mapped = folders.map((f) => {
      const isCurrent = f.id === currentFolderId;
      const isDescendant = f.materializedPath.startsWith(`${currentFolder.materializedPath}/`);
      const isCurrentParent = f.id === currentFolder.parentId;
      const combinedText = `${f.name} ${f.description || ''}`;
      const matchScore = cleanQuery ? calculateMatchScore(cleanQuery, combinedText) : 100;

      return {
        id: f.id,
        name: f.name,
        description: f.description,
        materializedPath: f.materializedPath,
        depth: f.depth,
        parentId: f.parentId,
        childCount: f._count.children,
        itemCount: f._count.folderItems,
        isCurrent,
        isDescendant,
        isCurrentParent,
        isValidDestination: !isCurrent && !isDescendant && !isCurrentParent,
        matchScore,
      };
    });

    if (cleanQuery) {
      mapped = mapped
        .filter((f) => f.matchScore > 0)
        .sort((a, b) => b.matchScore - a.matchScore);
    }

    return {
      success: true,
      folders: mapped,
      currentFolder: {
        id: currentFolder.id,
        name: currentFolder.name,
        isAtRoot: currentFolder.parentId === null,
        parentId: currentFolder.parentId,
      },
    };
  } catch (error: any) {
    console.error('Get folders for move error:', error);
    return { success: false, error: error.message || 'Failed to fetch destination folders', folders: [] };
  }
}
