// ============================================================
// TV Tech OS — Knowledge Base CRUD Server Actions
// ============================================================

'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/get-current-user';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── TV Brand Actions ──

export async function createTvBrandAction(data: {
  name: string;
  description?: string;
  logoUrl?: string;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized: Authentication required.' };
  }

  try {
    const slug = generateSlug(data.name);

    const brand = await prisma.$transaction(async (tx) => {
      const entity = await tx.entity.create({
        data: {
          entityType: { connect: { code: 'TV_BRAND' } },
          displayName: data.name,
        },
      });

      const brand = await tx.tvBrand.create({
        data: {
          entityId: entity.id,
          name: data.name,
          slug,
          description: data.description?.trim() || null,
          logoUrl: data.logoUrl || null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CREATE',
          entityType: 'TV_BRAND',
          entityId: entity.id,
          changes: { name: data.name },
        },
      });

      return brand;
    });

    revalidatePath('/knowledge-base');
    return { success: true, data: brand };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create TV brand.' };
  }
}

export async function renameTvBrandAction(brandId: string, newName: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized: Authentication required.' };
  }

  if (!newName || !newName.trim()) {
    return { success: false, error: 'Brand name cannot be empty.' };
  }

  try {
    const cleanName = newName.trim();
    const slug = generateSlug(cleanName);

    await prisma.$transaction(async (tx) => {
      const brand = await tx.tvBrand.findUnique({ where: { id: brandId } });
      if (!brand) throw new Error('Brand not found.');

      await tx.tvBrand.update({
        where: { id: brandId },
        data: { name: cleanName, slug },
      });

      await tx.entity.update({
        where: { id: brand.entityId },
        data: { displayName: cleanName },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          entityType: 'TV_BRAND',
          entityId: brand.entityId,
          changes: { oldName: brand.name, newName: cleanName },
        },
      });
    });

    revalidatePath('/knowledge-base');
    revalidatePath(`/knowledge-base/brands/${brandId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to rename TV brand.' };
  }
}

export async function updateTvBrandDescriptionAction(brandId: string, description: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized: Authentication required.' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const brand = await tx.tvBrand.findUnique({ where: { id: brandId } });
      if (!brand) throw new Error('Brand not found.');

      await tx.tvBrand.update({
        where: { id: brandId },
        data: { description: description.trim() || null },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          entityType: 'TV_BRAND',
          entityId: brand.entityId,
          changes: { description: description.trim() || null },
        },
      });
    });

    revalidatePath('/knowledge-base');
    revalidatePath(`/knowledge-base/brands/${brandId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update brand description.' };
  }
}

export async function setTvBrandThumbnailAction(brandId: string, logoUrl: string | null) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized: Authentication required.' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      const brand = await tx.tvBrand.findUnique({ where: { id: brandId } });
      if (!brand) throw new Error('Brand not found.');

      await tx.tvBrand.update({
        where: { id: brandId },
        data: { logoUrl: logoUrl || null },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          entityType: 'TV_BRAND',
          entityId: brand.entityId,
          changes: { logoUrl: logoUrl || null },
        },
      });
    });

    revalidatePath('/knowledge-base');
    revalidatePath(`/knowledge-base/brands/${brandId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to update brand thumbnail.' };
  }
}

export async function deleteTvBrandAction(brandId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized: Authentication required.' };
  }

  try {
    const brand = await prisma.tvBrand.findUnique({
      where: { id: brandId },
      include: {
        _count: { select: { models: true } },
      },
    });

    if (!brand) throw new Error('Brand not found.');

    // Enforce rule: only delete when inside models are already deleted
    if (brand._count.models > 0) {
      return {
        success: false,
        error: `Cannot delete Brand "${brand.name}". Please delete all ${brand._count.models} model(s) inside this brand first.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'DELETE',
          entityType: 'TV_BRAND',
          entityId: brand.entityId,
          changes: { name: brand.name },
        },
      });

      await tx.entity.delete({
        where: { id: brand.entityId },
      });
    });

    revalidatePath('/knowledge-base');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete TV brand.' };
  }
}

// ── TV Model Actions ──

