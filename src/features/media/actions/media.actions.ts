'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { cloudinary } from '@/lib/cloudinary';
import { createMediaAttachment, deleteMediaAttachment } from '@/features/media/services/media.service';
import { MediaType, StorageProvider } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface UploadMediaResult {
  success: boolean;
  error?: string;
  media?: any;
}

// No artificial size limits for images
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Uploads a media file (Image, Video, or Audio) to Cloudinary or Supabase,
 * registers it in the Entity Registry, and links it to the target entity.
 * Supports unlimited image sizes and all common image formats.
 */
export async function uploadMediaAction(formData: FormData): Promise<UploadMediaResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized: Authentication required.' };
  }

  try {
    const file = formData.get('file') as File | null;
    const entityId = formData.get('entityId') as string | null;
    const purpose = (formData.get('purpose') as string) || 'GALLERY';

    if (!file || !entityId) {
      return { success: false, error: 'Missing file or target entity ID.' };
    }

    const mimeType = file.type.toLowerCase();
    const size = file.size;

    let mediaType: MediaType;
    let resourceType: 'image' | 'video' | 'raw' | 'auto' = 'image';

    if (mimeType.startsWith('image/')) {
      // No size limit on images as requested by user
      mediaType = MediaType.IMAGE;
      resourceType = 'image';
    } else if (mimeType.startsWith('video/')) {
      if (size > MAX_VIDEO_SIZE) return { success: false, error: 'Video size exceeds maximum 500MB limit.' };
      mediaType = MediaType.VIDEO;
      resourceType = 'video';
    } else if (mimeType.startsWith('audio/')) {
      if (size > MAX_AUDIO_SIZE) return { success: false, error: 'Audio size exceeds maximum 100MB limit.' };
      mediaType = MediaType.AUDIO;
      resourceType = 'video'; // Cloudinary processes audio under video resource_type
    } else {
      // Default to auto/image fallback
      mediaType = MediaType.IMAGE;
      resourceType = 'auto';
    }

    // Convert file to Buffer for streaming upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Stream directly to Cloudinary
    const uploadResult: any = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `tv-tech-os/${mediaType.toLowerCase()}s`,
          resource_type: resourceType,
          timeout: 300000, // 5 minutes timeout for large video files
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    // If purpose is PRIMARY, demote previous PRIMARY for this entity
    if (purpose === 'PRIMARY') {
      await prisma.entityMedia.updateMany({
        where: { entityId, purpose: 'PRIMARY' },
        data: { purpose: 'GALLERY' },
      });
    }

    // Register in database
    const media = await createMediaAttachment({
      entityId,
      mediaType,
      provider: StorageProvider.CLOUDINARY,
      publicId: uploadResult.public_id || `upload_${Date.now()}`,
      url: uploadResult.url || uploadResult.secure_url,
      secureUrl: uploadResult.secure_url || uploadResult.url,
      filename: file.name,
      mimeType,
      sizeBytes: size,
      width: uploadResult.width || undefined,
      height: uploadResult.height || undefined,
      purpose,
      uploadedById: user.id,
    });

    // Revalidate paths
    revalidatePath('/inventory');
    revalidatePath(`/inventory/items/${entityId}`);

    return { success: true, media };
  } catch (error: any) {
    console.error('Media upload error:', error);
    return { success: false, error: error.message || 'Media upload failed.' };
  }
}

/**
 * Deletes a media attachment from the database and Cloudinary.
 */
export async function deleteMediaAction(mediaId: string, publicId?: string, entityId?: string): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized: Authentication required.' };
  }

  try {
    await deleteMediaAttachment(mediaId);

    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (cloudErr) {
        console.warn('Cloudinary delete warning:', cloudErr);
      }
    }

    if (entityId) {
      revalidatePath(`/inventory/items/${entityId}`);
    }
    revalidatePath('/inventory');

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to delete media.' };
  }
}

/**
 * Sets a specific media item as the PRIMARY display image for an entity.
 */
export async function setPrimaryMediaAction(entityId: string, mediaId: string): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized: Authentication required.' };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Demote all media for entity
      await tx.entityMedia.updateMany({
        where: { entityId },
        data: { purpose: 'GALLERY', sortOrder: 1 },
      });

      // Promote selected media
      await tx.entityMedia.updateMany({
        where: { entityId, mediaId },
        data: { purpose: 'PRIMARY', sortOrder: 0 },
      });
    });

    revalidatePath(`/inventory/items/${entityId}`);
    revalidatePath('/inventory');
    revalidatePath('/inventory/folders');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to set primary image.' };
  }
}

/**
 * Persists the sort order of media attachments for an entity.
 */
export async function reorderMediaAction(
  entityId: string,
  orderedMediaIds: string[]
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Unauthorized: Authentication required.' };
  }

  try {
    await prisma.$transaction(
      orderedMediaIds.map((mediaId, idx) =>
        prisma.entityMedia.updateMany({
          where: { entityId, mediaId },
          data: { sortOrder: idx },
        })
      )
    );

    revalidatePath('/knowledge-base');
    revalidatePath('/inventory');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to reorder media.' };
  }
}
