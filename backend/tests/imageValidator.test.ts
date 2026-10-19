import { describe, it, expect } from 'vitest';
import { validateImageBuffer } from '../src/utils/imageValidator';

describe('Image Validator Utility', () => {
  it('rejects buffers smaller than 64 bytes', () => {
    const tinyBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const result = validateImageBuffer(tinyBuffer, 'jpeg');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty or corrupted');
  });

  it('rejects files without valid image magic bytes', () => {
    const fakeData = Buffer.alloc(100, 'A');
    const result = validateImageBuffer(fakeData, 'png');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('signature does not match');
  });

  it('validates a valid PNG buffer and extracts dimensions', () => {
    // Construct minimal valid PNG header with IHDR chunk
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
      0x00, 0x00, 0x00, 0x0d, // IHDR chunk length = 13
      0x49, 0x48, 0x44, 0x52, // 'IHDR'
      0x00, 0x00, 0x01, 0x00, // Width: 256
      0x00, 0x00, 0x01, 0x00, // Height: 256
      0x08, 0x06, 0x00, 0x00, 0x00, // Bit depth, color type, compression, filter, interlace
      0x00, 0x00, 0x00, 0x00, // CRC placeholder
    ]);
    const paddedPng = Buffer.concat([pngHeader, Buffer.alloc(50, 0)]);

    const result = validateImageBuffer(paddedPng, 'png');
    expect(result.valid).toBe(true);
    expect(result.format).toBe('png');
    expect(result.width).toBe(256);
    expect(result.height).toBe(256);
  });

  it('validates a valid JPEG buffer and extracts dimensions', () => {
    // Construct minimal valid JPEG with SOF0 marker
    const jpegBuffer = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), // SOI + APP0
      Buffer.alloc(14, 0),
      Buffer.from([
        0xff, 0xc0, // SOF0
        0x00, 0x11, // length: 17
        0x08, // precision
        0x01, 0xf4, // height: 500
        0x01, 0x40, // width: 320
        0x03, // components
      ]),
      Buffer.alloc(40, 0),
      Buffer.from([0xff, 0xd9]), // EOI
    ]);

    const result = validateImageBuffer(jpegBuffer, 'jpeg');
    expect(result.valid).toBe(true);
    expect(result.format).toBe('jpeg');
    expect(result.width).toBe(320);
    expect(result.height).toBe(500);
  });

  it('validates a valid WebP buffer and extracts dimensions', () => {
    // Minimal WebP VP8 lossy header
    const webpBuffer = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0x50, 0x00, 0x00, 0x00]), // File size
      Buffer.from('WEBP', 'ascii'),
      Buffer.from('VP8 ', 'ascii'),
      Buffer.from([0x40, 0x00, 0x00, 0x00]), // VP8 chunk size
      Buffer.alloc(3, 0), // frame tag
      Buffer.from([0x9d, 0x01, 0x2a]), // keyframe start code
      Buffer.from([0x00, 0x01]), // width = 256
      Buffer.from([0x00, 0x01]), // height = 256
      Buffer.alloc(45, 0),
    ]);

    const result = validateImageBuffer(webpBuffer, 'webp');
    expect(result.valid).toBe(true);
    expect(result.format).toBe('webp');
    expect(result.width).toBe(256);
    expect(result.height).toBe(256);
  });

  it('rejects mismatched declared MIME type', () => {
    // PNG buffer declared as JPEG
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x64,
      0x00, 0x00, 0x00, 0x64,
      0x08, 0x06, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
    ]);
    const padded = Buffer.concat([pngHeader, Buffer.alloc(50, 0)]);

    const result = validateImageBuffer(padded, 'jpeg');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('does not match actual image content');
  });

  it('rejects oversized image dimensions exceeding safety limits', () => {
    const hugePng = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x27, 0x10, // Width: 10000 (> 8192)
      0x00, 0x00, 0x27, 0x10, // Height: 10000 (> 8192)
      0x08, 0x06, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
    ]);
    const padded = Buffer.concat([hugePng, Buffer.alloc(50, 0)]);

    const result = validateImageBuffer(padded, 'png');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('exceed maximum allowed dimensions');
  });
});
