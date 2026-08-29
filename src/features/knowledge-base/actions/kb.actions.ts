// ============================================================
// TV Tech OS — Knowledge Base CRUD Server Actions
// ============================================================

'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import {
  ensureEntityType,
  ensureRelationshipType,
  getEntityTypeConnectOrCreate,
} from '@/lib/ensure-entity-types';
import { processAndUploadThumbnailUrl } from '@/lib/server-upload-thumbnail';
import { validateNameSimilarity } from '@/features/knowledge-base/utils/name-similarity-validator';

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

  if (!data.name || !data.name.trim()) {
    return { success: false, error: 'Brand name cannot be empty.' };
  }

  const cleanName = data.name.trim();

  // Validate duplicate / 8-character sequential match against all existing brands
  const existingBrands = await prisma.tvBrand.findMany({ select: { name: true } });
  const collision = validateNameSimilarity(cleanName, existingBrands.map((b) => b.name), 'Brand');
  if (collision.hasConflict) {
    return { success: false, error: collision.message };
  }

  try {
    const slug = generateSlug(cleanName);
    const cleanLogoUrl = await processAndUploadThumbnailUrl(data.logoUrl, 'tv-tech-os/brands');

    const brand = await prisma.$transaction(async (tx) => {
      await ensureEntityType('TV_BRAND', tx);
      const entity = await tx.entity.create({
        data: {
          entityType: getEntityTypeConnectOrCreate('TV_BRAND'),
          displayName: cleanName,
        },
      });

      const brand = await tx.tvBrand.create({
        data: {
          entityId: entity.id,
          name: cleanName,
          slug,
          description: data.description?.trim() || null,
          logoUrl: cleanLogoUrl || null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'CREATE',
          entityType: 'TV_BRAND',
          entityId: entity.id,
          changes: { name: cleanName },
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

  const cleanName = newName.trim();

  // Validate duplicate / 8-character sequential match against other existing brands
  const existingBrands = await prisma.tvBrand.findMany({
    where: { id: { not: brandId } },
    select: { name: true },
  });
  const collision = validateNameSimilarity(cleanName, existingBrands.map((b) => b.name), 'Brand');
  if (collision.hasConflict) {
    return { success: false, error: collision.message };
  }

  try {
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
    const cleanLogoUrl = await processAndUploadThumbnailUrl(logoUrl, 'tv-tech-os/brands');

    await prisma.$transaction(async (tx) => {
      const brand = await tx.tvBrand.findUnique({ where: { id: brandId } });
      if (!brand) throw new Error('Brand not found.');

      await tx.tvBrand.update({
        where: { id: brandId },
        data: { logoUrl: cleanLogoUrl || null },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'UPDATE',
          entityType: 'TV_BRAND',
          entityId: brand.entityId,
          changes: { logoUrl: cleanLogoUrl || null },
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

  if (!data.modelNumber || !data.modelNumber.trim()) {
    return { success: false, error: 'Model number cannot be empty.' };
  }

  const cleanNumber = data.modelNumber.trim().toUpperCase();

  // Validate duplicate / 8-character sequential match against existing models in the same Brand directory
  const existingModels = await prisma.tvModel.findMany({
    where: { brandId: data.brandId },
    select: { modelNumber: true },
  });
  const collision = validateNameSimilarity(cleanNumber, existingModels.map((m) => m.modelNumber), 'Model');
  if (collision.hasConflict) {
    return { success: false, error: collision.message };
  }

  try {
    const brand = await prisma.tvBrand.findUnique({
      where: { id: data.brandId },
      select: { name: true },
    });
    if (!brand) return { success: false, error: 'TV Brand not found.' };

    const model = await prisma.$transaction(async (tx) => {
      const slug = generateSlug(cleanNumber);
      const screenSizeInt = data.screenSize ? parseInt(data.screenSize, 10) : null;

      await ensureEntityType('TV_MODEL', tx);
      await ensureEntityType('KNOWLEDGE_FOLDER', tx);

      const entity = await tx.entity.create({
        data: {
          entityType: getEntityTypeConnectOrCreate('TV_MODEL'),
          displayName: `${brand.name} ${cleanNumber}`,
        },
      });

      const model = await tx.tvModel.create({
        data: {
          entityId: entity.id,
          brandId: data.brandId,
          modelNumber: cleanNumber,
          slug,
          screenSize: screenSizeInt && !isNaN(screenSizeInt) ? screenSizeInt : null,
          displayType: data.displayType || null,
          chassisNo: data.chassisNo || null,
          notes: data.notes || null,
        },
      });

      // Create the 2 default premade technical folders in parallel
      const systemFolders = ['Backlight', 'More info'];
      await Promise.all(
        systemFolders.map(async (folderName, idx) => {
          const folderEntity = await tx.entity.create({
            data: {
              entityType: getEntityTypeConnectOrCreate('KNOWLEDGE_FOLDER'),
              displayName: `${brand.name} ${cleanNumber} / ${folderName}`,
            },
          });

          return tx.knowledgeFolder.create({
            data: {
              entityId: folderEntity.id,
              modelId: model.id,
              name: folderName,
              slug: generateSlug(folderName),
              sortOrder: idx,
              isSystem: true,
            },
          });
        })
      );

      // Add to search index
      await tx.searchIndex.create({
        data: {
          entityId: entity.id,
          entityType: 'TV_MODEL',
          title: `${brand.name} ${cleanNumber}`,
          subtitle: [screenSizeInt && `${screenSizeInt}"`, data.displayType, data.chassisNo]
            .filter(Boolean)
            .join(' • ') || null,
          searchText: [brand.name, cleanNumber, data.screenSize, data.displayType, data.chassisNo, data.notes]
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
          changes: { brandId: data.brandId, modelNumber: cleanNumber },
        },
      });

      return model;
    }, { timeout: 35000, maxWait: 15000 });

    revalidatePath('/knowledge-base');
    revalidatePath(`/knowledge-base/brands/${data.brandId}`);
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
      await ensureRelationshipType('ITEM_COMPATIBLE_TV_MODEL', tx);

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

  const cleanNumber = newModelNumber.trim().toUpperCase();

  // Find target model to know its brandId
  const currentModel = await prisma.tvModel.findUnique({
    where: { id: modelId },
    select: { brandId: true },
  });

  if (!currentModel) {
    return { success: false, error: 'TV Model not found.' };
  }

  // Validate duplicate / 8-character sequential match against other models in the same Brand directory
  const existingModels = await prisma.tvModel.findMany({
    where: { brandId: currentModel.brandId, id: { not: modelId } },
    select: { modelNumber: true },
  });
  const collision = validateNameSimilarity(cleanNumber, existingModels.map((m) => m.modelNumber), 'Model');
  if (collision.hasConflict) {
    return { success: false, error: collision.message };
  }

  try {
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
