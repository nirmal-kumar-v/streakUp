/**
 * Silent, high-performance client-side profile image compression utility.
 * 
 * - Resizes large images to max 512x512 px while preserving aspect ratio.
 * - Preserves image orientation.
 * - Converts to WebP when supported, falling back to JPEG.
 * - Targets <= 200 KB with progressive quality degradation (0.85 -> 0.75 -> 0.65 -> 0.55).
 * - Leaves small, well-sized images with pristine visual quality.
 * - Non-blocking async execution.
 * - Completely safe fallback: returns original input if processing fails.
 */

const MAX_DIMENSION = 512;
const TARGET_SIZE_BYTES = 200 * 1024; // 200 KB
const QUALITY_STEPS = [0.85, 0.75, 0.65, 0.55];

/**
 * Calculates raw byte size of a base64 Data URI.
 */
export function getBase64ByteLength(dataUri: string): number {
  const commaIdx = dataUri.indexOf(',');
  if (commaIdx === -1) return 0;
  const base64Str = dataUri.slice(commaIdx + 1);
  const padding = base64Str.endsWith('==') ? 2 : base64Str.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64Str.length * 3) / 4) - padding);
}

/**
 * Checks if the browser's HTMLCanvasElement supports WebP export.
 */
let cachedWebpSupport: boolean | null = null;
function supportsWebP(): boolean {
  if (cachedWebpSupport !== null) return cachedWebpSupport;
  if (typeof document === 'undefined') return false;
  try {
    const testCanvas = document.createElement('canvas');
    testCanvas.width = 1;
    testCanvas.height = 1;
    const testUri = testCanvas.toDataURL('image/webp');
    cachedWebpSupport = testUri.startsWith('data:image/webp');
  } catch {
    cachedWebpSupport = false;
  }
  return cachedWebpSupport;
}

/**
 * Loads an image from a Data URI or URL asynchronously into an HTMLImageElement.
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image data'));
    img.src = src;
  });
}

/**
 * Silently compresses an image Data URI before upload.
 * If input is invalid or processing encounters an issue, safely returns the original input.
 */
export async function compressProfileImage(sourceDataUri: string): Promise<string> {
  // If not a data URI (e.g. regular HTTP URL), nothing to compress
  if (!sourceDataUri || !sourceDataUri.startsWith('data:image/')) {
    return sourceDataUri;
  }

  try {
    // Yield to keep UI completely responsive
    await new Promise((resolve) => setTimeout(resolve, 0));

    const img = await loadImage(sourceDataUri);
    const origWidth = img.naturalWidth || img.width;
    const origHeight = img.naturalHeight || img.height;

    if (origWidth <= 0 || origHeight <= 0) {
      return sourceDataUri;
    }

    // Determine target dimensions (max 512x512, maintain aspect ratio)
    let targetWidth = origWidth;
    let targetHeight = origHeight;

    if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
      const scale = Math.min(MAX_DIMENSION / targetWidth, MAX_DIMENSION / targetHeight);
      targetWidth = Math.max(1, Math.round(targetWidth * scale));
      targetHeight = Math.max(1, Math.round(targetHeight * scale));
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return sourceDataUri;
    }

    // Use high-quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const mimeType = supportsWebP() ? 'image/webp' : 'image/jpeg';

    // Progressive quality adjustment targeting <= 200 KB
    let bestResult = canvas.toDataURL(mimeType, 0.90);
    let bestSize = getBase64ByteLength(bestResult);

    if (bestSize <= TARGET_SIZE_BYTES) {
      return bestResult;
    }

    for (const quality of QUALITY_STEPS) {
      const candidate = canvas.toDataURL(mimeType, quality);
      const candidateSize = getBase64ByteLength(candidate);

      bestResult = candidate;
      bestSize = candidateSize;

      if (candidateSize <= TARGET_SIZE_BYTES) {
        break;
      }
    }

    return bestResult;
  } catch (err) {
    console.warn('Silent image compression bypassed due to processing error:', err);
    return sourceDataUri;
  }
}
