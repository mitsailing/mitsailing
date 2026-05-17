import { describe, expect, it } from 'vitest';
import {
  buildCmsMediaTusEndpoint,
  createCmsMediaUploadSession,
} from '@/libs/mit-sailing/cmsMediaUploadSessions';
import { verifyCmsMediaUploadToken } from '@/libs/mit-sailing/cmsMediaUploadTokens';

describe('cms media upload sessions', () => {
  const secret = 'test-upload-secret-with-at-least-thirty-two-chars';

  it('builds stable tus upload endpoints', () => {
    expect(
      buildCmsMediaTusEndpoint({
        baseUrl: 'https://uploads.mitsailing.com/',
      })
    ).toBe('https://uploads.mitsailing.com/cms-media/uploads/');
  });

  it('returns signed tus upload details for tus-js-client', () => {
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

    expect(session.upload.protocol).toBe('tus');
    expect(session.upload.endpoint).toBe(
      'https://uploads.mitsailing.com/cms-media/uploads/'
    );
    expect(session.upload.metadata.assetId).toBe('asset-1');
    expect(session.upload.metadata.byteSize).toBe('1024');
    expect(session.upload.metadata.filetype).toBe('image/png');
    expect(session.upload.metadata.filename).toBe('race-day.png');
    expect(session.upload.byteSize).toBe(1024);
    expect(
      verifyCmsMediaUploadToken({
        now: new Date(Date.UTC(2026, 4, 17, 12, 5)),
        secret,
        token: session.upload.metadata.token,
      })
    ).toMatchObject({
      assetId: 'asset-1',
      byteSize: 1024,
      mimeType: 'image/png',
      storedFilename: 'race-day.png',
    });
  });
});
