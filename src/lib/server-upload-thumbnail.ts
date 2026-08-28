import { cloudinary } from '@/lib/cloudinary';
import { parseThumbnailUrl, formatThumbnailUrl } from '@/lib/thumbnail-utils';

/**
 * Server-side helper to ensure any thumbnail URL (raw base64, data URL, or external URL)
 * is uploaded to Cloudinary CDN so we never store large base64 payloads in the database.
 */
export async function processAndUploadThumbnailUrl(
  rawThumbnailUrl: string | null | undefined,
  folder: string = 'tv-tech-os/thumbnails'
): Promise<string | null> {
  if (!rawThumbnailUrl || !rawThumbnailUrl.trim()) {
    return null;
  }

  const parsed = parseThumbnailUrl(rawThumbnailUrl.trim());
  if (!parsed.url) {
    return null;
  }

  // If already a hosted Cloudinary/Supabase/HTTP URL, preserve it
  if (!parsed.url.startsWith('data:image/')) {
    return formatThumbnailUrl(parsed.url, parsed.x, parsed.y, parsed.scale);
  }

  // If it is a base64 data URL, upload to Cloudinary
  try {
    const uploadResult = await cloudinary.uploader.upload(parsed.url, {
      folder,
      resource_type: 'image',
      timeout: 60000,
    });

    const secureUrl = uploadResult.secure_url || uploadResult.url;
    return formatThumbnailUrl(secureUrl, parsed.x, parsed.y, parsed.scale);
  } catch (error) {
    console.error('Failed to upload thumbnail base64 to Cloudinary:', error);
    // If Cloudinary fails, return null or clean fallback instead of crashing with base64
    return null;
  }
}
