import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildCmsMediaPublicPath,
  detectCmsMediaMimeType,
  resolveCmsMediaStoragePath,
  sanitizeCmsMediaFilename,
  validateCmsMediaUpload,
} from '@/libs/mit-sailing/cmsMediaValidation';

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

describe('cms media validation', () => {
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

  it('sanitizes filenames and uses detected extensions', () => {
    expect(
      sanitizeCmsMediaFilename('../Race Day FINAL!!.PNG', 'image/png')
    ).toBe('race-day-final.png');
    expect(sanitizeCmsMediaFilename('..', 'image/jpeg')).toBe('upload.jpg');
  });

  it('builds app relative public paths', () => {
    expect(
      buildCmsMediaPublicPath({ id: 'asset-1', filename: 'race-day.png' })
    ).toBe('/cms-media/asset-1/race-day.png');
  });

  it('keeps storage paths inside the configured root', () => {
    const root = path.join(path.sep, 'var', 'lib', 'mitsailing', 'cms-media');

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
});
