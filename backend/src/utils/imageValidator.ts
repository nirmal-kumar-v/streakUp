/**
 * Zero-dependency image validation utility for profile picture uploads.
 * Verifies magic bytes, format, dimensions, and size directly from buffer.
 */

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
  format?: 'jpeg' | 'png' | 'webp';
  width?: number;
  height?: number;
  sizeInBytes?: number;
}

export function validateImageBuffer(buffer: Buffer, declaredMimeType?: string): ImageValidationResult {
  const sizeInBytes = buffer.length;

  if (sizeInBytes < 64) {
    return { valid: false, error: 'The uploaded file is empty or corrupted.' };
  }

  // Detect format via magic bytes
  let detectedFormat: 'jpeg' | 'png' | 'webp' | null = null;

  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    detectedFormat = 'jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  else if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    detectedFormat = 'png';
  }
  // WebP: RIFF .... WEBP
  else if (
    buffer.length >= 12 &&
    buffer.slice(0, 4).toString('ascii') === 'RIFF' &&
    buffer.slice(8, 12).toString('ascii') === 'WEBP'
  ) {
    detectedFormat = 'webp';
  }

  if (!detectedFormat) {
    return {
      valid: false,
      error: 'Invalid file content. Uploaded file signature does not match JPEG, PNG, or WebP.',
    };
  }

  // Check declared MIME vs detected format if declared
  if (declaredMimeType) {
    const normalizedDeclared = declaredMimeType.toLowerCase().replace('jpg', 'jpeg');
    if (!normalizedDeclared.includes(detectedFormat)) {
      return {
        valid: false,
        error: `Declared MIME type does not match actual image content (${detectedFormat.toUpperCase()}).`,
      };
    }
  }

  // Extract dimensions
  const dims = extractDimensions(buffer, detectedFormat);
  if (dims) {
    if (dims.width <= 0 || dims.height <= 0) {
      return { valid: false, error: 'Invalid image dimensions detected.' };
    }

    // Safety limit: reject unreasonably oversized images (e.g., zip bombs / decompression traps)
    if (dims.width > 8192 || dims.height > 8192) {
      return {
        valid: false,
        error: `Image dimensions (${dims.width}x${dims.height}) exceed maximum allowed dimensions (8192x8192).`,
      };
    }

    return {
      valid: true,
      format: detectedFormat,
      width: dims.width,
      height: dims.height,
      sizeInBytes,
    };
  }

  return {
    valid: true,
    format: detectedFormat,
    sizeInBytes,
  };
}

function extractDimensions(
  buffer: Buffer,
  format: 'jpeg' | 'png' | 'webp'
): { width: number; height: number } | null {
  try {
    if (format === 'png') {
      if (buffer.length >= 24 && buffer.slice(12, 16).toString('ascii') === 'IHDR') {
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        return { width, height };
      }
    } else if (format === 'webp') {
      if (buffer.length >= 16) {
        const subchunk = buffer.slice(12, 16).toString('ascii');

        // Lossy VP8
        if (subchunk === 'VP8 ' && buffer.length >= 30) {
          // Check keyframe start code 0x9D 0x01 0x2A
          if (buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
            const width = buffer.readUInt16LE(26) & 0x3fff;
            const height = buffer.readUInt16LE(28) & 0x3fff;
            return { width, height };
          }
        }
        // Lossless VP8L
        else if (subchunk === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
          const bits = buffer.readUInt32LE(21);
          const width = (bits & 0x3fff) + 1;
          const height = ((bits >> 14) & 0x3fff) + 1;
          return { width, height };
        }
        // Extended VP8X
        else if (subchunk === 'VP8X' && buffer.length >= 30) {
          const width = 1 + buffer.readUIntLE(24, 3);
          const height = 1 + buffer.readUIntLE(27, 3);
          return { width, height };
        }
      }
    } else if (format === 'jpeg') {
      let offset = 2;
      while (offset < buffer.length) {
        if (buffer[offset] !== 0xff) {
          offset++;
          continue;
        }

        while (offset < buffer.length && buffer[offset] === 0xff) {
          offset++;
        }

        if (offset >= buffer.length) break;
        const marker = buffer[offset++];

        // SOF markers: SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15
        if (
          [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
            marker
          )
        ) {
          if (offset + 7 <= buffer.length) {
            const height = buffer.readUInt16BE(offset + 3);
            const width = buffer.readUInt16BE(offset + 5);
            return { width, height };
          }
          break;
        }

        // End of image or Start of scan
        if (marker === 0xd9 || marker === 0xda) {
          break;
        }

        if (offset + 2 <= buffer.length) {
          const len = buffer.readUInt16BE(offset);
          offset += len;
        } else {
          break;
        }
      }
    }
  } catch {
    // If parsing fails, fall back to null
  }

  return null;
}
