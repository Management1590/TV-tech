/**
 * Universal Resilient Media Upload Client
 * Supports direct signed chunked uploads to Cloudinary CDN for all devices (Mobile iOS/Android & Desktop)
 * Solves mobile video timeouts, Cloudflare 100MB body limits, and 10% freeze errors.
 */

import { detectMediaKind } from './media-detect';
import { uploadMediaAction } from '@/features/media/actions/media.actions';

export type UploadProgressFn = (percentage: number, statusText: string) => void;

export interface UploadResult {
  success: boolean;
  media?: any;
  error?: string;
}

const CHUNK_SIZE = 6 * 1024 * 1024; // 6MB chunk size (Cloudinary requires chunks > 5MB)
const CHUNK_THRESHOLD = 20 * 1024 * 1024; // 20MB threshold for chunking

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface CloudinarySignResponse {
  success: boolean;
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  error?: string;
}

export type CloudinaryResourceType = 'video' | 'image' | 'raw' | 'auto';

/**
 * Requests a signed upload token from the server.
 */
async function getCloudinarySignature(resourceType: CloudinaryResourceType): Promise<CloudinarySignResponse> {
  const res = await fetch('/api/media/cloudinary-sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resourceType }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Signing failed (${res.status}): ${errText}`);
  }

  return await res.json();
}

/**
 * Uploads a single file (<= 20MB) directly to Cloudinary with real-time XHR progress.
 */
function uploadSingleDirect(
  file: File | Blob,
  signData: CloudinarySignResponse,
  resourceType: CloudinaryResourceType,
  onProgress?: (progress: number, loaded: number, total: number) => void
): Promise<any> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `https://api.cloudinary.com/v1_1/${signData.cloudName}/${resourceType}/upload`;

    xhr.open('POST', url, true);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          onProgress(pct, e.loaded, e.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data);
        } catch {
          reject(new Error('Invalid response from media cloud server'));
        }
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData?.error?.message || `Upload failed with status ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network connection error during cloud upload'));
    xhr.ontimeout = () => reject(new Error('Upload connection timed out'));
    xhr.timeout = 300000; // 5 minutes

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', signData.apiKey);
    formData.append('timestamp', signData.timestamp.toString());
    formData.append('signature', signData.signature);
    formData.append('folder', signData.folder);

    xhr.send(formData);
  });
}

/**
 * Uploads large files (> 20MB) in 6MB slices with auto-retry per chunk directly to Cloudinary CDN.
 */
async function uploadChunkedDirect(
  file: File,
  signData: CloudinarySignResponse,
  resourceType: CloudinaryResourceType,
  onProgress?: (progress: number, loaded: number, total: number) => void
): Promise<any> {
  const totalSize = file.size;
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
  const uniqueId = `chunked_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  let finalResponse: any = null;

  for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
    const start = chunkIdx * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalSize);
    const chunkBlob = file.slice(start, end);

    let retries = 3;
    let chunkSuccess = false;
    let lastError: any = null;

    while (retries > 0 && !chunkSuccess) {
      try {
        finalResponse = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const url = `https://api.cloudinary.com/v1_1/${signData.cloudName}/${resourceType}/upload`;

          xhr.open('POST', url, true);
          xhr.setRequestHeader('X-Unique-Upload-Id', uniqueId);
          xhr.setRequestHeader('Content-Range', `bytes ${start}-${end - 1}/${totalSize}`);

          if (xhr.upload && onProgress) {
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                const totalLoaded = start + e.loaded;
                const pct = Math.round((totalLoaded / totalSize) * 100);
                onProgress(pct, totalLoaded, totalSize);
              }
            };
          }

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                resolve(data);
              } catch {
                resolve({});
              }
            } else {
              try {
                const errData = JSON.parse(xhr.responseText);
                reject(new Error(errData?.error?.message || `Chunk error ${xhr.status}`));
              } catch {
                reject(new Error(`Chunk upload failed with HTTP ${xhr.status}`));
              }
            }
          };

          xhr.onerror = () => reject(new Error('Network connection error on video slice'));
          xhr.ontimeout = () => reject(new Error('Chunk upload timed out'));
          xhr.timeout = 180000; // 3 minutes per chunk

          const formData = new FormData();
          formData.append('file', chunkBlob, file.name);
          formData.append('api_key', signData.apiKey);
          formData.append('timestamp', signData.timestamp.toString());
          formData.append('signature', signData.signature);
          formData.append('folder', signData.folder);

          xhr.send(formData);
        });

        chunkSuccess = true;
      } catch (err: any) {
        lastError = err;
        retries--;
        if (retries > 0) {
          // Exponential backoff pause before retrying chunk
          await new Promise((r) => setTimeout(r, 1200));
        }
      }
    }

    if (!chunkSuccess) {
      throw lastError || new Error(`Failed to upload chunk ${chunkIdx + 1} of ${totalChunks}`);
    }
  }

  if (!finalResponse || (!finalResponse.public_id && !finalResponse.secure_url && !finalResponse.url)) {
    throw new Error('Cloudinary did not return asset metadata upon completion');
  }

  return finalResponse;
}

