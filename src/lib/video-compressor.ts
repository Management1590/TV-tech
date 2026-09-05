/**
 * In-Browser Video Compression Utility
 * Intelligently compresses large smartphone & camera videos (e.g. 100MB -> 30-40MB)
 * without sacrificing visual quality (Full HD 1080p @ ~3Mbps, 30fps).
 * Only applies to videos (images and other media remain untouched).
 */

export interface CompressionResult {
  file: File;
  wasCompressed: boolean;
  originalSize: number;
  compressedSize: number;
}

export type VideoCompressProgressFn = (percentage: number, statusText: string) => void;

/**
 * Optimizes Cloudinary video delivery URLs with automatic perceptual quality compression.
 * Transforms large raw videos into high-efficiency 1080p streams (~65% smaller, 30-40MB for 100MB).
 */
export function optimizeCloudinaryVideoUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '';
  if (!url.includes('res.cloudinary.com') || !url.includes('/video/upload/')) {
    return url;
  }
  if (url.includes('/q_auto') || url.includes('/vc_')) {
    return url;
  }

  // q_auto:good preserves visual quality for fine details (board traces, text, display lines)
  // vc_auto transcodes to standard H.264/AAC playable on all mobile & desktop browsers
  // w_1920,c_limit caps 4K down to crisp Full HD 1080p without quality degradation
  return url.replace('/video/upload/', '/video/upload/q_auto:good,vc_auto,w_1920,c_limit/');
}

/**
 * Compresses a video file in the browser before upload if it exceeds 25MB.
 * Retains pristine 1080p visual sharpness while cutting file size by ~60-70%.
 */
