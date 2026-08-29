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
import { detectMediaKind } from '@/lib/media-detect';

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

    const { mediaType: detectedType, resourceType, normalizedMime } = detectMediaKind(file.name, file.type);
    const size = file.size;

    let mediaType: MediaType = MediaType.IMAGE;
    if (detectedType === 'VIDEO') {
      if (size > MAX_VIDEO_SIZE) return { success: false, error: 'Video size exceeds maximum 500MB limit.' };
      mediaType = MediaType.VIDEO;
    } else if (detectedType === 'AUDIO') {
      if (size > MAX_AUDIO_SIZE) return { success: false, error: 'Audio size exceeds maximum 100MB limit.' };
      mediaType = MediaType.AUDIO;
    } else {
      mediaType = MediaType.IMAGE;
    }

    // Convert file to Buffer for streaming upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Stream directly to Cloudinary
    const uploadResult: any = await new Promise((resolve, reject) => {
      const uploadOptions: any = {
        folder: `tv-tech-os/${mediaType.toLowerCase()}s`,
        resource_type: resourceType,
        timeout: 300000, // 5 minutes timeout for large video files
      };

      if (mediaType === MediaType.AUDIO) {
        uploadOptions.format = 'mp3';
      } else if (mediaType === MediaType.VIDEO) {
        uploadOptions.chunk_size = 20 * 1024 * 1024; // 20MB chunks
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('[CLOUDINARY_ACTION_UPLOAD_ERROR]', error);
            reject(error);
          } else {
            resolve(result);
          }
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
      mimeType: normalizedMime,
      sizeBytes: size,
      width: uploadResult.width || undefined,
      height: uploadResult.height || undefined,
      purpose,
      uploadedById: user.id,
    });

    // Revalidate paths
    revalidatePath('/inventory');
    revalidatePath('/knowledge-base');
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