/**
 * Registers media asset metadata in PostgreSQL via /api/media/register.
 */
async function registerMediaAsset(params: {
  entityId: string;
  mediaType: string;
  url: string;
  secureUrl?: string;
  publicId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  purpose?: string;
}): Promise<any> {
  const res = await fetch('/api/media/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const json = await res.json();
  if (!json.success || !json.media) {
    throw new Error(json.error || 'Failed to save media metadata');
  }

  return json.media;
}

/**
 * Universal Media Upload Engine
 * Directly uploads media from any device with live progress, chunking, and fallback.
 */
export async function uploadMediaWithProgress(
  file: File,
  entityId: string,
  purpose: string = 'GALLERY',
  onProgress?: UploadProgressFn
): Promise<UploadResult> {
  const { mediaType, resourceType, normalizedMime } = detectMediaKind(file.name, file.type);
  const sizeFormatted = formatBytes(file.size);
  const isLargeVideo = mediaType === 'VIDEO' || file.size > CHUNK_THRESHOLD;

  if (onProgress) {
    onProgress(5, `Preparing ${file.name} (${sizeFormatted})...`);
  }

  try {
    // 1. Obtain signed token for direct upload
    let signData: CloudinarySignResponse | null = null;
    try {
      signData = await getCloudinarySignature(resourceType);
    } catch (signErr) {
      console.warn('Could not get direct upload signature, falling back to server route:', signErr);
    }

    if (signData && signData.success) {
      // 2. Perform Direct Signed Upload to Cloudinary
      let cloudResult: any = null;

      if (isLargeVideo && file.size > CHUNK_THRESHOLD) {
        if (onProgress) {
          onProgress(10, `Streaming ${sizeFormatted} video in reliable chunks...`);
        }

        cloudResult = await uploadChunkedDirect(
          file,
          signData,
          resourceType,
          (pct, loaded, total) => {
            if (onProgress) {
              const displayPct = Math.min(94, Math.max(10, pct));
              onProgress(
                displayPct,
                `Uploading: ${displayPct}% (${formatBytes(loaded)} / ${formatBytes(total)})`
              );
            }
          }
        );
      } else {
        if (onProgress) {
          onProgress(10, `Uploading ${sizeFormatted} directly to cloud...`);
        }

        cloudResult = await uploadSingleDirect(
          file,
          signData,
          resourceType,
          (pct, loaded, total) => {
            if (onProgress) {
              const displayPct = Math.min(94, Math.max(10, pct));
              onProgress(
                displayPct,
                `Uploading: ${displayPct}% (${formatBytes(loaded)} / ${formatBytes(total)})`
              );
            }
          }
        );
      }

      if (onProgress) {
        onProgress(96, 'Optimizing media & registering in database...');
      }

      // 3. Register completed asset in PostgreSQL
      const savedMedia = await registerMediaAsset({
        entityId,
        mediaType,
        url: cloudResult.secure_url || cloudResult.url,
        secureUrl: cloudResult.secure_url || cloudResult.url,
        publicId: cloudResult.public_id,
        filename: file.name,
        mimeType: normalizedMime,
        sizeBytes: cloudResult.bytes || file.size,
        width: cloudResult.width || undefined,
        height: cloudResult.height || undefined,
        purpose,
      });

      if (onProgress) {
        onProgress(100, 'Upload finished successfully!');
      }

      return { success: true, media: savedMedia };
    }
  } catch (directErr: any) {
    console.warn('Direct cloud upload failed, attempting fallback:', directErr);
    if (onProgress) {
      onProgress(25, 'Retrying via fallback server upload...');
    }
  }

  // 4. Fallback: Server Route or Server Action
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityId', entityId);
    formData.append('purpose', purpose);

    if (onProgress) {
      onProgress(45, `Processing ${file.name} via server fallback...`);
    }

    let result: any = null;
    try {
      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });
      result = await response.json();
    } catch {
      result = await uploadMediaAction(formData);
    }

    if (result && result.success && result.media) {
      if (onProgress) onProgress(100, 'Upload finished successfully!');
      return { success: true, media: result.media };
    }

    return {
      success: false,
      error: result?.error || 'Failed to upload media file.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Media upload error occurred.',
    };
  }
}
