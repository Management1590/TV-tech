/**
 * In-Browser Video Compression Utility
 * Intelligently compresses videos using WhatsApp HD quality standards:
 * - Phase 1: Smart-Skipping Analytics (4:1 duration-to-size satisfaction & bitrate check)
 * - Phase 2: High-Efficiency Compression Engine (H.264/AVC 1080p max ceiling, VBR ~2.0 Mbps, AAC-LC 96 kbps)
 * - Phase 3: Feeds into resilient upload pipeline with double-retry policy & Cloudinary WhatsApp HD transcoding
 *
 * CRITICAL RELIABILITY DIRECTIVE:
 * - In browser JavaScript, canvas.captureStream() + MediaRecorder is fundamentally flawed for video files
 *   (especially iPhone .MOV, HEVC, and HDR recordings): it drops variable frame rate timestamps, strips audio,
 *   crushes 10-bit HDR colors into 8-bit sRGB, and produces corrupt, unseekable containers (duration: Infinity).
 * - To guarantee ZERO corruption, 100% audio synchronization, proper HDR-to-SDR tone mapping, and valid moov atoms,
 *   uncompressed/high-bitrate videos are preserved in their pristine container and transformed via hardware-accelerated
 *   WhatsApp HD cloud transcoding (1080p ceiling, 2.0 Mbps bitrate, H.264 MP4 container, AAC audio).
 */

export interface VideoMetadata {
  duration: number; // in seconds
  width: number;
  height: number;
  sizeBytes: number;
  averageBitrateBps: number; // in bits per second
}

export interface SmartSkipResult {
  shouldSkip: boolean;
  reason?: string;
  duration: number;
  sizeBytes: number;
  averageBitrateBps: number;
  maxSatisfiedBytes?: number;
}

export interface CompressionResult {
  file: File;
  wasCompressed: boolean;
  originalSize: number;
  compressedSize: number;
  skipped?: boolean;
  skipReason?: string;
  needsServerTranscode?: boolean;
  error?: string;
}

export type VideoCompressProgressFn = (percentage: number, statusText: string) => void;

// Strict Pre-Upload Size Limits
export const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024; // 100MB Cloudinary limit
export const MAX_PHOTO_SIZE_BYTES = 9 * 1024 * 1024;   // 9MB Photo limit

// WhatsApp HD 1:4 Duration-to-Size Ratio Standards
// Specifically: 1 MB for every 4 seconds of video (1:4 ratio)
// i.e. 60 seconds video has 15MB, 30 seconds has 7.5MB, 4 seconds has 1MB
export const WHATSAPP_HD_DURATION_TO_SIZE_RATIO = 4; // seconds per 1 MB

// Target Bitrate for WhatsApp HD (1MB in 4s = 1 * 1024 * 1024 * 8 / 4 = 2,097,152 bps ≈ 2.1 Mbps)
export const TARGET_HD_BITRATE_BPS = 2_100_000; // ~2.1 Mbps (2100 kbps)
export const AUDIO_BITRATE_BPS = 96_000;         // 96 kbps AAC-LC

// Legacy/Backward-compatible constants
export const SKIP_DURATION_LIMIT_SECONDS = 60;
export const SKIP_FILE_SIZE_LIMIT_BYTES = 15 * 1024 * 1024; // 15MB
export const SKIP_BITRATE_CAP_BPS = TARGET_HD_BITRATE_BPS;
export const MIN_HD_VBR_BITRATE_BPS = 1_800_000; // 1.8 Mbps
export const MAX_HD_VBR_BITRATE_BPS = 2_200_000; // 2.2 Mbps

/**
 * Calculates baseline average bitrate in bits per second.
 */
export function calculateAverageBitrate(sizeBytes: number, durationSeconds: number): number {
  if (durationSeconds <= 0 || sizeBytes <= 0) return 0;
  return Math.round((sizeBytes * 8) / durationSeconds);
}

