import type * as crypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const defaultUploadSessionBody = {
  byteSize: 1024,
  originalFilename: 'race-day.png',
  type: 'image/png',
};

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
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
  });

  it('forbids signed-in users without admin view', async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });

    const response = await POST(uploadSessionRequest());

    await expect(response.json()).resolves.toEqual({ error: 'forbidden' });
    expect(response.status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
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
  });

  it('rejects malformed upload session requests', async () => {
    stubAdminUser();

    const response = await POST(invalidJsonUploadSessionRequest());

    await expect(response.json()).resolves.toEqual({
      error: 'invalid_request',
    });
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects non-integer upload session byte sizes', async () => {
    stubAdminUser();

    const response = await POST(
      uploadSessionRequest({
        byteSize: 1024.5,
        originalFilename: 'race-day.png',
        type: 'image/png',
      })
    );

    await expect(response.json()).resolves.toEqual({
      error: 'invalid_request',
    });
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('rejects unsupported upload session media types', async () => {
    stubAdminUser();

    const response = await POST(
      uploadSessionRequest({
        byteSize: 1024,
        originalFilename: 'shell.html',
        type: 'text/html',
      })
    );

    await expect(response.json()).resolves.toEqual({
      error: 'unsupported_type',
    });
    expect(response.status).toBe(415);
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
  });

  it('creates an upload session with tus metadata for admins', async () => {
    stubAdminUser();
    mocks.create.mockResolvedValue(createdAsset());

    const response = await POST(
      uploadSessionRequest({
        byteSize: 1024,
        originalFilename: 'Race Day.png',
        type: 'image/png',
      })
    );

    const body = await response.json();
    expect(response.status).toBe(201);
    expectUploadSessionResponse(body);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rawUploadId: expect.any(String),
          status: 'uploading',
          storageProvider: 'server_folder',
          uploadedByUserId: 'admin-1',
        }),
      })
    );
  });

  it('creates an upload session for dock staff pdf', async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: 'dock-1',
      role: 'dock_staff',
    });
    mocks.create.mockResolvedValue({
      byteSize: BigInt(Number.parseInt('2048', 10)),
      createdAt: new Date(Date.UTC(2026, 4, 17, 12)),
      id: 'asset-1',
      mediaKind: 'file',
      mimeType: 'application/pdf',
      originalFilename: 'handbook.pdf',
      publicPath: '/cms-media/asset-1/handbook.pdf',
      status: 'uploading',
    });

    const response = await POST(
      uploadSessionRequest({
        byteSize: 2048,
        originalFilename: 'handbook.pdf',
        type: 'application/pdf',
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mediaKind: 'file',
          mimeType: 'application/pdf',
          uploadedByUserId: 'dock-1',
        }),
      })
    );
  });

  it('creates an upload session for volunteer instructor', async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: 'volunteer-1',
      role: 'volunteer_instructor',
    });
    mocks.create.mockResolvedValue({
      byteSize: BigInt(Number.parseInt('1024', 10)),
      createdAt: new Date(Date.UTC(2026, 4, 17, 12)),
      id: 'asset-1',
      mediaKind: 'image',
      mimeType: 'image/png',
      originalFilename: 'race-day.png',
      publicPath: '/cms-media/asset-1/race-day.png',
      status: 'uploading',
    });

    const response = await POST(
      uploadSessionRequest({
        byteSize: 1024,
        originalFilename: 'race-day.png',
        type: 'image/png',
      })
    );

    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          uploadedByUserId: 'volunteer-1',
        }),
      })
    );
  });
});
