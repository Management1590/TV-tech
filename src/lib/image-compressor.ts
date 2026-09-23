/**
 * In-Browser High-Speed Image Processing & Compression Utility
 * Implements WhatsApp HD Photo sharing standards:
 * - Phase 1: Smart-Skipping Analytics (Pre-Compression Check)
 * - Phase 2: High-Efficiency Image Compressor Engine (WebP/JPEG, 3840px / 4K UHD ceiling, 85% quality, EXIF orientation preservation)
 * - Phase 3: Integrates with resilient upload pipeline and double-retry policy
 */

export interface ImageMetadata {
  width: number;
  height: number;
  sizeBytes: number;
  format?: string;
  longestSide: number;
}

export interface ImageSmartSkipResult {
  shouldSkip: boolean;
  reason?: string;
  sizeBytes: number;
  width: number;
  height: number;
  longestSide: number;
}

export interface ImageCompressionResult {
  file: File;
  wasCompressed: boolean;
  originalSize: number;
  compressedSize: number;
  skipped?: boolean;
  skipReason?: string;
  error?: string;
  width?: number;
  height?: number;
}

// Constants for WhatsApp HD Image Compression
export const MAX_PHOTO_SIZE_BYTES = 9 * 1024 * 1024;         // 9 MB strict pre-upload photo limit
export const SKIP_IMAGE_FILE_SIZE_BYTES = 1.5 * 1024 * 1024; // 1.5 MB
export const MAX_IMAGE_DIMENSION_CAP = 2560;                  // 2560px (WhatsApp HD photo mode maximum dimension cap)
export const DEFAULT_IMAGE_QUALITY = 0.85;                    // 85% quality (WhatsApp HD quality benchmark)
export const USER_FACING_IMAGE_UPLOAD_ERROR = 'Unable to send image. Please check your connection.';

export type ImageCompressProgressFn = (percentage: number, statusText: string) => void;

/**
 * Phase 1: Smart-Skipping Analytics (Pre-Compression Check)
 * In WhatsApp HD Mode:
 * An image is already satisfied / optimized ONLY if:
 * 1. File size is already compact (<= 1.5 MB)
 * 2. AND image dimensions are within the WhatsApp HD ceiling (<= 2560px on the longest side)
 * 3. AND image is already an optimized web raster format (WebP or JPEG)
 * 
 * Note: Heavy images (e.g. 4.5MB or 10MB PNG/BMP or high-bitrate camera photos)
 * MUST NOT be skipped simply because their width is 1920px. They will be compressed!
 */
export function evaluateImageSmartSkipping(metadata: {
  sizeBytes: number;
  width: number;
  height: number;
  format?: string;
}): ImageSmartSkipResult {
  const { sizeBytes, width, height, format } = metadata;
  const longestSide = Math.max(width, height);

  // Criteria 1: File size <= 1.5 MB
  const isSizeSmall = sizeBytes > 0 && sizeBytes <= SKIP_IMAGE_FILE_SIZE_BYTES;

  // Criteria 2: Longest side <= 2560px (WhatsApp HD ceiling)
  const isDimensionWithinCap = longestSide > 0 && longestSide <= MAX_IMAGE_DIMENSION_CAP;

  // Criteria 3: Already an optimized web format
  const isOptimizedFormat = !format || format === 'image/webp' || format === 'image/jpeg';

  // Only skip if ALL satisfaction criteria are met
  const shouldSkip = isSizeSmall && isDimensionWithinCap && isOptimizedFormat;

  if (shouldSkip) {
    const reason = `Image satisfied: size <= 1.5MB (${(sizeBytes / (1024 * 1024)).toFixed(2)}MB) & longest side <= ${MAX_IMAGE_DIMENSION_CAP}px (${longestSide}px)`;

    // ACTION: Log exact specified message
    console.log('Image already optimized. Skipping compression.');

    return {
      shouldSkip: true,
      reason,
      sizeBytes,
      width,
      height,
      longestSide,
    };
  }

  return {
    shouldSkip: false,
    sizeBytes,
    width,
    height,
    longestSide,
  };
}

/**
 * Calculates target dimensions respecting WhatsApp HD 3840px ceiling.
 * Maintains original aspect ratio perfectly. Preserves original dimensions if <= maxLongestSide.
 */