export async function createTvModelAction(data: {
  brandId: string;
  modelNumber: string;
  screenSize?: string;
  displayType?: string;
  chassisNo?: string;
  notes?: string;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized: Authentication required.' };
  }

  try {
    const model = await prisma.$transaction(async (tx) => {
      const brand = await tx.tvBrand.findUnique({
        where: { id: data.brandId },
        select: { name: true },
      });
      if (!brand) throw new Error('TV Brand not found.');

      const slug = generateSlug(data.modelNumber);
      const screenSizeInt = data.screenSize ? parseInt(data.screenSize, 10) : null;

      const entity = await tx.entity.create({
        data: {
          entityType: { connect: { code: 'TV_MODEL' } },
          displayName: `${brand.name} ${data.modelNumber}`,
        },
      });

      const model = await tx.tvModel.create({
        data: {
          entityId: entity.id,
          brandId: data.brandId,
          modelNumber: data.modelNumber,
          slug,
          screenSize: screenSizeInt && !isNaN(screenSizeInt) ? screenSizeInt : null,
          displayType: data.displayType || null,
          chassisNo: data.chassisNo || null,
          notes: data.notes || null,
        },
      });

      // Create default knowledge folders with their own entities
      const systemFolders = [
        'Backlight Strips',
        'Display Panel',
        'Main Board',
        'Power Board',
        'T-Con Board',
        'Software & Firmware',
        'Service Notes'
      ];
      for (let i = 0; i < systemFolders.length; i++) {
        const folderEntity = await tx.entity.create({
          data: {
            entityType: { connect: { code: 'KNOWLEDGE_FOLDER' } },
            displayName: `${brand.name} ${data.modelNumber} / ${systemFolders[i]}`,
          },
        });

        await tx.knowledgeFolder.create({
          data: {
            entityId: folderEntity.id,
            modelId: model.id,
            name: systemFolders[i],
            slug: generateSlug(systemFolders[i]),
            sortOrder: i,
            isSystem: true,
          },
        });
      }

      // Add to search index
      await tx.searchIndex.create({
        data: {
          entityId: entity.id,
          entityType: 'TV_MODEL',
          title: `${brand.name} ${data.modelNumber}`,
          subtitle: [screenSizeInt && `${screenSizeInt}"`, data.displayType, data.chassisNo]
            .filter(Boolean)
            .join(' • ') || null,
          searchText: [brand.name, data.modelNumber, data.screenSize, data.displayType, data.chassisNo, data.notes]
            .filter(Boolean)
            .join(' '),
        },
      });

      // Increment brand model count
      await tx.tvBrand.update({
        where: { id: data.brandId },
        data: { modelCount: { increment: 1 } },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CREATE',
          entityType: 'TV_MODEL',
          entityId: entity.id,
          changes: { brandId: data.brandId, modelNumber: data.modelNumber },
        },
      });

      return model;
    });

    revalidatePath('/knowledge-base');
    return { success: true, data: model };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to create TV model.' };
  }
}

// ── Link Item to TV Model ──

export async function linkItemToTvModelAction(itemIdOrEntityId: string, modelIdOrEntityId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized: Authentication required.' };
  }

  try {
    // Resolve entity IDs if domain IDs were passed
    const item = await prisma.item.findUnique({ where: { id: itemIdOrEntityId }, select: { entityId: true } });
    const itemEntityId = item ? item.entityId : itemIdOrEntityId;

    const model = await prisma.tvModel.findUnique({ where: { id: modelIdOrEntityId }, select: { entityId: true } });
    const modelEntityId = model ? model.entityId : modelIdOrEntityId;

    await prisma.$transaction(async (tx) => {
      // Get or create the relationship type
      let relType = await tx.relationshipType.findUnique({
        where: { code: 'ITEM_COMPATIBLE_TV_MODEL' },
      });

      if (!relType) {
        relType = await tx.relationshipType.create({
          data: {
            code: 'ITEM_COMPATIBLE_TV_MODEL',
            label: 'Item ↔ TV Model Compatibility',
            forwardLabel: 'Compatible With',
            reverseLabel: 'Compatible Parts',
            sourceEntityType: 'ITEM',
            targetEntityType: 'TV_MODEL',
          },
        });
      }

      // Check if already linked
      const existing = await tx.entityRelationship.findFirst({
        where: {
          sourceEntityId: itemEntityId,
          targetEntityId: modelEntityId,
          relationshipTypeCode: 'ITEM_COMPATIBLE_TV_MODEL',
        },
      });

      if (existing) throw new Error('Already linked.');

      await tx.entityRelationship.create({
        data: {
          sourceEntityId: itemEntityId,
          targetEntityId: modelEntityId,
          relationshipTypeCode: 'ITEM_COMPATIBLE_TV_MODEL',
          createdById: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'LINK',
          entityType: 'TV_MODEL',
          entityId: modelEntityId,
          changes: { linkedItemId: itemEntityId },
        },
      });
    });

    revalidatePath('/knowledge-base');
    revalidatePath('/inventory');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to link item to TV model.' };
  }
}

