import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createCmsMediaUploadToken } from '@/libs/mit-sailing/cmsMediaUploadTokens';
import { createCmsMediaUploadService } from '@/upload-service/server';

const secret = 'test-upload-secret-with-at-least-thirty-two-chars';

let tempRoot: string | null = null;

afterEach(async () => {
  if (tempRoot) {
    await rm(tempRoot, { force: true, recursive: true });
    tempRoot = null;
  }
});

async function createTempRoot(): Promise<string> {
  tempRoot = await mkdtemp(path.join(tmpdir(), 'mitsailing-upload-service-'));
  return tempRoot;
}

function uploadToken(props: {
  assetId: string;
  byteSize: number;
  mimeType: string;
  storedFilename: string;
}): string {
  return createCmsMediaUploadToken({
    payload: {
      assetId: props.assetId,
      byteSize: props.byteSize,
      expiresAt: Date.UTC(2026, 4, 17, 12),
      mimeType: props.mimeType,
      storedFilename: props.storedFilename,
    },
    secret,
  });
}

describe('cms media upload service', () => {
  it('stores authorized upload bytes in the shared upload folder', async () => {
    const root = await createTempRoot();
    const service = createCmsMediaUploadService({
      now: () => new Date(Date.UTC(2026, 4, 17, 11, 55)),
      root,
      secret,
    });
    const request = new Request(
      'https://uploads.mitsailing.com/cms-media/uploads/asset-1',
      {
        body: new Uint8Array([1, 2, 3, 4]),
        headers: {
          'content-length': '4',
          'content-type': 'image/png',
          'x-mitsailing-upload-token': uploadToken({
            assetId: 'asset-1',
            byteSize: 4,
            mimeType: 'image/png',
            storedFilename: 'race-day.png',
          }),
        },
        method: 'PUT',
      }
    );

    const response = await service.handle(request);

    await expect(
      readFile(path.join(root, 'uploads', 'asset-1'))
    ).resolves.toEqual(Buffer.from([1, 2, 3, 4]));
    expect(response.status).toBe(201);
  });

  it('rejects uploads when the route id does not match the token', async () => {
    const root = await createTempRoot();
    const service = createCmsMediaUploadService({
      now: () => new Date(Date.UTC(2026, 4, 17, 11, 55)),
      root,
      secret,
    });
    const request = new Request(
      'https://uploads.mitsailing.com/cms-media/uploads/asset-2',
      {
        body: new Uint8Array([1, 2, 3, 4]),
        headers: {
          'content-length': '4',
          'content-type': 'image/png',
          'x-mitsailing-upload-token': uploadToken({
            assetId: 'asset-1',
            byteSize: 4,
            mimeType: 'image/png',
            storedFilename: 'race-day.png',
          }),
        },
        method: 'PUT',
      }
    );

    const response = await service.handle(request);

    await expect(
      readFile(path.join(root, 'uploads', 'asset-2'))
    ).rejects.toThrow();
    expect(response.status).toBe(403);
  });

  it('allows browser preflights from the app origin', async () => {
    const root = await createTempRoot();
    const service = createCmsMediaUploadService({
      allowedOrigin: 'https://mitsailing.com',
      root,
      secret,
    });

    const response = await service.handle(
      new Request('https://uploads.mitsailing.com/cms-media/uploads/asset-1', {
        headers: { origin: 'https://mitsailing.com' },
        method: 'OPTIONS',
      })
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://mitsailing.com'
    );
    expect(response.headers.get('access-control-allow-methods')).toContain(
      'PUT'
    );
  });
});