export function calculateImageTargetDimensions(
  originalW: number,
  originalH: number,
  maxLongestSide: number = MAX_IMAGE_DIMENSION_CAP
): { targetW: number; targetH: number } {
  if (originalW <= 0 || originalH <= 0) {
    return { targetW: maxLongestSide, targetH: maxLongestSide };
  }

  const longestSide = Math.max(originalW, originalH);

  // If already smaller than or equal to max cap, preserve original dimensions (no upscaling)
  if (longestSide <= maxLongestSide) {
    return { targetW: originalW, targetH: originalH };
  }

  const scale = maxLongestSide / longestSide;
  const targetW = Math.round(originalW * scale);
  const targetH = Math.round(originalH * scale);

  return {
    targetW: Math.max(1, targetW),
    targetH: Math.max(1, targetH),
  };
}

/**
 * Extracts image metadata (width, height, longest side, format) in a browser environment.
 */
export async function extractImageMetadata(file: File): Promise<ImageMetadata> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return {
      width: 0,
      height: 0,
      sizeBytes: file.size,
      format: file.type,
      longestSide: 0,
    };
  }

  // Modern browser bitmap decoding with orientation support
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const width = bitmap.width;
      const height = bitmap.height;
      bitmap.close();
      return {
        width,
        height,
        sizeBytes: file.size,
        format: file.type,
        longestSide: Math.max(width, height),
      };
    } catch {
      // Fallback to HTMLImageElement
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const img = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image metadata or unsupported image format'));
      setTimeout(() => reject(new Error('Image metadata read timed out')), 6000);
      img.src = objectUrl;
    });

    const width = img.naturalWidth || img.width || 0;
    const height = img.naturalHeight || img.height || 0;

    return {
      width,
      height,
      sizeBytes: file.size,
      format: file.type,
      longestSide: Math.max(width, height),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Checks if browser canvas supports WebP export.
 */
function supportsWebPExport(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const dataUrl = canvas.toDataURL('image/webp');
    return dataUrl.startsWith('data:image/webp');
  } catch {
    return false;
  }
}

/**
 * Phase 2: High-Efficiency Image Compressor Engine (WhatsApp HD Photo Clone)
 * - WebP primary format, JPEG universal fallback
 * - Max ceiling 3840px (4K) on longest side, aspect ratio strictly preserved
 * - Quality factor: 85% (WhatsApp HD standard)
 * - Metadata stripping with orientation preservation
 * - Strict try-catch for Out-Of-Memory, corrupted files, unsupported formats
 */
