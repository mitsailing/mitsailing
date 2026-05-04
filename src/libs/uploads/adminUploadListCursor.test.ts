import { describe, expect, it } from 'vitest';
import {
  decodeAdminUploadListCursor,
  encodeAdminUploadListCursor,
} from '@/libs/uploads/adminUploadListCursor';

describe('adminUploadListCursor', () => {
  it('roundtrips createdAt and id', () => {
    const createdAt = new Date('2026-05-04T12:00:00.000Z');
    const id = 'clxyz123';
    const encoded = encodeAdminUploadListCursor(createdAt, id);
    const decoded = decodeAdminUploadListCursor(encoded);
    expect(decoded).not.toBeNull();
    if (!decoded) {
      return;
    }
    expect(decoded.id).toBe(id);
    expect(decoded.createdAt.getTime()).toBe(createdAt.getTime());
  });

  it('returns null for garbage cursor', () => {
    expect(decodeAdminUploadListCursor('not-base64!!!')).toBeNull();
    expect(decodeAdminUploadListCursor('')).toBeNull();
  });

  it('returns null when id segment missing', () => {
    const bad = Buffer.from('2026-01-01T00:00:00.000Z', 'utf8').toString(
      'base64url'
    );
    expect(decodeAdminUploadListCursor(bad)).toBeNull();
  });
});
