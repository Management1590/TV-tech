import { cloudinary } from './cloudinary';
import { prisma } from './prisma';

/**
 * For videos > 40MB where Cloudinary forbids synchronous incoming transformations,
 * this background worker polls for the eager WebM transcode and overwrites the heavy
 * original master file (e.g. 61.27MB MOV) with the compressed WebM (e.g. 9.41MB WebM),
 * permanently reclaiming Cloudinary storage quota and updating the database metadata.
 */
export function promoteEagerWebmToMaster(publicId: string, mediaId?: string): void {
  // Fire and forget in Node.js event loop
  setTimeout(async () => {
    try {
      let attempts = 0;
      const maxAttempts = 15; // 15 checks every 4s = 60s total max duration

      while (attempts < maxAttempts) {
        attempts++;
        await new Promise((resolve) => setTimeout(resolve, 4000));

        const details = await cloudinary.api.resource(publicId, { resource_type: 'video' }).catch(() => null);
        if (!details) continue;

        // If the master is already in WebM format and small, it's already replaced
        if (details.format === 'webm' && details.bytes < 40 * 1024 * 1024) {
          break;
        }

        // Find completed derived WebM asset
        const derivedWebm = details.derived?.find(
          (d: any) =>
            d.format === 'webm' ||
            d.url?.includes('f_webm') ||
            d.secure_url?.includes('.webm')
        );

        if (derivedWebm && (derivedWebm.secure_url || derivedWebm.url)) {
          const derivedUrl = derivedWebm.secure_url || derivedWebm.url;
          console.log(`[Cloudinary Optimizer] Overwriting master for ${publicId} with derived WebM (${derivedWebm.bytes} bytes)...`);

          // Overwrite the original master file in Cloudinary with the derived compressed WebM!
          const overwriteRes = await cloudinary.uploader.upload(derivedUrl, {
            resource_type: 'video',
            public_id: publicId,
            overwrite: true,
            invalidate: true,
          });

          // Update database record with new compressed size and webm URL
          if (overwriteRes && overwriteRes.bytes && mediaId) {
            await prisma.media.update({
              where: { id: mediaId },
              data: {
                sizeBytes: overwriteRes.bytes,
                mimeType: 'video/webm',
                url: overwriteRes.secure_url,
                secureUrl: overwriteRes.secure_url,
              },
            }).catch(() => {});
            console.log(`[Cloudinary Optimizer] Successfully updated database record ${mediaId} to ${overwriteRes.bytes} bytes`);
          }
          break;
        }
      }
    } catch (err: any) {
      console.warn('[Cloudinary Optimizer] Background master promotion skipped:', err?.message);
    }
  }, 1000);
}
