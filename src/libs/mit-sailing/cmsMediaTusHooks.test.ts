import { describe, expect, it, vi } from 'vitest';
import { handleCmsMediaTusHook } from '@/libs/mit-sailing/cmsMediaTusHooks';
import { createCmsMediaUploadToken } from '@/libs/mit-sailing/cmsMediaUploadTokens';

const secret = 'test-upload-secret-with-at-least-thirty-two-chars';
const now = new Date(Date.UTC(2026, 4, 17, 12));

type TestAsset = {
  byteSize: bigint;
  id: string;
  mimeType: string;
  status: 'failed' | 'processing' | 'queued' | 'ready' | 'uploading';
  storageProvider: 'local' | 'server_folder';
  storedFilename: string;
};

function asset(overrides: Partial<TestAsset> = {}): TestAsset {
  return {
    byteSize: BigInt(Number('1024')),
    id: 'asset-1',
    mimeType: 'image/png',
    status: 'uploading',
    storageProvider: 'server_folder',
    storedFilename: 'race-day.png',
    ...overrides,
  };
}

function token(
  overrides: Partial<
    Parameters<typeof createCmsMediaUploadToken>[0]['payload']
  > = {}
) {
  return createCmsMediaUploadToken({
    payload: {
      assetId: 'asset-1',
      byteSize: 1024,
      expiresAt: now.getTime() + 60_000,
      mimeType: 'image/png',
      storedFilename: 'race-day.png',
      ...overrides,
    },
    secret,
  });
}

function preCreateHook(uploadMetadata: Record<string, string>, size = 1024) {
  return {
    Event: {
      Upload: {
        MetaData: uploadMetadata,
        Size: size,
      },
    },
    Type: 'pre-create',
  };
}

async function handleHook(options: {
  body: unknown;
  findAsset?: (assetId: string) => Promise<TestAsset | null>;
}) {
  const result = await handleCmsMediaTusHook({
    body: options.body,
    findAsset:
      options.findAsset ??
      vi
        .fn<(assetId: string) => Promise<TestAsset | null>>()
        .mockResolvedValue(asset()),
    now,
    secret,
  });
  return result;
}

function metadata(overrides: Record<string, string> = {}) {
  return {
    assetId: 'asset-1',
    byteSize: '1024',
    filename: 'race-day.png',
    filetype: 'image/png',
    token: token(),
    ...overrides,
  };
}

describe('cms media tus hooks', () => {
  it('forces the upload id and storage path for valid pre-create hooks', async () => {
    const result = await handleHook({
      body: preCreateHook(metadata()),
    });

    expect(result).toEqual({
      body: {
        ChangeFileInfo: {
          ID: 'asset-1',
          Storage: {
            Path: 'asset-1',
          },
        },
      },
      status: 200,
    });
  });

  it('rejects missing tokens with 401', async () => {
    const { token: _token, ...metadataWithoutToken } = metadata();

    const result = await handleHook({
      body: preCreateHook(metadataWithoutToken),
    });

    expect(result.status).toBe(401);
    expect(result.body).toMatchObject({
      HTTPResponse: { StatusCode: 401 },
      RejectUpload: true,
    });
  });

  it('rejects tokens for different assets with 403', async () => {
    const result = await handleHook({
      body: preCreateHook(
        metadata({
          token: token({ assetId: 'asset-2' }),
        })
      ),
    });

    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({
      HTTPResponse: { StatusCode: 403 },
      RejectUpload: true,
    });
  });

  it('rejects upload lengths that differ from the DB byte size with 400', async () => {
    const result = await handleHook({
      body: preCreateHook(
        metadata({
          byteSize: '2048',
          token: token({ byteSize: 2048 }),
        }),
        2048
      ),
    });

    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      HTTPResponse: { StatusCode: 400 },
      RejectUpload: true,
    });
  });

  it('rejects MIME metadata that differs from the DB asset with 415', async () => {
    const result = await handleHook({
      body: preCreateHook(
        metadata({
          filetype: 'image/jpeg',
          token: token({ mimeType: 'image/jpeg' }),
        })
      ),
    });

    expect(result.status).toBe(415);
    expect(result.body).toMatchObject({
      HTTPResponse: { StatusCode: 415 },
      RejectUpload: true,
    });
  });

  it('rejects missing DB assets with 404', async () => {
    const result = await handleHook({
      body: preCreateHook(metadata()),
      findAsset: vi
        .fn<(assetId: string) => Promise<TestAsset | null>>()
        .mockResolvedValue(null),
    });

    expect(result.status).toBe(404);
    expect(result.body).toMatchObject({
      HTTPResponse: { StatusCode: 404 },
      RejectUpload: true,
    });
  });

  it('rejects unsupported storage providers with 403', async () => {
    const result = await handleHook({
      body: preCreateHook(metadata()),
      findAsset: vi
        .fn<(assetId: string) => Promise<TestAsset | null>>()
        .mockResolvedValue(asset({ storageProvider: 'local' })),
    });

    expect(result.status).toBe(403);
    expect(result.body).toMatchObject({
      HTTPResponse: {
        Body: JSON.stringify({ error: 'unsupported_storage_provider' }),
        StatusCode: 403,
      },
      RejectUpload: true,
    });
  });
});
