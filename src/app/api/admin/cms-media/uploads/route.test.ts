import type * as crypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const defaultUploadSessionBody = {
  byteSize: 1024,
  originalFilename: 'race-day.png',
  pageId: null,
  type: 'image/png',
};

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  getCurrentUser: vi.fn(),
  randomUUID: vi.fn(() => 'asset-1'),
  mediaUploadSharedSecret:
    'test-upload-secret-with-at-least-thirty-two-chars' as string | undefined,
}));

vi.mock('@/libs/auth/dal', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    cmsMediaAsset: {
      create: mocks.create,
    },
    cmsPage: {
      findUnique: mocks.findUnique,
    },
  },
}));

vi.mock('@/libs/Env', () => ({
  Env: {
    MEDIA_STORAGE_ROOT: `${process.cwd()}/local/mitsailing-cms-media-test`,
    MEDIA_UPLOAD_BASE_URL: 'https://mitsailing.com',
    get MEDIA_UPLOAD_SHARED_SECRET() {
      return mocks.mediaUploadSharedSecret;
    },
  },
}));

vi.mock('node:crypto', async () => {
  const actual = await vi.importActual<typeof crypto>('node:crypto');
  return {
    ...actual,
    randomUUID: mocks.randomUUID,
  };
});

afterEach(() => {
  mocks.mediaUploadSharedSecret =
    'test-upload-secret-with-at-least-thirty-two-chars';
  mocks.randomUUID.mockReturnValue('asset-1');
  vi.clearAllMocks();
});

function uploadSessionRequest(
  body: unknown = defaultUploadSessionBody
): Request {
  return new Request('https://mitsailing.test/api/admin/cms-media/uploads', {
    body: JSON.stringify(body),
    method: 'POST',
  });
}

function invalidJsonUploadSessionRequest(): Request {
  return new Request('https://mitsailing.test/api/admin/cms-media/uploads', {
    body: '{',
    method: 'POST',
  });
}

function stubAdminUser(): void {
  mocks.getCurrentUser.mockResolvedValue({
    id: 'admin-1',
    role: 'admin',
  });
}

function createdAsset() {
  return {
    byteSize: BigInt(Number.parseInt('1024', 10)),
    createdAt: new Date(Date.UTC(2026, 4, 17, 12)),
    id: 'asset-1',
    mediaKind: 'image',
    mimeType: 'image/png',
    originalFilename: 'Race Day.png',
    publicPath: '/cms-media/asset-1/race-day.png',
    status: 'uploading',
  };
}

function expectUploadSessionResponse(body: unknown): void {
  expect(body).toEqual({
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
    upload: expect.objectContaining({
      byteSize: 1024,
      endpoint: 'https://mitsailing.com/cms-media/uploads/',
      headers: {
        'x-mitsailing-upload-token': expect.any(String),
      },
      metadata: expect.objectContaining({
        assetId: 'asset-1',
        byteSize: '1024',
        filename: 'race-day.png',
        filetype: 'image/png',
        token: expect.any(String),
      }),
      protocol: 'tus',
    }),
  });
}

describe('cms media upload session route', () => {
  it('rejects unauthenticated upload session creation', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await POST(uploadSessionRequest());

    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(response.status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('rejects non-admin upload session creation', async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });

    const response = await POST(uploadSessionRequest());

    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(response.status).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('returns unavailable when the upload service secret is not configured', async () => {
    stubAdminUser();
    mocks.mediaUploadSharedSecret = undefined;

    const response = await POST(uploadSessionRequest());

    await expect(response.json()).resolves.toEqual({
      error: 'upload_service_not_configured',
    });
    expect(response.status).toBe(503);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('rejects malformed upload session requests', async () => {
    stubAdminUser();

    const response = await POST(invalidJsonUploadSessionRequest());

    await expect(response.json()).resolves.toEqual({
      error: 'invalid_request',
    });
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('rejects non-integer upload session byte sizes', async () => {
    stubAdminUser();

    const response = await POST(
      uploadSessionRequest({
        byteSize: 1024.5,
        originalFilename: 'race-day.png',
        pageId: null,
        type: 'image/png',
      })
    );

    await expect(response.json()).resolves.toEqual({
      error: 'invalid_request',
    });
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('rejects unsupported upload session media types', async () => {
    stubAdminUser();

    const response = await POST(
      uploadSessionRequest({
        byteSize: 1024,
        originalFilename: 'shell.html',
        pageId: null,
        type: 'text/html',
      })
    );

    await expect(response.json()).resolves.toEqual({
      error: 'unsupported_type',
    });
    expect(response.status).toBe(415);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('rejects upload sessions for unknown CMS pages', async () => {
    stubAdminUser();
    mocks.findUnique.mockResolvedValue(null);

    const response = await POST(
      uploadSessionRequest({
        byteSize: 1024,
        originalFilename: 'race-day.png',
        pageId: ' missing-page ',
        type: 'image/png',
      })
    );

    await expect(response.json()).resolves.toEqual({ error: 'invalid_page' });
    expect(response.status).toBe(400);
    expect(mocks.findUnique).toHaveBeenCalledWith({
      select: { id: true },
      where: { id: 'missing-page' },
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects upload sessions with unsafe generated storage paths', async () => {
    stubAdminUser();
    mocks.randomUUID.mockReturnValue('../asset-1');

    const response = await POST(uploadSessionRequest());

    await expect(response.json()).resolves.toEqual({
      error: 'unsafe_storage_path',
    });
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('creates an upload session without a page association', async () => {
    stubAdminUser();
    mocks.create.mockResolvedValue(createdAsset());

    const response = await POST(uploadSessionRequest());

    expect(response.status).toBe(201);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'asset-1',
          pageId: null,
          publicPath: '/cms-media/asset-1/race-day.png',
          rawUploadId: 'asset-1',
          uploadedByUserId: 'admin-1',
        }),
      })
    );
  });

  it('creates an upload session with tus metadata for admins', async () => {
    stubAdminUser();
    mocks.findUnique.mockResolvedValue({ id: 'cms-home' });
    mocks.create.mockResolvedValue(createdAsset());

    const response = await POST(
      uploadSessionRequest({
        byteSize: 1024,
        originalFilename: 'Race Day.png',
        pageId: ' cms-home ',
        type: 'image/png',
      })
    );

    const body = await response.json();
    expect(response.status).toBe(201);
    expectUploadSessionResponse(body);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pageId: 'cms-home',
          rawUploadId: expect.any(String),
          status: 'uploading',
          storageProvider: 'server_folder',
          uploadedByUserId: 'admin-1',
        }),
      })
    );
  });
});
