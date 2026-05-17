import { describe, expect, it, vi } from 'vitest';
import { createCmsMediaUploadToken } from '@/libs/mit-sailing/cmsMediaUploadTokens';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    cmsMediaAsset: {
      findUnique: mocks.findUnique,
    },
  },
}));

vi.mock('@/libs/Env', () => ({
  Env: {
    MEDIA_UPLOAD_SHARED_SECRET:
      'test-upload-secret-with-at-least-thirty-two-chars',
  },
}));

function hookRequest(body: unknown) {
  return new Request(
    'https://mitsailing.test/api/internal/cms-media/tusd/hooks',
    {
      body: JSON.stringify(body),
      method: 'POST',
    }
  );
}

function preCreateHook() {
  return {
    Event: {
      Upload: {
        MetaData: {
          assetId: 'asset-1',
          byteSize: '1024',
          filename: 'race-day.png',
          filetype: 'image/png',
          token: createCmsMediaUploadToken({
            payload: {
              assetId: 'asset-1',
              byteSize: 1024,
              expiresAt: Date.now() + 60_000,
              mimeType: 'image/png',
              storedFilename: 'race-day.png',
            },
            secret: 'test-upload-secret-with-at-least-thirty-two-chars',
          }),
        },
        Size: 1024,
      },
    },
    Type: 'pre-create',
  };
}

describe('cms media tusd hook route', () => {
  it('returns the tusd pre-create file info change', async () => {
    mocks.findUnique.mockResolvedValue({
      byteSize: BigInt(Number.parseInt('1024', 10)),
      id: 'asset-1',
      mimeType: 'image/png',
      status: 'uploading',
      storageProvider: 'server_folder',
      storedFilename: 'race-day.png',
    });

    const response = await POST(hookRequest(preCreateHook()));

    await expect(response.json()).resolves.toEqual({
      ChangeFileInfo: {
        ID: 'asset-1',
        Storage: {
          Path: 'asset-1',
        },
      },
    });
    expect(response.status).toBe(200);
    expect(mocks.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'asset-1' },
      })
    );
  });
});
