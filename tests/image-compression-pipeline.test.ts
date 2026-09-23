import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  evaluateImageSmartSkipping,
  calculateImageTargetDimensions,
  SKIP_IMAGE_FILE_SIZE_BYTES,
  MAX_IMAGE_DIMENSION_CAP,
  DEFAULT_IMAGE_QUALITY,
  USER_FACING_IMAGE_UPLOAD_ERROR,
} from '../src/lib/image-compressor';
import { executeWithDoubleRetry } from '../src/lib/media-upload-client';

describe('High-Speed Image Processing & Resilient Upload Pipeline Test Suite', () => {

  // ===========================================================================
  // PHASE 1: SMART-SKIPPING ANALYTICS (PRE-COMPRESSION CHECK)
  // ===========================================================================
  describe('Phase 1: Smart-Skipping Analytics (WhatsApp HD Image Satisfaction)', () => {
    it('SKIPS compression if file size is <= 1.5 MB and dimensions <= 3840px', () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: any[]) => logs.push(args.join(' '));

      try {
        // 1.2 MB file, 3000x2000 dimensions (<= 3840px ceiling)
        const sizeBytes = Math.round(1.2 * 1024 * 1024);
        const res = evaluateImageSmartSkipping({
          sizeBytes,
          width: 3000,
          height: 2000,
          format: 'image/jpeg',
        });

        assert.strictEqual(res.shouldSkip, true);
        assert.ok(res.sizeBytes <= SKIP_IMAGE_FILE_SIZE_BYTES);
        assert.ok(logs.some((msg) => msg.includes('Image already optimized. Skipping compression.')));
      } finally {
        console.log = originalLog;
      }
    });

    it('DOES NOT skip compression for a large 4.5MB image even if dimensions are 1920x1080', () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: any[]) => logs.push(args.join(' '));

      try {
        // Large raw image: 4.5 MB with 1920x1080 dimensions
        const sizeBytes = Math.round(4.5 * 1024 * 1024);
        const res = evaluateImageSmartSkipping({
          sizeBytes,
          width: 1920,
          height: 1080,
          format: 'image/png',
        });

        // Must NOT skip just because width is 1920px! Large size requires compression
        assert.strictEqual(res.shouldSkip, false);
        assert.strictEqual(res.longestSide, 1920);
        assert.strictEqual(logs.length, 0); // No skip message logged
      } finally {
        console.log = originalLog;
      }
    });

    it('DOES NOT skip compression if file size >= 1.5 MB AND longest side >= 3840px', () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: any[]) => logs.push(args.join(' '));

      try {
        // 5.8 MB photo from high-res phone camera: 4032x3024
        const sizeBytes = Math.round(5.8 * 1024 * 1024);
        const res = evaluateImageSmartSkipping({
          sizeBytes,
          width: 4032,
          height: 3024,
        });

        assert.strictEqual(res.shouldSkip, false);
        assert.strictEqual(res.longestSide, 4032);
        assert.strictEqual(logs.length, 0); // No skip message logged
      } finally {
        console.log = originalLog;
      }
    });
  });

  // ===========================================================================
  // PHASE 2: HIGH-EFFICIENCY IMAGE COMPRESSOR ENGINE (WHATSAPP HD PHOTO CLONE)
  // ===========================================================================
  describe('Phase 2: WhatsApp HD Image Quality Specifications', () => {
    it('preserves 4K UHD dimensions (3840x2160) under WhatsApp HD ceiling without downscaling', () => {
      const { targetW, targetH } = calculateImageTargetDimensions(3840, 2160, 3840);
      assert.strictEqual(targetW, 3840);
      assert.strictEqual(targetH, 2160);
    });

    it('downscales ultra-high-res sensor images (8000x6000) so longest side is capped at 3840px', () => {
      const { targetW, targetH } = calculateImageTargetDimensions(8000, 6000, 3840);
      assert.strictEqual(targetW, 3840);
      assert.strictEqual(targetH, 2880); // 6000 * 3840 / 8000 = 2880
      assert.strictEqual(Math.round((targetW / targetH) * 100), Math.round((8000 / 6000) * 100));
    });

    it('downscales square high-res image (5000x5000) to 3840x3840', () => {
      const { targetW, targetH } = calculateImageTargetDimensions(5000, 5000, 3840);
      assert.strictEqual(targetW, 3840);
      assert.strictEqual(targetH, 3840);
    });

    it('DOES NOT upscale images that are already smaller than 3840px', () => {
      // 1200x800
      const res1 = calculateImageTargetDimensions(1200, 800, 3840);
      assert.strictEqual(res1.targetW, 1200);
      assert.strictEqual(res1.targetH, 800);

      // 1080x1920
      const res2 = calculateImageTargetDimensions(1080, 1920, 3840);
      assert.strictEqual(res2.targetW, 1080);
      assert.strictEqual(res2.targetH, 1920);
    });

    it('calibrates quality level to 85% (WhatsApp HD standard)', () => {
      assert.strictEqual(DEFAULT_IMAGE_QUALITY, 0.85);
    });
  });

  // ===========================================================================
  // PHASE 3: RESILIENT UPLOAD QUEUE & DOUBLE-RETRY POLICY FOR IMAGES
  // ===========================================================================
  describe('Phase 3: Resilient Upload Queue & Double-Retry Policy for Images', () => {
    it('succeeds on first attempt without retrying when image upload succeeds', async () => {
      let attempts = 0;
      const result = await executeWithDoubleRetry(
        async (retryCount) => {
          attempts++;
          assert.strictEqual(retryCount, 0);
          return { imageId: 'img_123', uploaded: true };
        },
        {
          initialDelayMs: 10,
          userFacingErrorMessage: USER_FACING_IMAGE_UPLOAD_ERROR,
        }
      );

      assert.strictEqual(attempts, 1);
      assert.strictEqual(result.uploaded, true);
    });

    it('applies 2-second stabilization delay (proportional) on upload drop and succeeds on attempt 2', async () => {
      let attempts = 0;
      const delays: number[] = [];

      const result = await executeWithDoubleRetry(
        async (retryCount) => {
          attempts++;
          if (attempts === 1) {
            throw new Error('Handshake timeout / TCP drop during photo upload');
          }
          assert.strictEqual(retryCount, 1);
          return { success: true };
        },
        {
          initialDelayMs: 20, // Proportional to 2000ms
          backoffFactor: 2,
          userFacingErrorMessage: USER_FACING_IMAGE_UPLOAD_ERROR,
          onRetry: (retryCount, delayMs) => {
            delays.push(delayMs);
          },
        }
      );

      assert.strictEqual(attempts, 2);
      assert.strictEqual(delays.length, 1);
      assert.strictEqual(delays[0], 20); // 20ms * 2^0
      assert.strictEqual(result.success, true);
    });

    it('applies Exponential Backoff on multiple retries (2s, 4s proportional)', async () => {
      let attempts = 0;
      const delays: number[] = [];

      const result = await executeWithDoubleRetry(
        async (retryCount) => {
          attempts++;
          if (attempts < 3) {
            throw new Error('HTTP 502 Bad Gateway');
          }
          assert.strictEqual(retryCount, 2);
          return { success: true, finalAttempt: attempts };
        },
        {
          initialDelayMs: 20, // Proportional to 2000ms
          backoffFactor: 2,
          userFacingErrorMessage: USER_FACING_IMAGE_UPLOAD_ERROR,
          onRetry: (retryCount, delayMs) => {
            delays.push(delayMs);
          },
        }
      );

      assert.strictEqual(attempts, 3);
      assert.strictEqual(delays.length, 2);
      assert.strictEqual(delays[0], 20); // 1st retry: 20ms
      assert.strictEqual(delays[1], 40); // 2nd retry: 40ms (2x base)
      assert.strictEqual(result.success, true);
    });

    it('halts on 3rd failure (retryCount > 2), triggers cache cleanup, and throws clean image error', async () => {
      let attempts = 0;
      let cleanedUp = false;

      await assert.rejects(
        async () => {
          await executeWithDoubleRetry(
            async (retryCount) => {
              attempts++;
              throw new Error(`Upload drop attempt ${retryCount + 1}`);
            },
            {
              maxRetries: 2,
              initialDelayMs: 10,
              userFacingErrorMessage: USER_FACING_IMAGE_UPLOAD_ERROR,
              onCleanup: () => {
                cleanedUp = true;
              },
            }
          );
        },
        (err: any) => {
          assert.strictEqual(err.message, 'Unable to send image. Please check your connection.');
          assert.strictEqual(err.retryCount, 3);
          return true;
        }
      );

      assert.strictEqual(attempts, 3); // 1 initial + 2 retries = 3 attempts
      assert.strictEqual(cleanedUp, true);
    });

    it('recovers from image processing exceptions (e.g. OOM or corrupt stream) via retry pipeline', async () => {
      let attempts = 0;
      let recovered = false;

      const result = await executeWithDoubleRetry(
        async (retryCount) => {
          attempts++;
          if (attempts === 1) {
            throw new Error('Image compression exception: Canvas 2D context allocation failed (OOM)');
          }
          recovered = true;
          return { recovered: true };
        },
        {
          initialDelayMs: 10,
          userFacingErrorMessage: USER_FACING_IMAGE_UPLOAD_ERROR,
        }
      );

      assert.strictEqual(attempts, 2);
      assert.strictEqual(recovered, true);
      assert.strictEqual(result.recovered, true);
    });
  });
});
