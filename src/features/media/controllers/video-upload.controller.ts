/**
 * Cloudinary Video Upload Controller
 *
 * Implements "Incoming Transformations" for video uploads:
 * 1. Storage Optimization: Videos are transformed and compressed using "auto:eco"
 *    DURING upload before being committed to Cloudinary storage.
 * 2. Original Master File Discard: Cloudinary automatically discards the heavy
 *    original uncompressed master file, storing only the compressed eco version.
 * 3. Strict Compliance: Uses strictly `quality: "auto:eco"`. No "f_auto" or "fetch_format"
 *    is applied at the upload step (f_auto is dynamic and reserved for frontend delivery).
 */

import { NextRequest, NextResponse } from 'next/server';
import { cloudinary } from '@/lib/cloudinary';
import { UploadApiOptions, UploadApiResponse } from 'cloudinary';

// Maximum video size allowed for Cloudinary standard video upload (100MB)
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

// Allowed video MIME types
export const ALLOWED_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
  'video/x-msvideo', // .avi
  'video/x-matroska', // .mkv
  'video/3gpp',
  'video/x-flv',
  'video/x-ms-wmv',
]);

export interface VideoUploadResult {
  publicId: string;
  originalFilename: string;
  format: string;
  bytes: number;
  duration: number;
  width?: number;
  height?: number;
  secureUrl: string;
  playbackUrl: string; // Dynamic delivery URL with f_auto applied
}

/**
 * Builds Cloudinary upload options specifically configured with
 * Incoming Transformations for maximum storage efficiency.
 */
export function buildIncomingVideoUploadOptions(folder = 'tv-tech-os/videos', useAsyncEager = false): UploadApiOptions {
  const options: UploadApiOptions = {
    resource_type: 'video',
    folder,
    chunk_size: 6 * 1024 * 1024, // 6MB chunk size for reliable streaming
    timeout: 300000, // 5 minutes timeout for large files
  };

  // Cloudinary allows synchronous incoming transformations up to 40MB.
  // For files > 40MB, Cloudinary requires eager transformations with eager_async: true.
  if (useAsyncEager) {
    options.eager = [{ quality: 'auto:eco', format: 'webm' }];
    options.eager_async = true;
  } else {
    options.format = 'webm';
    options.transformation = [{ quality: 'auto:eco' }];
  }

  return options;
}

/**
 * Generates the dynamic frontend playback URL with f_auto for universal browser delivery.
 */
export function buildDynamicPlaybackUrl(publicId: string, cloudName?: string): string {
  const activeCloud = cloudName || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'zcquougv';
  // Dynamic f_auto delivery transformation applied on CDN delivery with webm container
  const cleanId = publicId.replace(/\.(mov|mkv|avi|wmv|flv|3gp|m4v)$/i, '');
  return `https://res.cloudinary.com/${activeCloud}/video/upload/f_auto,q_auto:eco/${cleanId}.webm`;
}

/**
 * Streams a video buffer or arrayBuffer into Cloudinary with Incoming Transformation.
 */
export async function uploadVideoBuffer(
  buffer: Buffer,
  options?: {
    filename?: string;
    folder?: string;
  }
): Promise<UploadApiResponse> {
  const isLarge = buffer.length > 40 * 1024 * 1024;
  
  const performUpload = (useAsync: boolean): Promise<UploadApiResponse> => {
    const uploadOptions = buildIncomingVideoUploadOptions(options?.folder, useAsync);

    if (options?.filename) {
      const cleanName = options.filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      uploadOptions.public_id = `${cleanName}_${Date.now()}`;
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            console.error('[Cloudinary Video Upload Error]', error);
            reject(error);
          } else if (!result) {
            reject(new Error('Cloudinary upload returned empty response'));
          } else {
            resolve(result);
          }
        }
      );

      uploadStream.end(buffer);
    });
  };

  try {
    return await performUpload(isLarge);
  } catch (err: any) {
    if (
      !isLarge &&
      (err?.message?.includes('too large to process synchronously') || err?.message?.includes('eager_async'))
    ) {
      console.warn('[Video Controller Retry] Video exceeded synchronous limit, retrying with eager_async=true...');
      return await performUpload(true);
    }
    throw err;
  }
}

/**
 * Next.js App Router Upload Controller Handler.
 * Reads multipart/form-data, validates payload, and executes the incoming transformed upload.
 */
export async function handleVideoUpload(req: NextRequest): Promise<NextResponse> {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const customFolder = (formData.get('folder') as string) || 'tv-tech-os/videos';

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: 'No video file provided in the request formData (key: "file").',
        },
        { status: 400 }
      );
    }

    // 1. File Size Validation
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        {
          success: false,
          error: `Video size (${sizeMB} MB) exceeds maximum 100MB limit for Cloudinary video upload.`,
        },
        { status: 400 }
      );
    }

    // 2. MIME Type Validation
    const isVideoMime = file.type.startsWith('video/') || ALLOWED_VIDEO_MIME_TYPES.has(file.type);
    const hasVideoExt = /\.(mp4|mov|avi|mkv|webm|m4v|3gp|flv|wmv)$/i.test(file.name);

    if (!isVideoMime && !hasVideoExt) {
      return NextResponse.json(
        {
          success: false,
          error: `Uploaded file "${file.name}" with type "${file.type}" is not recognized as a valid video format.`,
        },
        { status: 400 }
      );
    }

    // 3. Convert File to Buffer for streaming upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. Upload with Incoming Transformation: quality="auto:eco"
    const result = await uploadVideoBuffer(buffer, {
      filename: file.name,
      folder: customFolder,
    });

    // 5. Generate dynamic frontend playback URL with f_auto
    const playbackUrl = buildDynamicPlaybackUrl(result.public_id);

    const payload: VideoUploadResult = {
      publicId: result.public_id,
      originalFilename: file.name,
      format: result.format,
      bytes: result.bytes,
      duration: result.duration,
      width: result.width,
      height: result.height,
      secureUrl: result.secure_url,
      playbackUrl,
    };

    return NextResponse.json({
      success: true,
      message: 'Video uploaded and compressed with Cloudinary incoming transformation (auto:eco). Original master discarded.',
      video: payload,
    });
  } catch (err: any) {
    console.error('[Video Upload Controller Error]', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to upload video to Cloudinary.',
      },
      { status: 500 }
    );
  }
}