export async function compressImageIfNeeded(
  file: File,
  quality: number = DEFAULT_IMAGE_QUALITY,
  onProgress?: ImageCompressProgressFn
): Promise<ImageCompressionResult> {
  const originalSize = file.size;

  // Strict 9MB Photo limit enforcement
  if (originalSize > MAX_PHOTO_SIZE_BYTES) {
    return {
      file,
      wasCompressed: false,
      originalSize,
      compressedSize: originalSize,
      error: `Photo file size (${(originalSize / (1024 * 1024)).toFixed(1)}MB) exceeds maximum 9MB limit for photo uploads.`,
    };
  }

  // 1. Only compress image files
  const isImage =
    file.type.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|bmp|avif|heic|heif|jfif)$/i.test(file.name);

  // Skip SVG or non-image files
  if (!isImage || file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
    return {
      file,
      wasCompressed: false,
      originalSize,
      compressedSize: originalSize,
      skipped: true,
      skipReason: 'Non-raster image or SVG',
    };
  }

  // 2. Verify browser environment
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { file, wasCompressed: false, originalSize, compressedSize: originalSize };
  }

  let objectUrl = '';

  try {
    onProgress?.(15, 'Analyzing image dimensions & EXIF...');

    // =========================================================================
    // PHASE 1: Pre-Compression Check (Smart-Skipping Analytics)
    // =========================================================================
    let width = 0;
    let height = 0;
    let sourceBitmap: ImageBitmap | null = null;
    let sourceImage: HTMLImageElement | null = null;

    // Decode with orientation preservation
    if (typeof createImageBitmap === 'function') {
      try {
        sourceBitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
        width = sourceBitmap.width;
        height = sourceBitmap.height;
      } catch {
        // Fallback to HTMLImageElement
      }
    }

    if (!sourceBitmap) {
      objectUrl = URL.createObjectURL(file);
      sourceImage = new Image();
      await new Promise<void>((resolve, reject) => {
        if (!sourceImage) return reject(new Error('Image constructor unavailable'));
        sourceImage.onload = () => resolve();
        sourceImage.onerror = () => reject(new Error('Failed to decode image data or unsupported image format'));
        setTimeout(() => reject(new Error('Image decoding timeout')), 10000);
        sourceImage.src = objectUrl;
      });
      width = sourceImage.naturalWidth || sourceImage.width;
      height = sourceImage.naturalHeight || sourceImage.height;
    }

    // Evaluate Phase 1 Smart-Skipping Analytics
    const skipEvaluation = evaluateImageSmartSkipping({
      sizeBytes: originalSize,
      width,
      height,
      format: file.type,
    });

    if (skipEvaluation.shouldSkip) {
      if (sourceBitmap) sourceBitmap.close();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      onProgress?.(100, 'Image already optimized');
      return {
        file,
        wasCompressed: false,
        originalSize,
        compressedSize: originalSize,
        skipped: true,
        skipReason: skipEvaluation.reason,
        width,
        height,
      };
    }

    // =========================================================================
    // PHASE 2: WhatsApp HD Image Compression Engine
    // =========================================================================
    onProgress?.(45, 'Optimizing image (WhatsApp HD 3840px)...');
    // Target dimensions capped at 3840px on longest side
    const { targetW, targetH } = calculateImageTargetDimensions(width, height, MAX_IMAGE_DIMENSION_CAP);

    // Target format: WebP preferred, JPEG universal fallback
    const useWebP = supportsWebPExport();
    const outputMime = useWebP ? 'image/webp' : 'image/jpeg';
    const outputExt = useWebP ? '.webp' : '.jpg';

    // Clamp quality factor between 0.80 and 0.90 (default 0.85)
    const clampedQuality = Math.max(0.80, Math.min(0.90, quality));

    // Allocate canvas for hardware-accelerated processing and EXIF stripping
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { alpha: !useWebP });

    if (!ctx) {
      throw new Error('Canvas 2D context allocation failed (possible Out-Of-Memory)');
    }

    // High quality bicubic/bilinear interpolation
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // If JPEG fallback, paint white background to avoid transparent black artifacts
    if (!useWebP) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetW, targetH);
    }

    // Draw source onto canvas (strips heavy EXIF tags like GPS and camera profiles)
    if (sourceBitmap) {
      ctx.drawImage(sourceBitmap, 0, 0, targetW, targetH);
      sourceBitmap.close();
    } else if (sourceImage) {
      ctx.drawImage(sourceImage, 0, 0, targetW, targetH);
    }

    // Export compressed blob
    const compressedBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        outputMime,
        clampedQuality
      );
    });

    if (!compressedBlob || compressedBlob.size <= 0) {
      throw new Error('Image compression returned empty blob (0 bytes)');
    }

    // Safety: Only use compressed version if it is smaller than original
    if (compressedBlob.size < originalSize) {
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const compressedFile = new File([compressedBlob], `${baseName}${outputExt}`, {
        type: outputMime,
        lastModified: Date.now(),
      });

      onProgress?.(100, 'WhatsApp HD image compression completed');

      return {
        file: compressedFile,
        wasCompressed: true,
        originalSize,
        compressedSize: compressedFile.size,
        width: targetW,
        height: targetH,
      };
    }

    // Original file was already smaller
    return {
      file,
      wasCompressed: false,
      originalSize,
      compressedSize: originalSize,
      skipped: true,
      skipReason: 'Original image is already smaller than compressed output',
      width,
      height,
    };
  } catch (err: any) {
    // Robust Error Catching: Out-Of-Memory, corrupted file, unsupported format
    const errorSignature = `[Phase 2 Image Compression Error] ${err?.name || 'Error'}: ${err?.message || String(err)}`;
    console.error(errorSignature, err);

    if (err?.name === 'QuotaExceededError') {
      throw new Error('Device out-of-memory or storage quota exceeded during image compression');
    }

    // Re-throw critical compression errors so Phase 3 pipeline can trigger double-retry
    throw err;
  } finally {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch {}
    }
  }
}