/**
 * Phase 1: Smart-Skipping Analytics (Pre-Compression Check)
 * WhatsApp HD Mode Satisfaction Criteria:
 * - Automatically SKIP COMPRESSION if the video already meets the specific bitrate/size ratio:
 *   1) Ratio is 1 MB for every 4 seconds of video (1:4) or tighter (e.g. 1:3, 1:2, or smaller file size relative to duration).
 *      i.e. sizeBytes <= (duration / 4) * 1024 * 1024
 *   2) OR average bitrate is already same or down (averageBitrate <= 2.1 Mbps)
 */
export function evaluateSmartSkipping(metadata: {
  duration: number;
  sizeBytes: number;
  width?: number;
  height?: number;
}): SmartSkipResult {
  const { duration, sizeBytes } = metadata;
  const averageBitrateBps = calculateAverageBitrate(sizeBytes, duration);

  // Calculate max allowed size for this duration based on 1:4 ratio (1 MB for every 4 seconds)
  const maxSatisfiedBytes =
    duration > 0
      ? (duration / WHATSAPP_HD_DURATION_TO_SIZE_RATIO) * 1024 * 1024
      : SKIP_FILE_SIZE_LIMIT_BYTES;

  // Criteria 1: Video average bitrate meets 1:4 benchmark (<= 2.1 Mbps)
  const isBitrateSatisfied =
    duration > 0 &&
    averageBitrateBps > 0 &&
    averageBitrateBps <= TARGET_HD_BITRATE_BPS;

  // Criteria 2: File size meets 1:4 ratio (e.g. 60s <= 15MB, 30s <= 7.5MB, 4s <= 1MB)
  const isSizeSatisfied = duration > 0 && sizeBytes <= maxSatisfiedBytes;

  if (isBitrateSatisfied || isSizeSatisfied) {
    const reason = isSizeSatisfied
      ? `File size meets 1:4 ratio (${(sizeBytes / (1024 * 1024)).toFixed(2)}MB <= ${(maxSatisfiedBytes / (1024 * 1024)).toFixed(2)}MB for ${duration.toFixed(1)}s)`
      : `Average bitrate meets 1:4 benchmark <= ${(TARGET_HD_BITRATE_BPS / 1_000_000).toFixed(1)} Mbps (${(averageBitrateBps / 1_000_000).toFixed(2)} Mbps)`;

    // ACTION: Log exact specified skip message
    console.log(`[Video Compressor] Video already optimized. Skipping compression. (${reason})`);

    return {
      shouldSkip: true,
      reason,
      duration,
      sizeBytes,
      averageBitrateBps,
      maxSatisfiedBytes,
    };
  }

  const reason = `Video exceeds 1:4 ratio (${(sizeBytes / (1024 * 1024)).toFixed(2)}MB > ${(maxSatisfiedBytes / (1024 * 1024)).toFixed(2)}MB for ${duration.toFixed(1)}s, ${(averageBitrateBps / 1_000_000).toFixed(2)} Mbps). Compression required.`;
  console.log(`[Video Compressor] ${reason}`);

  return {
    shouldSkip: false,
    reason,
    duration,
    sizeBytes,
    averageBitrateBps,
    maxSatisfiedBytes,
  };
}

/**
 * Calculates target resolution respecting WhatsApp HD 1080p ceiling:
 * - Max ceiling: 1080p (1920x1080 landscape, 1080x1920 portrait).
 * - If original video is lower than 1080p, preserve original dimensions.
 * - Always ensures even pixel dimensions for H.264 macroblock compatibility.
 */
export function calculateTargetResolution(
  originalW: number,
  originalH: number
): { targetW: number; targetH: number } {
  if (originalW <= 0 || originalH <= 0) {
    return { targetW: 1920, targetH: 1080 };
  }

  const isLandscape = originalW >= originalH;
  const MAX_W = isLandscape ? 1920 : 1080;
  const MAX_H = isLandscape ? 1080 : 1920;

  let targetW = originalW;
  let targetH = originalH;

  // Scale down only if original exceeds 1080p ceiling
  if (originalW > MAX_W || originalH > MAX_H) {
    const scale = Math.min(MAX_W / originalW, MAX_H / originalH);
    targetW = Math.round(originalW * scale);
    targetH = Math.round(originalH * scale);
  }

  // Ensure dimensions are even integers
  targetW = targetW - (targetW % 2);
  targetH = targetH - (targetH % 2);

  return {
    targetW: Math.max(2, targetW),
    targetH: Math.max(2, targetH),
  };
}

