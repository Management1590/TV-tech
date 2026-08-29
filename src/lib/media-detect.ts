export interface MediaKindResult {
  mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO';
  resourceType: 'image' | 'video' | 'raw' | 'auto';
  normalizedMime: string;
  isVideo: boolean;
  isAudio: boolean;
  isImage: boolean;
}

const VIDEO_EXTENSIONS = [
  'mp4',
  'mov',
  'mkv',
  'webm',
  'avi',
  '3gp',
  '3gpp',
  '3g2',
  'm4v',
  'wmv',
  'flv',
  'hevc',
  'h264',
  'h265',
  'mts',
  'm2ts',
  'ts',
  'ogv',
];

const AUDIO_EXTENSIONS = [
  'mp3',
  'wav',
  'm4a',
  'aac',
  'ogg',
  'opus',
  'flac',
  'wma',
  'weba',
  'amr',
];

const IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'heic',
  'heif',
  'bmp',
  'svg',
  'avif',
  'tiff',
  'jfif',
  'ico',
];

/**
 * Robustly detects whether a file is an IMAGE, VIDEO, or AUDIO across all devices,
 * especially handling Samsung Android quirks where MIME types can be empty,
 * application/octet-stream, or custom video codecs (HEVC, MKV, 3GP).
 */
export function detectMediaKind(filename: string, mimeType?: string | null): MediaKindResult {
  const cleanMime = (mimeType || '').toLowerCase().trim();
  const ext = (filename || '').split('.').pop()?.toLowerCase() || '';

  const isVideoByMime =
    cleanMime.startsWith('video/') ||
    cleanMime.includes('matroska') ||
    cleanMime.includes('quicktime') ||
    cleanMime.includes('webm') ||
    cleanMime.includes('3gp') ||
    cleanMime.includes('hevc');
  const isVideoByExt = VIDEO_EXTENSIONS.includes(ext);

  const isAudioByMime = cleanMime.startsWith('audio/');
  const isAudioByExt = AUDIO_EXTENSIONS.includes(ext);

  const isImageByMime = cleanMime.startsWith('image/');
  const isImageByExt = IMAGE_EXTENSIONS.includes(ext);

  if (isVideoByMime || isVideoByExt) {
    let resolvedMime = cleanMime.startsWith('video/') ? cleanMime : 'video/mp4';
    if (ext === 'mov') resolvedMime = 'video/quicktime';
    if (ext === 'mkv') resolvedMime = 'video/x-matroska';
    if (ext === 'webm') resolvedMime = 'video/webm';
    if (ext === '3gp' || ext === '3gpp') resolvedMime = 'video/3gpp';

    return {
      mediaType: 'VIDEO',
      resourceType: 'video',
      normalizedMime: resolvedMime,
      isVideo: true,
      isAudio: false,
      isImage: false,
    };
  }

  if (isAudioByMime || isAudioByExt) {
    let resolvedMime = cleanMime.startsWith('audio/') ? cleanMime : 'audio/mpeg';
    if (ext === 'wav') resolvedMime = 'audio/wav';
    if (ext === 'm4a') resolvedMime = 'audio/mp4';
    if (ext === 'ogg') resolvedMime = 'audio/ogg';

    return {
      mediaType: 'AUDIO',
      resourceType: 'video',
      normalizedMime: resolvedMime,
      isVideo: false,
      isAudio: true,
      isImage: false,
    };
  }

  if (isImageByMime || isImageByExt) {
    let resolvedMime = cleanMime.startsWith('image/') ? cleanMime : 'image/jpeg';
    if (ext === 'png') resolvedMime = 'image/png';
    if (ext === 'webp') resolvedMime = 'image/webp';
    if (ext === 'gif') resolvedMime = 'image/gif';
    if (ext === 'heic') resolvedMime = 'image/heic';

    return {
      mediaType: 'IMAGE',
      resourceType: 'image',
      normalizedMime: resolvedMime,
      isVideo: false,
      isAudio: false,
      isImage: true,
    };
  }

  return {
    mediaType: 'IMAGE',
    resourceType: 'auto',
    normalizedMime: cleanMime || 'application/octet-stream',
    isVideo: false,
    isAudio: false,
    isImage: true,
  };
}

export function isValidMediaFile(file: File): boolean {
  const result = detectMediaKind(file.name, file.type);
  return result.isImage || result.isVideo || result.isAudio;
}
