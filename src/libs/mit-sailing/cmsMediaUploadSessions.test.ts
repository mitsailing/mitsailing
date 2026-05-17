import { describe, expect, it } from 'vitest';
import {
  buildCmsMediaUploadUrl,
  createCmsMediaUploadSession,
} from '@/libs/mit-sailing/cmsMediaUploadSessions';
import { verifyCmsMediaUploadToken } from '@/libs/mit-sailing/cmsMediaUploadTokens';

describe('cms media upload sessions', () => {
  const secret = 'test-upload-secret-with-at-least-thirty-two-chars';

  it('builds stable data-server upload URLs', () => {
    expect(
      buildCmsMediaUploadUrl({
        assetId: 'asset-1',
        baseUrl: 'https://uploads.mitsailing.com/',
      })
    ).toBe('https://uploads.mitsailing.com/cms-media/uploads/asset-1');
  });

  it('returns signed PUT details for the Docker upload service', () => {
    const session = createCmsMediaUploadSession({
      asset: {
        byteSize: 1024,
        createdAt: '2026-05-17T12:00:00.000Z',
        id: 'asset-1',
        mediaKind: 'image',
        mimeType: 'image/png',
        originalFilename: 'Race Day.png',
        publicPath: '/cms-media/asset-1/race-day.png',
        status: 'uploading',
      },
      baseUrl: 'https://uploads.mitsailing.com',
      now: new Date(Date.UTC(2026, 4, 17, 12)),
      secret,
      storedFilename: 'race-day.png',
    });

    expect(session.upload.method).toBe('PUT');
    expect(session.upload.url).toBe(
      'https://uploads.mitsailing.com/cms-media/uploads/asset-1'
    );
    expect(session.upload.headers['content-type']).toBe('image/png');
    expect(
      verifyCmsMediaUploadToken({
        now: new Date(Date.UTC(2026, 4, 17, 12, 5)),
        secret,
        token: session.upload.headers['x-mitsailing-upload-token'],
      })
    ).toMatchObject({
      assetId: 'asset-1',
      byteSize: 1024,
      mimeType: 'image/png',
      storedFilename: 'race-day.png',
    });
  });
});
