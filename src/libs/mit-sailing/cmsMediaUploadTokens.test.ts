import { describe, expect, it } from 'vitest';
import type { CmsMediaUploadTokenPayload } from '@/libs/mit-sailing/cmsMediaTypes';
import {
  createCmsMediaUploadToken,
  verifyCmsMediaUploadToken,
} from '@/libs/mit-sailing/cmsMediaUploadTokens';

describe('cms media upload tokens', () => {
  const secret = 'test-upload-secret-with-at-least-thirty-two-chars';
  const payload: CmsMediaUploadTokenPayload = {
    assetId: 'asset-1',
    byteSize: 1024,
    expiresAt: Date.UTC(2026, 4, 17, 12),
    mimeType: 'image/png',
    storedFilename: 'race-day.png',
  };

  it('round-trips signed upload metadata', () => {
    const token = createCmsMediaUploadToken({ payload, secret });

    expect(
      verifyCmsMediaUploadToken({
        now: new Date(Date.UTC(2026, 4, 17, 11, 55)),
        secret,
        token,
      })
    ).toEqual(payload);
  });

  it('rejects tokens signed by a different secret', () => {
    const token = createCmsMediaUploadToken({ payload, secret });

    expect(
      verifyCmsMediaUploadToken({
        now: new Date(Date.UTC(2026, 4, 17, 11, 55)),
        secret: 'wrong-upload-secret-with-at-least-thirty-two-chars',
        token,
      })
    ).toBeNull();
  });

  it('rejects expired upload tokens', () => {
    const token = createCmsMediaUploadToken({ payload, secret });

    expect(
      verifyCmsMediaUploadToken({
        now: new Date(Date.UTC(2026, 4, 17, 12, 1)),
        secret,
        token,
      })
    ).toBeNull();
  });
});
