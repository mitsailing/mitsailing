import { describe, expect, it } from 'vitest';
import {
  ADMIN_UPLOAD_LIST_DEFAULT_LIMIT,
  ADMIN_UPLOAD_LIST_MAX_LIMIT,
  adminUploadImageListWhere,
  parseUploadListLimitParam,
} from '@/libs/uploads/adminUploadListGet';

describe('parseUploadListLimitParam', () => {
  it('returns default when param is null or empty', () => {
    expect(parseUploadListLimitParam(null)).toBe(
      ADMIN_UPLOAD_LIST_DEFAULT_LIMIT
    );
    expect(parseUploadListLimitParam('')).toBe(ADMIN_UPLOAD_LIST_DEFAULT_LIMIT);
  });

  it('clamps to max when over cap', () => {
    expect(parseUploadListLimitParam('100')).toBe(ADMIN_UPLOAD_LIST_MAX_LIMIT);
  });

  it('uses positive parsed values under the cap', () => {
    expect(parseUploadListLimitParam('12')).toBe(12);
  });

  it('falls back to default for non-positive or non-finite values', () => {
    expect(parseUploadListLimitParam('0')).toBe(
      ADMIN_UPLOAD_LIST_DEFAULT_LIMIT
    );
    expect(parseUploadListLimitParam('-3')).toBe(
      ADMIN_UPLOAD_LIST_DEFAULT_LIMIT
    );
    expect(parseUploadListLimitParam('nan')).toBe(
      ADMIN_UPLOAD_LIST_DEFAULT_LIMIT
    );
  });
});

describe('adminUploadImageListWhere', () => {
  it('filters images only when cursor is null', () => {
    expect(adminUploadImageListWhere(null)).toEqual({
      mimeType: { startsWith: 'image/' },
    });
  });

  it('adds cursor OR clause when cursor is set', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    expect(adminUploadImageListWhere({ createdAt, id: 'cid_last' })).toEqual({
      mimeType: { startsWith: 'image/' },
      OR: [
        { createdAt: { lt: createdAt } },
        { createdAt, id: { lt: 'cid_last' } },
      ],
    });
  });
});