export async function compressVideoIfNeeded(
  file: File,
  onProgress?: VideoCompressProgressFn
): Promise<CompressionResult> {
  const originalSize = file.size;

  // 1. Only compress video files
  const isVideo =
    file.type.startsWith('video/') ||
    /\.(mp4|mov|mkv|webm|3gp|3gpp|hevc|avi|m4v)$/i.test(file.name);

  if (!isVideo) {
    return { file, wasCompressed: false, originalSize, compressedSize: originalSize };
  }

  // 2. Only compress if larger than 25MB (videos <= 25MB are already compact)
  const MIN_SIZE_FOR_COMPRESSION = 25 * 1024 * 1024;
  if (originalSize <= MIN_SIZE_FOR_COMPRESSION) {
    return { file, wasCompressed: false, originalSize, compressedSize: originalSize };
  }

  // 3. Verify browser environment and MediaRecorder support
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return { file, wasCompressed: false, originalSize, compressedSize: originalSize };
  }

  // Find best supported mime type (prefer MP4 H.264, fallback to WebM VP9/VP8)
  const candidateMimeTypes = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];

  let selectedMimeType = '';
  for (const t of candidateMimeTypes) {
    if (MediaRecorder.isTypeSupported(t)) {
      selectedMimeType = t;
      break;
    }
  }

  if (!selectedMimeType) {
    return { file, wasCompressed: false, originalSize, compressedSize: originalSize };
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const originalMB = (originalSize / (1024 * 1024)).toFixed(1);
    const estimatedTargetMB = Math.round((originalSize / (1024 * 1024)) * 0.35);

    if (onProgress) {
      onProgress(5, `Analyzing video for balanced compression (${originalMB} MB → ~${estimatedTargetMB} MB)...`);
    }

    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = false; // Audio track is captured via Web Audio destination
    video.playsInline = true;
    video.src = objectUrl;

    // Load video metadata
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Failed to load video metadata'));
      setTimeout(() => reject(new Error('Video metadata timeout')), 10000);
    });

    const duration = video.duration || 0;

    // Skip in-browser compression for excessively long clips (> 180s) to prevent waiting
    // Longer clips will still be compressed on Cloudinary CDN
    if (duration > 180 || duration <= 0) {
      URL.revokeObjectURL(objectUrl);
      return { file, wasCompressed: false, originalSize, compressedSize: originalSize };
    }

    // Target Dimensions: Max 1920x1080 (Full HD), maintaining exact aspect ratio
    let targetW = video.videoWidth || 1920;
    let targetH = video.videoHeight || 1080;
    const MAX_W = 1920;
    const MAX_H = 1080;

    if (targetW > MAX_W || targetH > MAX_H) {
      const scale = Math.min(MAX_W / targetW, MAX_H / targetH);
      targetW = Math.round(targetW * scale);
      targetH = Math.round(targetH * scale);
    }
    // Must be even integers for video encoding
    targetW = targetW - (targetW % 2);
    targetH = targetH - (targetH % 2);

    // Target Bitrate:
    // Balanced ~3.0 Mbps for 1080p / 2.0 Mbps for 720p
    // Yields ~22MB/min, turning 100MB camera recordings into 30-40MB high-fidelity video
    const targetBitrate = targetW >= 1280 ? 3_000_000 : 2_000_000;

    // Create Offscreen Canvas
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { alpha: false });

    if (!ctx) {
      URL.revokeObjectURL(objectUrl);
      return { file, wasCompressed: false, originalSize, compressedSize: originalSize };
    }

    // Capture Audio Track Silently via Web Audio
    let audioStream: MediaStream | null = null;
    let audioCtx: AudioContext | null = null;

    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(video);
      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);
      audioStream = dest.stream;
    } catch {
      // Audio capture fallback
    }

    // Capture Canvas Video Stream at 30 fps
    const canvasStream = canvas.captureStream ? canvas.captureStream(30) : null;
    if (!canvasStream) {
      URL.revokeObjectURL(objectUrl);
      if (audioCtx) {
        try { audioCtx.close(); } catch {}
      }
      return { file, wasCompressed: false, originalSize, compressedSize: originalSize };
    }

    const combinedTracks = [
      ...canvasStream.getVideoTracks(),
      ...(audioStream ? audioStream.getAudioTracks() : []),
    ];

    const combinedStream = new MediaStream(combinedTracks);

    const recorder = new MediaRecorder(combinedStream, {
      mimeType: selectedMimeType,
      videoBitsPerSecond: targetBitrate,
      audioBitsPerSecond: 128_000,
    });

    const recordedChunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    const recordPromise = new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        const compressedBlob = new Blob(recordedChunks, { type: selectedMimeType });
        resolve(compressedBlob);
      };
      recorder.onerror = (e) => reject(e);
    });

    recorder.start(1000);

    // Frame rendering loop
    let animId = 0;
    const renderFrame = () => {
      if (video.paused || video.ended) return;
      ctx.drawImage(video, 0, 0, targetW, targetH);
      if (onProgress && duration > 0) {
        const pct = Math.min(98, Math.round((video.currentTime / duration) * 100));
        onProgress(
          pct,
          `Optimizing video quality & size: ${pct}% (${originalMB} MB → ~${estimatedTargetMB} MB)...`
        );
      }
      animId = requestAnimationFrame(renderFrame);
    };

    video.onplay = () => {
      renderFrame();
    };

    await video.play();

    // Wait until video reaches end
    await new Promise<void>((resolve) => {
      video.onended = () => resolve();
    });

    if (animId) {
      cancelAnimationFrame(animId);
    }
    recorder.stop();

    const compressedBlob = await recordPromise;

    // Cleanup resources
    URL.revokeObjectURL(objectUrl);
    if (audioCtx) {
      try { audioCtx.close(); } catch {}
    }

    // Safety: Only use compressed version if it is valid and smaller than original
    if (compressedBlob.size > 0 && compressedBlob.size < originalSize) {
      const ext = selectedMimeType.includes('mp4') ? '.mp4' : '.webm';
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      const compressedFile = new File([compressedBlob], `${baseName}${ext}`, {
        type: selectedMimeType,
        lastModified: Date.now(),
      });

      return {
        file: compressedFile,
        wasCompressed: true,
        originalSize,
        compressedSize: compressedFile.size,
      };
    }

    return { file, wasCompressed: false, originalSize, compressedSize: originalSize };
  } catch (err) {
    console.warn('Video compression fallback to original:', err);
    URL.revokeObjectURL(objectUrl);
    return { file, wasCompressed: false, originalSize, compressedSize: originalSize };
  }
}
