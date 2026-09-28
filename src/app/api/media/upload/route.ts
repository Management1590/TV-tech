import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { cloudinary } from '@/lib/cloudinary';
import { createMediaAttachment } from '@/features/media/services/media.service';
import { MediaType, StorageProvider } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { detectMediaKind } from '@/lib/media-detect';
import {
  optimizeCloudinaryVideoUrl,
  optimizeCloudinaryImageUrl,
} from '@/lib/video-compressor';
import { promoteEagerWebmToMaster } from '@/lib/cloudinary-optimize-master';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max duration for uploads

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB strictly matching Cloudinary limit
const MAX_PHOTO_SIZE = 9 * 1024 * 1024;   // 9MB strict photo limit
const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100MB

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const entityId = formData.get('entityId') as string | null;
    const purpose = (formData.get('purpose') as string) || 'GALLERY';

    if (!file || !entityId) {
      return NextResponse.json({ success: false, error: 'Missing file or target entity ID.' }, { status: 400 });
    }

    // Detect media kind with full device/Samsung fallback
    const { mediaType: detectedType, resourceType, normalizedMime } = detectMediaKind(file.name, file.type);
    const size = file.size;

    let mediaType: MediaType = MediaType.IMAGE;
    if (detectedType === 'VIDEO') {
      if (size > MAX_VIDEO_SIZE) {
        return NextResponse.json({
          success: false,
          error: `Video size (${(size / 1024 / 1024).toFixed(1)} MB) exceeds Cloudinary's 100MB limit. Upload is disabled for videos over 100MB.`,
        }, { status: 400 });
      }
      mediaType = MediaType.VIDEO;
    } else if (detectedType === 'AUDIO') {
      if (size > MAX_AUDIO_SIZE) {
        return NextResponse.json({ success: false, error: 'Audio size exceeds maximum 100MB limit.' }, { status: 400 });
      }
      mediaType = MediaType.AUDIO;
    } else {
      if (size > MAX_PHOTO_SIZE) {
        return NextResponse.json({
          success: false,
          error: `Photo size (${(size / 1024 / 1024).toFixed(1)} MB) exceeds the 9MB limit. Upload is disabled for photos over 9MB.`,
        }, { status: 400 });
      }
      mediaType = MediaType.IMAGE;
    }

    // Convert file to Buffer for streaming upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Stream upload directly to Cloudinary with auto:eco compression settings
    const performUpload = async (useAsyncEager = false): Promise<any> => {
      return new Promise((resolve, reject) => {
        const uploadOptions: any = {
          folder: `tv-tech-os/${mediaType.toLowerCase()}s`,
          resource_type: resourceType,
          timeout: 300000, // 5 minutes timeout for large files
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
        }

        const uploadHandler = mediaType === MediaType.VIDEO
          ? cloudinary.uploader.upload_chunked_stream(uploadOptions, (error, result) => {
              if (error) {
                console.error('[CLOUDINARY_API_CHUNKED_ERROR]', error);
                reject(error);
              } else {
                resolve(result);
              }
            })
          : cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
              if (error) {
                console.error('[CLOUDINARY_API_UPLOAD_ERROR]', error);
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
        console.warn('[Server Upload Retry] Video exceeded synchronous limit, retrying with eager_async=true...');
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

    // Register in database with WhatsApp HD delivery URLs and 1:4 video skipping
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

    const media = await createMediaAttachment({
      entityId,
      mediaType,
      url: finalUrl,
      secureUrl: finalSecureUrl,
      publicId: uploadResult.public_id,
      provider: StorageProvider.CLOUDINARY,
      filename: finalFilename,
      mimeType: finalMime,
      sizeBytes: uploadResult.bytes || size,
      width: finalWidth || undefined,
      height: finalHeight || undefined,
      purpose,
      uploadedById: user.id,
    });

    if (mediaType === MediaType.VIDEO && size > 40 * 1024 * 1024) {
      promoteEagerWebmToMaster(uploadResult.public_id, media.id);
    }

    revalidatePath('/knowledge-base');
    revalidatePath('/inventory');

    return NextResponse.json({ success: true, media });
  } catch (error: any) {
    console.error('Media upload API error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to upload media.' }, { status: 500 });
  }
}
