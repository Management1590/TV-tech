/**
 * TV Tech OS — Lossless Thumbnail URL and Transform Utilities
 * 
 * Preserves the 100% original full image file while storing pan/zoom
 * adjustment coordinates losslessly in the URL hash fragment.
 */

export interface ThumbnailTransform {
  url: string;
  x: number;
  y: number;
  scale: number;
}

/**
 * Parses an image URL and extracts any embedded pan/zoom transformation coordinates.
 * Returns the clean, original image URL along with the x, y offsets and zoom scale.
 */
export function parseThumbnailUrl(rawUrl: string | null | undefined): ThumbnailTransform {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { url: '', x: 0, y: 0, scale: 1 };
  }

  const [url, hash] = rawUrl.split('#');
  let x = 0;
  let y = 0;
  let scale = 1;

  if (hash) {
    try {
      const params = new URLSearchParams(hash);
      const parsedX = parseFloat(params.get('x') || '0');
      const parsedY = parseFloat(params.get('y') || '0');
      const parsedScale = parseFloat(params.get('scale') || '1');

      if (!isNaN(parsedX)) x = parsedX;
      if (!isNaN(parsedY)) y = parsedY;
      if (!isNaN(parsedScale) && parsedScale >= 0.5) scale = parsedScale;
    } catch {
      // Ignore hash parse errors and fallback to defaults
    }
  }

  return {
    url: url || rawUrl,
    x,
    y,
    scale,
  };
}

/**
 * Encodes the clean image URL and pan/zoom coordinates into a lossless URL string.
 */
export function formatThumbnailUrl(
  url: string | null | undefined,
  x: number = 0,
  y: number = 0,
  scale: number = 1
): string {
  if (!url || typeof url !== 'string') return '';
  const cleanUrl = url.split('#')[0].trim();
  if (!cleanUrl) return '';

  const roundedX = Math.round(x);
  const roundedY = Math.round(y);
  const roundedScale = Number(scale.toFixed(2));

  if (roundedX === 0 && roundedY === 0 && roundedScale === 1) {
    return cleanUrl;
  }

  return `${cleanUrl}#x=${roundedX}&y=${roundedY}&scale=${roundedScale}`;
}
