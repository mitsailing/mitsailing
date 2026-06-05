import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCmsMediaUploadToken } from '@/libs/mit-sailing/cmsMediaUploadTokens';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  mediaUploadSharedSecret:
    'test-upload-secret-with-at-least-thirty-two-chars' as string | undefined,
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
    get MEDIA_UPLOAD_SHARED_SECRET() {
      return mocks.mediaUploadSharedSecret;
    },
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

function invalidJsonHookRequest() {
  return new Request(
    'https://mitsailing.test/api/internal/cms-media/tusd/hooks',
    {
      body: '{',
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

function preCreateHookWithoutToken() {
  return {
    Event: {
      Upload: {
        MetaData: {
          assetId: 'asset-1',
          byteSize: '1024',
          filename: 'race-day.png',
          filetype: 'image/png',
        },
        Size: 1024,
      },
    },
    Type: 'pre-create',
  };
}

describe('cms media tusd hook route', () => {
  afterEach(() => {
    mocks.mediaUploadSharedSecret =
      'test-upload-secret-with-at-least-thirty-two-chars';
    vi.clearAllMocks();
  });

  it('rejects hooks when resumable uploads are not configured', async () => {
    mocks.mediaUploadSharedSecret = undefined;

    const response = await POST(hookRequest(preCreateHook()));

    await expect(response.json()).resolves.toEqual({
      HTTPResponse: {
        Body: JSON.stringify({ error: 'upload_service_not_configured' }),
        Header: {
          'Content-Type': 'application/json',
        },
        StatusCode: 503,
      },
      RejectUpload: true,
    });
    expect(response.status).toBe(503);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('rejects malformed hook bodies before looking up assets', async () => {
    const response = await POST(invalidJsonHookRequest());

    await expect(response.json()).resolves.toEqual({});
    expect(response.status).toBe(200);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('rejects malformed pre-create metadata before looking up assets', async () => {
    const response = await POST(
      hookRequest({
        Event: { Upload: { MetaData: { token: 'token' }, Size: 1024 } },
        Type: 'pre-create',
      })
    );

    await expect(response.json()).resolves.toEqual({
      HTTPResponse: {
        Body: JSON.stringify({ error: 'invalid_metadata' }),
        Header: {
          'Content-Type': 'application/json',
        },
        StatusCode: 400,
      },
      RejectUpload: true,
    });
    expect(response.status).toBe(400);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('rejects pre-create uploads without an app-minted token', async () => {
    const response = await POST(hookRequest(preCreateHookWithoutToken()));

    await expect(response.json()).resolves.toEqual({
      HTTPResponse: {
        Body: JSON.stringify({ error: 'missing_token' }),
        Header: {
          'Content-Type': 'application/json',
        },
        StatusCode: 401,
      },
      RejectUpload: true,
    });
    expect(response.status).toBe(401);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

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