export async function unlinkItemFromTvModelAction(itemIdOrEntityId: string, modelIdOrEntityId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized: Authentication required.' };
  }

  try {
    const item = await prisma.item.findUnique({ where: { id: itemIdOrEntityId }, select: { entityId: true } });
    const itemEntityId = item ? item.entityId : itemIdOrEntityId;

    const model = await prisma.tvModel.findUnique({ where: { id: modelIdOrEntityId }, select: { entityId: true } });
    const modelEntityId = model ? model.entityId : modelIdOrEntityId;

    await prisma.entityRelationship.deleteMany({
      where: {
        sourceEntityId: itemEntityId,
        targetEntityId: modelEntityId,
        relationshipTypeCode: 'ITEM_COMPATIBLE_TV_MODEL',
      },
    });

    revalidatePath('/knowledge-base');
    revalidatePath('/inventory');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to unlink item from TV model.' };
  }
}

// Aliases
export const linkPartToTvModelAction = linkItemToTvModelAction;
export const unlinkPartFromTvModelAction = unlinkItemFromTvModelAction;

// ── Rename TV Model Action ──

export async function renameTvModelAction(
  modelId: string,
  newModelNumber: string,
  newScreenSize?: string
) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized: Authentication required.' };
  }

  if (!newModelNumber || !newModelNumber.trim()) {
    return { success: false, error: 'Model number cannot be empty.' };
  }

  try {
    const cleanNumber = newModelNumber.trim().toUpperCase();
    const slug = generateSlug(cleanNumber);
    const screenSizeInt = newScreenSize ? parseInt(newScreenSize, 10) : null;

    await prisma.$transaction(async (tx) => {
      const model = await tx.tvModel.findUnique({
        where: { id: modelId },
        include: { brand: { select: { name: true } } },
      });
      if (!model) throw new Error('TV Model not found.');

      await tx.tvModel.update({
        where: { id: modelId },
        data: {
          modelNumber: cleanNumber,
          slug,
          screenSize: screenSizeInt && !isNaN(screenSizeInt) ? screenSizeInt : null,
        },
      });

      const newDisplayName = `${model.brand.name} ${cleanNumber}`;
      await tx.entity.update({
        where: { id: model.entityId },
        data: { displayName: newDisplayName },
      });

      // Update Search Index
      await tx.searchIndex.updateMany({
        where: { entityId: model.entityId },
        data: {
          title: newDisplayName,
          searchText: [
            model.brand.name,
            cleanNumber,
            screenSizeInt ? `${screenSizeInt}` : '',
            model.displayType,
            model.chassisNo,
            model.notes,
          ]
            .filter(Boolean)
            .join(' '),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          entityType: 'TV_MODEL',
          entityId: model.entityId,
          changes: {
            oldModelNumber: model.modelNumber,
            newModelNumber: cleanNumber,
            screenSize: screenSizeInt,
          },
        },
      });
    });

    revalidatePath('/knowledge-base');
    revalidatePath(`/knowledge-base/models/${modelId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to rename TV model.' };
  }
}

// ── Delete TV Model Action ──

export async function deleteTvModelAction(modelId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized: Authentication required.' };
  }

  try {
    const model = await prisma.tvModel.findUnique({
      where: { id: modelId },
      include: {
        brand: { select: { id: true, name: true } },
      },
    });

    if (!model) throw new Error('TV Model not found.');

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'DELETE',
          entityType: 'TV_MODEL',
          entityId: model.entityId,
          changes: {
            modelNumber: model.modelNumber,
            brandName: model.brand.name,
          },
        },
      });

      // Delete Entity (cascades to tv_models, knowledge_folders, pages, and relationships)
      await tx.entity.delete({
        where: { id: model.entityId },
      });

      // Decrement brand model count
      await tx.tvBrand.update({
        where: { id: model.brandId },
        data: {
          modelCount: {
            decrement: 1,
          },
        },
      });
    });

    revalidatePath('/knowledge-base');
    revalidatePath(`/knowledge-base/brands/${model.brandId}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete TV model.' };
  }
}
