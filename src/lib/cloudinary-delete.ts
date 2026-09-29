import { cloudinary } from '@/lib/cloudinary';
import { prisma } from '@/lib/prisma';
import { MediaType } from '@prisma/client';

export interface CloudinaryAssetDetails {
  publicId: string;
  resourceType: 'image' | 'video' | 'raw';
}

/**
 * Extracts the publicId and resourceType from any Cloudinary URL or raw publicId.
 * Strips transformations, version tags (v123...), and pan/zoom hash coordinates.
 */
export function extractCloudinaryDetails(
  urlOrId: string | null | undefined,
  hintType?: 'image' | 'video' | 'raw' | string
): CloudinaryAssetDetails | null {
  if (!urlOrId || typeof urlOrId !== 'string') return null;

  // Strip hash fragment (#x=...&y=...&scale=...) and query parameters (?...)
  const clean = urlOrId.split('#')[0].split('?')[0].trim();
  if (!clean) return null;

  // If not a full Cloudinary URL, assume it's a raw publicId
  if (!clean.includes('res.cloudinary.com')) {
    const rawType = hintType === 'video' || hintType === 'raw' ? hintType : 'image';
    return {
      publicId: clean,
      resourceType: rawType as 'image' | 'video' | 'raw',
    };
  }

  // Regex matching: res.cloudinary.com/<cloud>/<resource_type>/upload/
  const typeMatch = clean.match(/res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\//i);
  if (!typeMatch) return null;
  const detectedType = typeMatch[1].toLowerCase() as 'image' | 'video' | 'raw';

  let afterUpload = clean.substring(clean.indexOf(typeMatch[0]) + typeMatch[0].length);

  // If version is present: v12345/...
  const versionMatch = afterUpload.match(/^(?:.*\/)?v\d+\/(.+)$/);
  let publicPath = versionMatch ? versionMatch[1] : afterUpload;

  // If no version segment, strip any leading transformation segments (e.g., f_auto,q_auto:eco/ or w_100/)
  if (!versionMatch) {
    while (/^[a-z]{1,4}_[^/]+\//i.test(publicPath)) {
      publicPath = publicPath.replace(/^[a-z]{1,4}_[^/]+\//i, '');
    }
  }

  // For images and videos, Cloudinary public_ids are stored without the file extension
  if (detectedType !== 'raw') {
    publicPath = publicPath.replace(/\.[a-zA-Z0-9]+$/, '');
  }

  return {
    publicId: publicPath,
    resourceType: (hintType as 'image' | 'video' | 'raw') || detectedType,
  };
}

/**
 * Destroys a single asset from Cloudinary by URL or publicId with automatic fallbacks:
 * 1. Purges CDN cache (invalidate: true)
 * 2. Tries with and without extension
 * 3. Tries alternate resource types (video <-> raw for audio/recordings, image <-> raw)
 */
export async function deleteFromCloudinary(
  urlOrPublicId: string | null | undefined,
  hintType?: 'image' | 'video' | 'raw' | string
): Promise<{ success: boolean; result?: string }> {
  if (!urlOrPublicId || !urlOrPublicId.trim()) {
    return { success: false, result: 'No URL or publicId provided' };
  }

  const details = extractCloudinaryDetails(urlOrPublicId, hintType);
  if (!details || !details.publicId) {
    return { success: false, result: 'Could not extract Cloudinary public ID' };
  }

  const { publicId, resourceType } = details;

  // Determine resource types to attempt
  const typesToTry: Array<'image' | 'video' | 'raw'> = [resourceType];
  if (resourceType === 'video') typesToTry.push('raw');
  else if (resourceType === 'raw') typesToTry.push('video');
  else if (resourceType === 'image') typesToTry.push('raw');

  // Variations: with and without extension
  const idWithoutExt = publicId.replace(/\.[a-zA-Z0-9]+$/, '');
  const idsToTry = [publicId];
  if (idWithoutExt !== publicId) {
    idsToTry.push(idWithoutExt);
  }

  for (const rType of typesToTry) {
    for (const pid of idsToTry) {
      try {
        const res = await cloudinary.uploader.destroy(pid, {
          resource_type: rType,
          invalidate: true,
        });

        if (res?.result === 'ok') {
          return { success: true, result: 'ok' };
        }
      } catch (err: any) {
        // Attempt next variation
      }
    }
  }

  return { success: false, result: 'not found or already deleted' };
}

/**
 * Deletes multiple Cloudinary assets in parallel.
 */
export async function deleteMultipleFromCloudinary(
  items: Array<{ publicId?: string | null; url?: string | null; resourceType?: string }>
): Promise<number> {
  if (!items || items.length === 0) return 0;

  const validItems = items.filter((i) => i.publicId || i.url);
  if (validItems.length === 0) return 0;

  let deletedCount = 0;
  const results = await Promise.allSettled(
    validItems.map((item) =>
      deleteFromCloudinary(item.publicId || item.url, item.resourceType)
    )
  );

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.success) {
      deletedCount++;
    }
  }

  return deletedCount;
}

