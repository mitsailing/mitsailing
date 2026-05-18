import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildCmsMediaPublicPath,
  cmsMediaByteSizeToNumber,
  detectCmsMediaKind,
  detectCmsMediaMimeType,
  mediaKindFromMimeType,
  resolveCmsMediaStoragePath,
  sanitizeCmsMediaFilename,
  validateCmsMediaMetadata,
  validateCmsMediaUpload,
} from '@/libs/mit-sailing/cmsMediaValidation';

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

describe('cms media validation', () => {
  it('rejects bigint byte sizes that cannot safely serialize as numbers', () => {
    expect(() =>
      cmsMediaByteSizeToNumber(
        BigInt(Number.MAX_SAFE_INTEGER) + BigInt(Number.parseInt('1', 10))
      )
    ).toThrow('safe integer');
  });

  it('detects allowed image mime types from bytes', () => {
    expect(detectCmsMediaMimeType(new Uint8Array([255, 216, 255]))).toBe(
      'image/jpeg'
    );
    expect(detectCmsMediaMimeType(PNG_BYTES)).toBe('image/png');
    expect(
      detectCmsMediaMimeType(new Uint8Array([71, 73, 70, 56, 57, 97]))
    ).toBe('image/gif');
    expect(
      detectCmsMediaMimeType(
        new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80])
      )
    ).toBe('image/webp');
  });

  it('rejects svg and unknown file signatures', () => {
    const svg = new TextEncoder().encode('<svg><script /></svg>');

    expect(
      validateCmsMediaUpload({
        bytes: svg,
        declaredMimeType: 'image/svg+xml',
        originalFilename: 'bad.svg',
      })
    ).toEqual({ ok: false, code: 'unsupported_type' });
    expect(detectCmsMediaMimeType(svg)).toBeNull();
  });

  it('rejects declared mime type mismatches', () => {
    expect(
      validateCmsMediaUpload({
        bytes: PNG_BYTES,
        declaredMimeType: 'image/jpeg',
        originalFilename: 'photo.jpg',
      })
    ).toEqual({ ok: false, code: 'mime_mismatch' });
  });

  it('accepts valid uploads with matching mime types', () => {
    const result = validateCmsMediaUpload({
      bytes: PNG_BYTES,
      declaredMimeType: 'image/png',
      originalFilename: 'photo.png',
    });

    expect(result.ok).toBe(true);
  });

  it('allows image uploads through the image metadata limit', () => {
    const bytes = new Uint8Array(10 * 1024 * 1024 + 1);
    bytes.set(PNG_BYTES);

    expect(
      validateCmsMediaUpload({
        bytes,
        declaredMimeType: 'image/png',
        originalFilename: 'photo.png',
      })
    ).toMatchObject({ ok: true });
  });

  it('rejects image uploads above the shared metadata limit', () => {
    const bytes = new Uint8Array(100 * 1024 * 1024 + 1);
    bytes.set(PNG_BYTES);

    expect(
      validateCmsMediaUpload({
        bytes,
        declaredMimeType: 'image/png',
        originalFilename: 'photo.png',
      })
    ).toEqual({ ok: false, code: 'too_large' });
  });

  it('sanitizes filenames and uses detected extensions', () => {
    expect(
      sanitizeCmsMediaFilename('../Race Day FINAL!!.PNG', 'image/png')
    ).toBe('race-day-final.png');
    expect(sanitizeCmsMediaFilename('test..jpeg', 'image/jpeg')).toBe(
      'test.jpg'
    );
    expect(sanitizeCmsMediaFilename('..', 'image/jpeg')).toBe('upload.jpg');
  });

  it('builds app relative public paths', () => {
    expect(
      buildCmsMediaPublicPath({ id: 'asset-1', filename: 'race-day.png' })
    ).toBe('/cms-media/asset-1/race-day.png');
  });

  it('keeps storage paths inside the configured root', () => {
    const root = path.resolve('test-cms-media-root');

    expect(
      resolveCmsMediaStoragePath({
        root,
        id: 'asset-1',
        filename: 'race-day.png',
      })
    ).toBe(path.join(root, 'asset-1', 'race-day.png'));
    expect(
      resolveCmsMediaStoragePath({
        root,
        id: '..',
        filename: 'race-day.png',
      })
    ).toBeNull();
    expect(
      resolveCmsMediaStoragePath({
        root,
        id: 'asset-1',
        filename: '../secret.png',
      })
    ).toBeNull();
  });

  it('classifies image, file, and video mime types', () => {
    expect(mediaKindFromMimeType('image/png')).toBe('image');
    expect(mediaKindFromMimeType('application/pdf')).toBe('file');
    expect(mediaKindFromMimeType('video/mp4')).toBe('video');
    expect(mediaKindFromMimeType('application/x-msdownload')).toBeNull();
  });

  it('validates upload metadata before opening a server-folder upload', () => {
    expect(
      validateCmsMediaMetadata({
        byteSize: 1024,
        declaredMimeType: 'application/pdf',
        originalFilename: 'sailing-handbook.pdf',
      })
    ).toEqual({
      ok: true,
      mediaKind: 'file',
      mimeType: 'application/pdf',
      storedFilename: 'sailing-handbook.pdf',
    });
  });

  it('rejects invalid metadata byte sizes', () => {
    for (const byteSize of [Number.NaN, 1024.5]) {
      expect(
        validateCmsMediaMetadata({
          byteSize,
          declaredMimeType: 'application/pdf',
          originalFilename: 'sailing-handbook.pdf',
        })
      ).toEqual({ ok: false, code: 'too_large' });
    }
  });

  it('rejects video metadata above the shared upload limit', () => {
    expect(
      validateCmsMediaMetadata({
        byteSize: 100 * 1024 * 1024 + 1,
        declaredMimeType: 'video/mp4',
        originalFilename: 'sailing.mp4',
      })
    ).toEqual({ ok: false, code: 'too_large' });
  });

  it('detects common video signatures during worker processing', () => {
    const mp4Bytes = new Uint8Array([
      0, 0, 0, 24, 102, 116, 121, 112, 109, 112, 52, 50,
    ]);

    expect(detectCmsMediaKind(mp4Bytes, 'video/mp4')).toBe('video');
  });

  it('detects mp4 signatures after leading bytes during worker processing', () => {
    const bytes = new Uint8Array(40);
    bytes.set([102, 116, 121, 112], 20);

    expect(detectCmsMediaKind(bytes, 'video/mp4')).toBe('video');
  });

  it('rejects known file types with invalid signatures', () => {
    const textBytes = new TextEncoder().encode('not the declared file type');

    expect(detectCmsMediaKind(textBytes, 'application/pdf')).toBeNull();
    expect(detectCmsMediaKind(textBytes, 'video/mp4')).toBeNull();
    expect(detectCmsMediaKind(textBytes, 'video/quicktime')).toBeNull();
    expect(detectCmsMediaKind(textBytes, 'video/webm')).toBeNull();
  });
});
