'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { cloudinary } from '@/lib/cloudinary';
import { createMediaAttachment, deleteMediaAttachment } from '@/features/media/services/media.service';
import { deleteMediaRecordWithCloudinary, deleteFromCloudinary } from '@/lib/cloudinary-delete';
import { MediaType, StorageProvider } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface UploadMediaResult {
  success: boolean;
  error?: string;
  media?: any;
}

// Cloudinary maximum file size limit
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB Cloudinary limit
const MAX_PHOTO_SIZE = 9 * 1024 * 1024;   // 9MB strict photo limit
const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Uploads a media file (Image, Video, or Audio) to Cloudinary or Supabase,
 * registers it in the Entity Registry, and links it to the target entity.
 * Supports WhatsApp HD photo and video compression standards.
 */
import { detectMediaKind } from '@/lib/media-detect';
import {
  optimizeCloudinaryVideoUrl,
  optimizeCloudinaryImageUrl,
} from '@/lib/video-compressor';
import { awaitAndPromoteMaster } from '@/lib/cloudinary-optimize-master';

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
      if (size > MAX_VIDEO_SIZE) return { success: false, error: 'Video size exceeds Cloudinary 100MB limit. Upload is disabled for videos over 100MB.' };
      mediaType = MediaType.VIDEO;
    } else if (detectedType === 'AUDIO') {
      if (size > MAX_AUDIO_SIZE) return { success: false, error: 'Audio size exceeds maximum 100MB limit.' };
      mediaType = MediaType.AUDIO;
    } else {
      if (size > MAX_PHOTO_SIZE) return { success: false, error: 'Photo size exceeds 9MB limit. Upload is disabled for photos over 9MB.' };
      mediaType = MediaType.IMAGE;
    }

    // Convert file to Buffer for streaming upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Stream directly to Cloudinary
    const performUpload = async (useAsyncEager = false): Promise<any> => {
      return new Promise((resolve, reject) => {
        const uploadOptions: any = {
          folder: `tv-tech-os/${mediaType.toLowerCase()}s`,
          resource_type: resourceType,
          timeout: 300000, // 5 minutes timeout for large video files
        };

        if (mediaType === MediaType.AUDIO) {
          uploadOptions.format = 'mp3';
        } else if (mediaType === MediaType.VIDEO) {
          uploadOptions.chunk_size = 6 * 1024 * 1024;
          // Cloudinary synchronous video limit is 40MB. For larger videos, eager_async is required.
          if (useAsyncEager || size > 40 * 1024 * 1024) {
            uploadOptions.eager = [{ quality: 'auto:eco', format: 'webm' }];
            uploadOptions.eager_async = true;
          } else {
            uploadOptions.format = 'webm';
            uploadOptions.transformation = [{ quality: 'auto:eco' }];
          }
        } else if (mediaType === MediaType.IMAGE) {
          // Automatic good quality for images: incoming transformation with q_auto:good
          uploadOptions.transformation = [{ quality: 'auto:good' }];
        }

        const uploadHandler = mediaType === MediaType.VIDEO
          ? cloudinary.uploader.upload_chunked_stream(uploadOptions, (error, result) => {
              if (error) {
                console.error('[CLOUDINARY_ACTION_CHUNKED_ERROR]', error);
                reject(error);
              } else {
                resolve(result);
              }
            })
          : cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
              if (error) {
                console.error('[CLOUDINARY_ACTION_UPLOAD_ERROR]', error);
                reject(error);
              } else {
                resolve(result);
              }
            });

        uploadHandler.end(buffer);
      });
    };

    let uploadResult: any = null;
    try {
      uploadResult = await performUpload(false);
    } catch (err: any) {
      if (
        mediaType === MediaType.VIDEO &&
        (err?.message?.includes('too large to process synchronously') || err?.message?.includes('eager_async'))
      ) {
        console.warn('[Server Action Retry] Video exceeded synchronous limit, retrying with eager_async=true...');
        uploadResult = await performUpload(true);
      } else {
        throw err;
      }
    }

    // If purpose is PRIMARY, demote previous PRIMARY for this entity
    if (purpose === 'PRIMARY') {
      await prisma.entityMedia.updateMany({
        where: { entityId, purpose: 'PRIMARY' },
        data: { purpose: 'GALLERY' },
      });
    }

    const rawUrl = uploadResult.url || uploadResult.secure_url;
    const rawSecureUrl = uploadResult.secure_url || uploadResult.url;

    let finalUrl = rawUrl;
    let finalSecureUrl = rawSecureUrl;

    let finalWidth = uploadResult.width;
    let finalHeight = uploadResult.height;

    let finalMime = normalizedMime;
    let finalFilename = file.name;

    if (mediaType === MediaType.VIDEO) {
      const isWebm =
        uploadResult.format === 'webm' ||
        file.name.toLowerCase().endsWith('.mov') ||
        rawUrl?.includes('.webm') ||
        (uploadResult.eager && uploadResult.eager[0]?.secure_url?.includes('.webm'));

      if (isWebm) {
        finalMime = 'video/webm';
        finalFilename = finalFilename.replace(/\.(mov|mkv|avi|wmv|flv|3gp|m4v)$/i, '.webm');
      }

      const eagerWebmUrl = uploadResult.eager?.[0]?.secure_url;
      const sourceVideoUrl = eagerWebmUrl || rawUrl;
      finalUrl = optimizeCloudinaryVideoUrl(sourceVideoUrl);
      finalSecureUrl = optimizeCloudinaryVideoUrl(eagerWebmUrl || rawSecureUrl);
    } else if (mediaType === MediaType.IMAGE) {
      finalUrl = optimizeCloudinaryImageUrl(rawUrl, 2560);
      finalSecureUrl = optimizeCloudinaryImageUrl(rawSecureUrl, 2560);
    }

    // Register in database
    const media = await createMediaAttachment({
      entityId,
      mediaType,
      provider: StorageProvider.CLOUDINARY,
      publicId: uploadResult.public_id || `upload_${Date.now()}`,
      url: finalUrl,
      secureUrl: finalSecureUrl,
      filename: finalFilename,
      mimeType: finalMime,
      sizeBytes: uploadResult.bytes || size,
      width: finalWidth || undefined,
      height: finalHeight || undefined,
      purpose,
      uploadedById: user.id,
    });

    if (mediaType === MediaType.VIDEO && size > 40 * 1024 * 1024) {
      const eagerWebmUrl = uploadResult.eager?.[0]?.secure_url || uploadResult.eager?.[0]?.url;
      const promotion = await awaitAndPromoteMaster(uploadResult.public_id, eagerWebmUrl, 50000, 2500, media.id);
      if (promotion.success && promotion.bytes) {
        media.sizeBytes = promotion.bytes;
      }
    }

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
    const res = await deleteMediaRecordWithCloudinary(mediaId, publicId);
    if (!res.success && publicId) {
      await deleteFromCloudinary(publicId);
    }

    if (entityId) {
      revalidatePath(`/inventory/items/${entityId}`);
    }
    revalidatePath('/inventory');
    revalidatePath('/knowledge-base');

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
