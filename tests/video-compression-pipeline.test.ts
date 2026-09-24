import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  evaluateSmartSkipping,
  calculateAverageBitrate,
  calculateTargetResolution,
  calculateDynamicVbrBitrate,
  optimizeCloudinaryVideoUrl,
  optimizeCloudinaryImageUrl,
  compressVideoIfNeeded,
  WHATSAPP_HD_DURATION_TO_SIZE_RATIO,
  TARGET_HD_BITRATE_BPS,
  AUDIO_BITRATE_BPS,
} from '../src/lib/video-compressor';
import {
  executeWithDoubleRetry,
  USER_FACING_UPLOAD_ERROR,
} from '../src/lib/media-upload-client';

describe('Video Compression & Resilient Upload Pipeline Test Suite', () => {

  // ===========================================================================
  // PHASE 1: SMART-SKIPPING ANALYTICS (PRE-COMPRESSION CHECK)
  // ===========================================================================
  describe('Phase 1: Smart-Skipping Analytics (WhatsApp HD 4:1 Ratio & Bitrate Satisfaction)', () => {
    it('calculates baseline average bitrate correctly from size and duration', () => {
      // 10 MB in 30 seconds -> (10 * 1024 * 1024 * 8) / 30 = ~2,796,203 bps (~2.8 Mbps)
      const sizeBytes = 10 * 1024 * 1024;
      const duration = 30;
      const bitrate = calculateAverageBitrate(sizeBytes, duration);
      assert.strictEqual(bitrate, Math.round((sizeBytes * 8) / duration));
      assert.ok(bitrate > 2_700_000 && bitrate < 2_900_000);
    });

    it('SKIPS compression if video size satisfies 4:1 ratio for 60s (<= 15MB)', () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: any[]) => logs.push(args.join(' '));

      try {
        const res = evaluateSmartSkipping({
          duration: 60,
          sizeBytes: 15 * 1024 * 1024, // 15MB for 60s (exact 4:1 ratio)
          width: 1920,
          height: 1080,
        });

        assert.strictEqual(res.shouldSkip, true);
        assert.ok(logs.some((msg) => msg.includes('Video already optimized. Skipping compression.')));
      } finally {
        console.log = originalLog;
      }
    });

    it('SKIPS compression if video size satisfies 4:1 ratio for 30s (<= 7.5MB)', () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: any[]) => logs.push(args.join(' '));

      try {
        const res = evaluateSmartSkipping({
          duration: 30,
          sizeBytes: Math.round(7.5 * 1024 * 1024), // 7.5MB for 30s (exact 4:1 ratio)
          width: 1920,
          height: 1080,
        });

        assert.strictEqual(res.shouldSkip, true);
        assert.ok(logs.some((msg) => msg.includes('Video already optimized. Skipping compression.')));
      } finally {
        console.log = originalLog;
      }
    });

    it('DOES NOT skip compression for a 30s video if size is 25MB (fails 4:1 ratio & high bitrate)', () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: any[]) => logs.push(args.join(' '));

      try {
        // 30s video with 25MB:
        // 4:1 max allowed size = 7.5MB
        // Bitrate = (25 * 1024 * 1024 * 8) / 30 = ~6.99 Mbps > 2.1 Mbps
        const res = evaluateSmartSkipping({
          duration: 30,
          sizeBytes: 25 * 1024 * 1024,
          width: 1920,
          height: 1080,
        });

        assert.strictEqual(res.shouldSkip, false);
        assert.strictEqual(logs.some((msg) => msg.includes('Video already optimized')), false);
      } finally {
        console.log = originalLog;
      }
    });

    it('SKIPS compression if overall video average bitrate is already same or down (<= 2.1 Mbps)', () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: any[]) => logs.push(args.join(' '));

      try {
        // Video is 120s long and 20MB:
        // Bitrate = (20 * 1024 * 1024 * 8) / 120 = 1,398,101 bps (~1.4 Mbps <= 2.1 Mbps)
        const res = evaluateSmartSkipping({
          duration: 120,
          sizeBytes: 20 * 1024 * 1024,
          width: 1280,
          height: 720,
        });

        assert.strictEqual(res.shouldSkip, true);
        assert.ok(res.averageBitrateBps <= TARGET_HD_BITRATE_BPS);
        assert.ok(logs.some((msg) => msg.includes('Video already optimized. Skipping compression.')));
      } finally {
        console.log = originalLog;
      }
    });

    it('DOES NOT skip compression if size > 4:1 limit AND bitrate > 2.1 Mbps', () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: any[]) => logs.push(args.join(' '));

      try {
        // 90s video, 60MB:
        // 4:1 allowed = 22.5MB
        // Bitrate = (60 * 1024 * 1024 * 8) / 90 = ~5.6 Mbps > 2.1 Mbps
        const res = evaluateSmartSkipping({
          duration: 90,
          sizeBytes: 60 * 1024 * 1024,
          width: 3840,
          height: 2160,
        });

        assert.strictEqual(res.shouldSkip, false);
        assert.strictEqual(logs.some((msg) => msg.includes('Video already optimized')), false);
      } finally {
        console.log = originalLog;
      }
    });
  });

  // ===========================================================================
  // PHASE 2: HIGH-EFFICIENCY COMPRESSION ENGINE (WHATSAPP HD STANDARDS)
  // ===========================================================================
  describe('Phase 2: WhatsApp Quality Clone Specifications (720p HD Standard)', () => {
    it('scales down 4K (3840x2160) to 720p (1280x720) ceiling maintaining 16:9 ratio', () => {
      const { targetW, targetH } = calculateTargetResolution(3840, 2160);
      assert.strictEqual(targetW, 1280);
      assert.strictEqual(targetH, 720);
      assert.strictEqual(targetW % 2, 0);
      assert.strictEqual(targetH % 2, 0);
    });

    it('scales down vertical 4K (2160x3840) to vertical 720p (720x1280)', () => {
      const { targetW, targetH } = calculateTargetResolution(2160, 3840);
      assert.strictEqual(targetW, 720);
      assert.strictEqual(targetH, 1280);
      assert.strictEqual(targetW % 2, 0);
      assert.strictEqual(targetH % 2, 0);
    });

    it('preserves dimensions for videos already below 720p ceiling (e.g. 480p)', () => {
      // 720p (1280x720)
      const res720 = calculateTargetResolution(1280, 720);
      assert.strictEqual(res720.targetW, 1280);
      assert.strictEqual(res720.targetH, 720);

      // 480p (854x480)
      const res480 = calculateTargetResolution(854, 480);
      assert.strictEqual(res480.targetW, 854);
      assert.strictEqual(res480.targetH, 480);
    });

    it('ensures odd dimensions are scaled to even integers for video encoding', () => {
      const res = calculateTargetResolution(1279, 719);
      assert.strictEqual(res.targetW % 2, 0);
      assert.strictEqual(res.targetH % 2, 0);
    });

    it('calculates Dynamic VBR bitrate targeting ~1.5 Mbps for 720p', () => {
      // 720p
      const bitrate720 = calculateDynamicVbrBitrate(1280, 720);
      assert.strictEqual(bitrate720, 1_500_000);

      // Sub-720p
      const bitrate480 = calculateDynamicVbrBitrate(854, 480);
      assert.strictEqual(bitrate480, 1_000_000);
    });

    it('enforces AAC-LC audio bitrate target of 96 kbps', () => {
      assert.strictEqual(AUDIO_BITRATE_BPS, 96_000);
    });
  });

  // ===========================================================================
  // PHASE 3: RESILIENT UPLOAD QUEUE & DOUBLE-RETRY POLICY
  // ===========================================================================
  describe('Phase 3: Resilient Upload Queue & Double-Retry Policy', () => {
    it('succeeds on first attempt without retrying when task succeeds', async () => {
      let attempts = 0;
      const result = await executeWithDoubleRetry(
        async (retryCount) => {
          attempts++;
          assert.strictEqual(retryCount, 0);
          return { uploaded: true };
        },
        { initialDelayMs: 10 }
      );

      assert.strictEqual(attempts, 1);
      assert.strictEqual(result.uploaded, true);
    });

    it('retries automatically on transient failure and succeeds on attempt 2 (retryCount = 1)', async () => {
      let attempts = 0;
      const retryDelays: number[] = [];

      const result = await executeWithDoubleRetry(
        async (retryCount) => {
          attempts++;
          if (attempts === 1) {
            throw new Error('Network droppage during chunk upload');
          }
          assert.strictEqual(retryCount, 1);
          return { success: true };
        },
        {
          initialDelayMs: 20,
          backoffFactor: 2,
          onRetry: (retryCount, delayMs) => {
            retryDelays.push(delayMs);
          },
        }
      );

      assert.strictEqual(attempts, 2);
      assert.strictEqual(retryDelays.length, 1);
      assert.strictEqual(retryDelays[0], 20); // 20 * 2^0
      assert.strictEqual(result.success, true);
    });

    it('applies Exponential Backoff delay on multiple retries (3s, 6s proportional)', async () => {
      let attempts = 0;
      const retryDelays: number[] = [];

      const result = await executeWithDoubleRetry(
        async (retryCount) => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Server 503 Service Unavailable');
          }
          assert.strictEqual(retryCount, 2);
          return { success: true, finalAttempt: attempts };
        },
        {
          initialDelayMs: 30, // Proportional to 3000ms
          backoffFactor: 2,
          onRetry: (retryCount, delayMs) => {
            retryDelays.push(delayMs);
          },
        }
      );

      assert.strictEqual(attempts, 3);
      assert.strictEqual(retryDelays.length, 2);
      assert.strictEqual(retryDelays[0], 30); // 1st retry: base delay
      assert.strictEqual(retryDelays[1], 60); // 2nd retry: 2x base delay (exponential)
      assert.strictEqual(result.success, true);
    });

    it('halts execution on 3rd failure (retryCount > 2), triggers cleanup, and bubbles up user-facing error message', async () => {
      let attempts = 0;
      let cleanupCalled = false;

      await assert.rejects(
        async () => {
          await executeWithDoubleRetry(
            async (retryCount) => {
              attempts++;
              throw new Error(`Upload error on attempt ${retryCount + 1}`);
            },
            {
              maxRetries: 2,
              initialDelayMs: 10,
              userFacingErrorMessage: USER_FACING_UPLOAD_ERROR,
              onCleanup: () => {
                cleanupCalled = true;
              },
            }
          );
        },
        (err: any) => {
          assert.strictEqual(err.message, USER_FACING_UPLOAD_ERROR);
          assert.strictEqual(err.retryCount, 3);
          return true;
        }
      );

      assert.strictEqual(attempts, 3); // 1 initial + 2 retries = 3 attempts
      assert.strictEqual(cleanupCalled, true);
    });

    it('handles Compression Exceptions (e.g. empty files) through the retry pipeline', async () => {
      let attempts = 0;

      const result = await executeWithDoubleRetry(
        async (retryCount) => {
          attempts++;
          if (attempts === 1) {
            throw new Error('Compression exception: Output file is empty (0 bytes)');
          }
          return { fileReady: true, size: 5000 };
        },
        {
          initialDelayMs: 10,
        }
      );

      assert.strictEqual(attempts, 2);
      assert.strictEqual(result.fileReady, true);
    });
  });

  // ===========================================================================
  // CLOUDINARY WHATSAPP HD CLOUD TRANSFORMATION & 100MB LIMIT TESTS
  // ===========================================================================
  describe('Cloudinary WhatsApp HD Cloud Transformation & 100MB Limit', () => {
    it('transforms raw Cloudinary video URL to 720p standard (720p, 1.5Mbps, H.264 MP4, AAC 96k)', () => {
      const rawUrl = 'https://res.cloudinary.com/test-cloud/video/upload/v1234567890/tv-tech-os/videos/sample.mov';
      const transformed = optimizeCloudinaryVideoUrl(rawUrl);

      assert.ok(transformed.includes('/video/upload/f_auto,q_auto:good,w_1280,h_1280,c_limit,vc_h264,br_1500k,ac_aac/'));
      assert.ok(transformed.endsWith('.mp4'));
      assert.ok(!transformed.endsWith('.mov'));
    });

    it('transforms iPhone .MOV to seekable .MP4 container in Cloudinary URL', () => {
      const iphoneMov = 'https://res.cloudinary.com/test-cloud/video/upload/v12345/tv-tech-os/videos/IMG_2576.MOV';
      const transformed = optimizeCloudinaryVideoUrl(iphoneMov);

      assert.ok(transformed.endsWith('.mp4'));
      assert.ok(transformed.includes('br_1500k'));
    });

    it('preserves non-cloudinary URLs without unwanted modifications', () => {
      const externalUrl = 'https://cdn.example.com/videos/stream.mp4';
      assert.strictEqual(optimizeCloudinaryVideoUrl(externalUrl), externalUrl);
    });

    it('transforms Cloudinary image URLs to WhatsApp HD (3840px 4K ceiling, q_auto:good, f_auto)', () => {
      const rawImageUrl = 'https://res.cloudinary.com/test-cloud/image/upload/v12345/tv-tech-os/images/photo.png';
      const transformed = optimizeCloudinaryImageUrl(rawImageUrl, 3840);

      assert.ok(transformed.includes('/image/upload/f_auto,q_auto:good,w_3840,h_3840,c_limit/'));
    });

    it('rejects videos larger than 100MB in compressVideoIfNeeded', async () => {
      const mockOversizedFile = {
        name: '4k_large_video.mp4',
        size: 105 * 1024 * 1024, // 105MB (> 100MB)
        type: 'video/mp4',
      } as unknown as File;

      const result = await compressVideoIfNeeded(mockOversizedFile);
      assert.ok(result.error);
      assert.ok(result.error.includes('100MB'));
    });

    it('allows videos <= 100MB and marks them for Cloudinary cloud transformation', async () => {
      const mockValidFile = {
        name: 'hd_video.mp4',
        size: 50 * 1024 * 1024, // 50MB (<= 100MB)
        type: 'video/mp4',
      } as unknown as File;

      const result = await compressVideoIfNeeded(mockValidFile);
      assert.strictEqual(result.error, undefined);
      assert.strictEqual(result.needsServerTranscode, true);
    });
  });
});
