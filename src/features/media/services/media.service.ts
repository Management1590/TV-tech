// ============================================================
// Media Management Service (Cloudinary & Supabase Storage)
// ============================================================
// Enforces Phase 15 rules:
// 1. Cloudinary for Images & Videos
// 2. Supabase Storage for Audio recordings & PDFs
// 3. Registers media in Entity Registry and links via EntityMedia table.

import { prisma } from '@/lib/prisma';
import { Media, MediaType, StorageProvider } from '@prisma/client';
import { ensureEntityType } from '@/lib/ensure-entity-types';

export interface CreateMediaInput {
  entityId: string; // Target entity (Item, KnowledgePage, etc.)
  mediaType: MediaType;
  provider?: StorageProvider;
  publicId: string;
  url: string;
  secureUrl?: string;
  filename?: string;
  mimeType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  purpose?: string; // 'PRIMARY', 'GALLERY', 'SCHEMATIC', etc.
  uploadedById?: string;
}

/**
 * Creates a Media asset record in Entity Registry and links it to target entity via EntityMedia.
 */
export async function createMediaAttachment(input: CreateMediaInput): Promise<Media> {
  const provider = input.provider || (input.mediaType === MediaType.AUDIO ? StorageProvider.SUPABASE : StorageProvider.CLOUDINARY);

  return await prisma.$transaction(async (tx) => {
    // 0. Ensure EntityType exists
    await ensureEntityType('MEDIA', tx);

    // 1. Create Media Entity in Entity Registry
    const mediaEntity = await tx.entity.create({
      data: {
        entityTypeCode: 'MEDIA',
        displayName: input.filename || `${input.mediaType}_${input.publicId}`,
        searchText: `${input.filename || ''} ${input.mediaType} ${input.publicId}`,
        createdBy: input.uploadedById,
      },
    });

    // 2. Create Media record
    const media = await tx.media.create({
      data: {
        entityId: mediaEntity.id,
        mediaType: input.mediaType,
        provider,
        publicId: input.publicId,
        url: input.url,
        secureUrl: input.secureUrl || input.url,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        width: input.width,
        height: input.height,
        uploadedById: input.uploadedById,
      },
    });

    // 3. Link to target entity via EntityMedia junction table (assign next sortOrder so new items take last place)
    const maxSort = await tx.entityMedia.aggregate({
      where: { entityId: input.entityId },
      _max: { sortOrder: true },
    });
    const nextSortOrder = (maxSort._max.sortOrder ?? -1) + 1;

    await tx.entityMedia.create({
      data: {
        entityId: input.entityId,
        mediaId: media.id,
        purpose: input.purpose || 'GALLERY',
        sortOrder: input.purpose === 'PRIMARY' ? 0 : nextSortOrder,
      },
    });

    return media;
  });
}

/**
 * Fetches all media attachments for a given entity.
 */
export async function getEntityMediaAttachments(entityId: string) {
  const attachments = await prisma.entityMedia.findMany({
    where: { entityId },
    orderBy: { sortOrder: 'asc' },
    include: {
      media: true,
    },
  });

  return attachments.map((a) => ({
    attachmentId: a.id,
    purpose: a.purpose,
    sortOrder: a.sortOrder,
    ...a.media,
  }));
}

/**
 * Removes a media attachment and deletes the underlying record.
 */
export async function deleteMediaAttachment(mediaId: string): Promise<void> {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { id: true, entityId: true },
  });

  if (!media) return;

  await prisma.$transaction(async (tx) => {
    // Delete entity record (cascades to Media & EntityMedia)
    await tx.entity.delete({
      where: { id: media.entityId },
    });
  });
}