/**
 * Helper to delete a thumbnail URL from Cloudinary if it is hosted on Cloudinary.
 */
export async function deleteThumbnailFromCloudinary(
  thumbnailUrl: string | null | undefined
): Promise<boolean> {
  if (!thumbnailUrl || !thumbnailUrl.trim()) return false;
  // If not Cloudinary, skip
  if (!thumbnailUrl.includes('res.cloudinary.com')) return false;

  const res = await deleteFromCloudinary(thumbnailUrl, 'image');
  return res.success;
}

/**
 * Completely removes a media record:
 * 1. Fetches the Media record from Prisma (getting publicId, url, secureUrl, mediaType, entityId)
 * 2. Deletes the asset from Cloudinary
 * 3. Deletes the Media's Entity in Prisma (cascading to Media & EntityMedia)
 */
export async function deleteMediaRecordWithCloudinary(
  mediaId: string,
  publicIdFallback?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const media = await prisma.media.findUnique({
      where: { id: mediaId },
      select: {
        id: true,
        entityId: true,
        publicId: true,
        url: true,
        secureUrl: true,
        mediaType: true,
      },
    });

    const targetPublicId = media?.publicId || publicIdFallback;
    const targetUrl = media?.secureUrl || media?.url;

    let resourceType: 'image' | 'video' | 'raw' = 'image';
    if (media?.mediaType === MediaType.VIDEO) resourceType = 'video';
    else if (media?.mediaType === MediaType.AUDIO) resourceType = 'video'; // Cloudinary treats audio as video
    else if (media?.mediaType === MediaType.PDF || (media?.mediaType as any) === 'DOCUMENT') resourceType = 'raw';

    // 1. Delete from Cloudinary
    if (targetPublicId || targetUrl) {
      await deleteFromCloudinary(targetPublicId || targetUrl, resourceType);
    }

    // 2. Delete database record if media exists
    if (media?.entityId) {
      await prisma.entity.delete({
        where: { id: media.entityId },
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error('[DELETE_MEDIA_ERROR]', error);
    return { success: false, error: error.message || 'Failed to delete media' };
  }
}

/**
 * Finds all Media records attached to an entityId and purges them from Cloudinary.
 * Used before deleting a Folder, Item, TV Model, or Knowledge Folder.
 */
export async function deleteEntityMediaAttachmentsFromCloudinary(
  entityId: string
): Promise<void> {
  try {
    // 1. Find all attachments in entity_media
    const entityMedia = await prisma.entityMedia.findMany({
      where: { entityId },
      include: {
        media: {
          select: {
            id: true,
            publicId: true,
            url: true,
            secureUrl: true,
            mediaType: true,
          },
        },
      },
    });

    // 2. Find direct media where media.entityId = entityId
    const directMedia = await prisma.media.findMany({
      where: { entityId },
      select: {
        id: true,
        publicId: true,
        url: true,
        secureUrl: true,
        mediaType: true,
      },
    });

    const allMedia = [...entityMedia.map((em) => em.media), ...directMedia];
    const uniqueMedia = Array.from(new Map(allMedia.map((m) => [m.id, m])).values());

    if (uniqueMedia.length > 0) {
      await Promise.allSettled(
        uniqueMedia.map((m) => {
          let resourceType: 'image' | 'video' | 'raw' = 'image';
          if (m.mediaType === MediaType.VIDEO || m.mediaType === MediaType.AUDIO) {
            resourceType = 'video';
          } else if (m.mediaType === MediaType.PDF || (m.mediaType as any) === 'DOCUMENT') {
            resourceType = 'raw';
          }
          return deleteFromCloudinary(m.publicId || m.secureUrl || m.url, resourceType);
        })
      );
    }
  } catch (err) {
    console.warn('[PURGE_ENTITY_MEDIA_WARN]', err);
  }
}
