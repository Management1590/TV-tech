import { cloudinary } from './cloudinary';
import { prisma } from './prisma';

export interface PromotionResult {
  success: boolean;
  bytes?: number;
  format?: string;
  url?: string;
  secureUrl?: string;
  error?: string;
}

export interface PromotionCheckResult {
  success: boolean;
  status: 'completed' | 'processing' | 'error';
  bytes?: number;
  format?: string;
  url?: string;
  secureUrl?: string;
  error?: string;
  message?: string;
}

/**
 * Directly overwrites the Cloudinary master video asset with the compressed WebM version.
 * This completely deletes the original heavy master (e.g. 61.27MB MOV) from Cloudinary storage
 * and replaces it with the compressed WebM (e.g. 9.41MB WebM).
 */
export async function executeMasterPromotion(
  publicId: string,
  derivedUrl: string,
  mediaId?: string
): Promise<PromotionResult> {
  try {
    console.log(`[Cloudinary Master Overwrite] Overwriting ${publicId} with ${derivedUrl}...`);
    const overwriteRes = await cloudinary.uploader.upload(derivedUrl, {
      resource_type: 'video',
      public_id: publicId,
      overwrite: true,
      invalidate: true,
    });

    // Update database records by specific mediaId and/or publicId
    const dbUpdateData = {
      sizeBytes: overwriteRes.bytes,
      mimeType: 'video/webm',
      url: overwriteRes.secure_url,
      secureUrl: overwriteRes.secure_url,
    };

    if (mediaId) {
      await prisma.media.update({
        where: { id: mediaId },
        data: dbUpdateData,
      }).catch(() => {});
    }

    await prisma.media.updateMany({
      where: { publicId },
      data: dbUpdateData,
    }).catch(() => {});

    console.log(`[Cloudinary Master Overwrite] Successfully replaced master for ${publicId} (${overwriteRes.bytes} bytes, format: ${overwriteRes.format})`);

    return {
      success: true,
      bytes: overwriteRes.bytes,
      format: overwriteRes.format,
      url: overwriteRes.url,
      secureUrl: overwriteRes.secure_url,
    };
  } catch (error: any) {
    console.error(`[Cloudinary Master Overwrite Error] Failed for ${publicId}:`, error?.message);
    return {
      success: false,
      error: error?.message || 'Master overwrite failed',
    };
  }
}

/**
 * Fast, non-blocking check (~200ms) that inspects Cloudinary's eager transcode status.
 * If transcode has completed, it immediately executes master promotion.
 * If transcode is still encoding, it returns { status: 'processing' } immediately,
 * allowing client-driven polling without hitting serverless HTTP timeouts.
 */
export async function checkOrPromoteMaster(
  publicId: string,
  fallbackDerivedUrl?: string,
  mediaId?: string
): Promise<PromotionCheckResult> {
  try {
    const details = await cloudinary.api.resource(publicId, { resource_type: 'video' }).catch(() => null);
    if (!details) {
      return {
        success: false,
        status: 'error',
        error: `Cloudinary asset not found for publicId: ${publicId}`,
      };
    }

    // 1. If master is already WebM (< 40MB), it has already been promoted
    if (details.format === 'webm' && details.bytes < 40 * 1024 * 1024) {
      // Ensure database is in sync
      await prisma.media.updateMany({
        where: { publicId },
        data: {
          sizeBytes: details.bytes,
          mimeType: 'video/webm',
          url: details.secure_url || details.url,
          secureUrl: details.secure_url || details.url,
        },
      }).catch(() => {});

      return {
        success: true,
        status: 'completed',
        bytes: details.bytes,
        format: details.format,
        url: details.url,
        secureUrl: details.secure_url,
      };
    }

    // 2. Check derived eager assets for completed WebM transcode
    const foundDerived = details.derived?.find(
      (d: any) =>
        (d.format === 'webm' || d.url?.includes('f_webm') || d.secure_url?.includes('.webm')) &&
        Number(d.bytes) > 0
    );

    if (foundDerived && (foundDerived.secure_url || foundDerived.url || fallbackDerivedUrl)) {
      const derivedUrl = foundDerived.secure_url || foundDerived.url || fallbackDerivedUrl;
      const promo = await executeMasterPromotion(publicId, derivedUrl, mediaId);
      if (promo.success) {
        return {
          success: true,
          status: 'completed',
          bytes: promo.bytes,
          format: promo.format,
          url: promo.url,
          secureUrl: promo.secureUrl,
        };
      } else {
        return {
          success: false,
          status: 'error',
          error: promo.error,
        };
      }
    }

    // 3. Eager transcode is still in progress in Cloudinary
    return {
      success: true,
      status: 'processing',
      message: 'Cloudinary is transcoding video to WebM (auto:eco)...',
    };
  } catch (err: any) {
    return {
      success: false,
      status: 'error',
      error: err?.message || 'Check failed',
    };
  }
}

/**
 * Polls for the completed eager WebM asset and immediately executes the master overwrite.
 * Used during active in-flight upload processing so that serverless runtimes do not terminate early.
 */
export async function awaitAndPromoteMaster(
  publicId: string,
  targetDerivedUrl?: string,
  maxWaitMs = 60000,
  pollIntervalMs = 2500,
  mediaId?: string
): Promise<PromotionResult> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const check = await checkOrPromoteMaster(publicId, targetDerivedUrl, mediaId);
    if (check.status === 'completed') {
      return {
        success: true,
        bytes: check.bytes,
        format: check.format,
        url: check.url,
        secureUrl: check.secureUrl,
      };
    }
    if (check.status === 'error') {
      console.warn(`[Cloudinary Optimizer] Check error for ${publicId}:`, check.error);
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return {
    success: false,
    error: 'Timed out waiting for eager WebM transcoding',
  };
}

/**
 * Background fallback wrapper for non-blocking server scenarios.
 */
export function promoteEagerWebmToMaster(publicId: string, mediaId?: string): void {
  setTimeout(() => {
    awaitAndPromoteMaster(publicId, undefined, 60000, 3000, mediaId).catch(() => {});
  }, 1000);
}

/**
 * Retroactive sync tool: finds all database records where video > 40MB or not WebM,
 * checks Cloudinary for an available eager WebM transcode, and promotes it to master.
 */
export async function syncAllHeavyVideos(): Promise<{ checked: number; promoted: number; errors: string[] }> {
  const errors: string[] = [];
  let checked = 0;
  let promoted = 0;

  try {
    const heavyVideos = await prisma.media.findMany({
      where: {
        mediaType: 'VIDEO',
        OR: [
          { sizeBytes: { gt: 40 * 1024 * 1024 } },
          { mimeType: { not: 'video/webm' } },
        ],
      },
    });

    checked = heavyVideos.length;

    for (const vid of heavyVideos) {
      if (!vid.publicId) continue;
      try {
        const check = await checkOrPromoteMaster(vid.publicId, undefined, vid.id);
        if (check.status === 'completed') {
          promoted++;
        }
      } catch (e: any) {
        errors.push(`${vid.publicId}: ${e?.message}`);
      }
    }
  } catch (err: any) {
    errors.push(`Database query error: ${err?.message}`);
  }

  return { checked, promoted, errors };
}