/**
 * Calculates Dynamic Variable Bitrate (VBR) target for WhatsApp HD (targeting ~2.0 Mbps, strictly clamped).
 */
export function calculateDynamicVbrBitrate(targetW: number, targetH: number): number {
  const totalPixels = targetW * targetH;

  let targetBitrate: number;
  // 1080p Full HD (~2,073,600 pixels): 2.1 Mbps (matches 4:1 WhatsApp HD standard)
  if (totalPixels >= 1920 * 1080 * 0.75) {
    targetBitrate = 2_100_000;
  }
  // 720p HD (~921,600 pixels): 1.8 Mbps
  else if (totalPixels >= 1280 * 720 * 0.75) {
    targetBitrate = 1_800_000;
  }
  // Lower resolutions: 1.5 Mbps baseline cap
  else {
    targetBitrate = 1_500_000;
  }

  return targetBitrate;
}

/**
 * Extracts local video metadata in browser environment.
 */
export async function extractVideoMetadata(file: File): Promise<VideoMetadata> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      duration: 0,
      width: 0,
      height: 0,
      sizeBytes: file.size,
      averageBitrateBps: 0,
    };
  }

  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.playsInline = true;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Failed to load video metadata or unsupported file format'));
      setTimeout(() => reject(new Error('Video metadata extraction timeout')), 8000);
      video.src = objectUrl;
    });

    const duration = video.duration || 0;
    const width = video.videoWidth || 0;
    const height = video.videoHeight || 0;
    const sizeBytes = file.size;
    const averageBitrateBps = calculateAverageBitrate(sizeBytes, duration);

    return {
      duration,
      width,
      height,
      sizeBytes,
      averageBitrateBps,
    };
  } catch (err) {
    // Graceful fallback for iPhone .MOV / QuickTime files where browser video element cannot decode locally
    return {
      duration: 0,
      width: 1920,
      height: 1080,
      sizeBytes: file.size,
      averageBitrateBps: 0,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export interface CloudinaryVideoOptimizeOptions {
  duration?: number;
  sizeBytes?: number;
  skipCompression?: boolean;
  maxWidth?: number; // default 1920
}

/**
 * Optimizes Cloudinary video delivery URLs with WhatsApp HD standards:
 * - Condition-based Skipping: If the video already meets the 1 MB for every 4 seconds (1:4)
 *   ratio or tighter, compression is automatically SKIPPED to preserve pristine quality.
 *   Non-standard formats (.mov, etc.) are delivered cleanly with f_auto without lossy recompression.
 * - When compressed: Applies optimal Cloudinary transformations:
 *   - Auto-quality: q_auto:good (high visual retention preset)
 *   - Auto-format: f_auto (delivers optimal container for iOS/Android/Desktop)
 *   - Responsive resizing: w_1920,c_limit (1080p ceiling, preserves aspect ratio, no upscaling)
 *   - Universal codec & bitrate: vc_h264,br_2000k (smooth 60fps cross-platform playback)
 *   - High-fidelity audio: ac_aac,ab_96k (96 kbps AAC)
 */
export function optimizeCloudinaryVideoUrl(
  url: string | null | undefined,
  options?: CloudinaryVideoOptimizeOptions
): string {
  if (!url || typeof url !== 'string') return '';
  if (!url.includes('res.cloudinary.com') || !url.includes('/video/upload/')) {
    return url;
  }
  if (url.includes('/q_auto') || url.includes('/vc_') || url.includes('/br_')) {
    return url;
  }

  // Evaluate condition-based skipping
  let shouldSkip = false;
  if (typeof options?.skipCompression === 'boolean') {
    shouldSkip = options.skipCompression;
  } else if (options?.duration && options?.sizeBytes) {
    const evaluation = evaluateSmartSkipping({
      duration: options.duration,
      sizeBytes: options.sizeBytes,
    });
    shouldSkip = evaluation.shouldSkip;
  }

  // 1. Condition-based Skipping: Video already meets 1:4 ratio (or explicitly skipped)
  if (shouldSkip) {
    // If container is an iPhone .mov or other non-standard container that won't stream on Android,
    // normalize format with f_auto without downscaling or bitrate crushing
    if (/\.(mov|mkv|avi|wmv|flv|3gp|m4v|webm)$/i.test(url)) {
      return url.replace('/video/upload/', '/video/upload/f_auto/').replace(/\.(mov|mkv|avi|wmv|flv|3gp|m4v|webm)$/i, '.mp4');
    }
    return url;
  }

  // 2. Transformation Settings (When compressed):
  const maxWidth = options?.maxWidth || 1920;
  let transformed = url.replace(
    '/video/upload/',
    `/video/upload/f_auto,q_auto:good,w_${maxWidth},c_limit,vc_h264,br_2000k,ac_aac,ab_96k/`
  );

  // For non-standard video formats (.mov, .mkv, .avi, etc.), ensure delivery as .mp4
  transformed = transformed.replace(/\.(mov|mkv|avi|wmv|flv|3gp|m4v|webm)$/i, '.mp4');

  return transformed;
}

/**
 * Optimizes Cloudinary image delivery URLs with WhatsApp HD standards:
 * - Dynamic format selection: f_auto (delivers WebP for Android/Chrome, AVIF/WebP, JPEG/PNG where needed)
 * - Smart compression: q_auto:good (high-retention preset, crisp details, low physical file footprint)
 * - Reasonable maximum dimension cap: max width/height of 2560 pixels with c_limit (never upscales)
 */
export function optimizeCloudinaryImageUrl(
  url: string | null | undefined,
  maxDimension: number = 2560
): string {
  if (!url || typeof url !== 'string') return '';
  if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) {
    return url;
  }
  if (url.includes('/q_auto') || url.includes('/w_2560') || url.includes('/w_1920')) {
    return url;
  }

  return url.replace(
    '/image/upload/',
    `/image/upload/f_auto,q_auto:good,w_${maxDimension},h_${maxDimension},c_limit/`
  );
}

/**
 * Processes video for Cloudinary WhatsApp HD pipeline:
 * - Rejects videos exceeding Cloudinary's 100MB limit.
 * - Evaluates 1:4 duration-to-size ratio and determines if cloud compression is needed.
 */
export async function compressVideoIfNeeded(
  file: File,
  onProgress?: VideoCompressProgressFn
): Promise<CompressionResult> {
  const originalSize = file.size;

  // Strict 100MB Cloudinary limit enforcement
  if (originalSize > MAX_VIDEO_SIZE_BYTES) {
    return {
      file,
      wasCompressed: false,
      originalSize,
      compressedSize: originalSize,
      error: `Video file size (${(originalSize / (1024 * 1024)).toFixed(1)}MB) exceeds maximum 100MB limit for Cloudinary uploads.`,
    };
  }

  onProgress?.(20, 'Analyzing video duration & bitrate...');

  try {
    const metadata = await extractVideoMetadata(file);
    const skipEvaluation = evaluateSmartSkipping({
      duration: metadata.duration,
      sizeBytes: originalSize,
    });

    if (skipEvaluation.shouldSkip) {
      onProgress?.(100, 'Video meets 1:4 ratio. Skipping compression.');
      return {
        file,
        wasCompressed: false,
        originalSize,
        compressedSize: originalSize,
        skipped: true,
        skipReason: skipEvaluation.reason,
        needsServerTranscode: false,
      };
    }

    onProgress?.(100, 'Cloudinary WhatsApp HD transformation configured');
    return {
      file,
      wasCompressed: false,
      originalSize,
      compressedSize: originalSize,
      skipped: false,
      needsServerTranscode: true,
    };
  } catch (err: any) {
    return {
      file,
      wasCompressed: false,
      originalSize,
      compressedSize: originalSize,
      skipped: false,
      needsServerTranscode: true,
    };
  }
}
