import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  enqueueCmsMediaProcessingJob: vi.fn(),
  findUnique: vi.fn(),
  getCurrentUser: vi.fn(),
  getDefaultQueue: vi.fn(() => ({ name: 'default' })),
  update: vi.fn(),
}));

vi.mock('@/libs/auth/dal', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    cmsMediaAsset: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
  },
}));

vi.mock('@/libs/Env', () => ({
  Env: {
    MEDIA_UPLOAD_BASE_URL: 'https://uploads.mitsailing.com',
  },
}));

vi.mock('@/worker/cmsMediaProcessingJob', () => ({
  enqueueCmsMediaProcessingJob: mocks.enqueueCmsMediaProcessingJob,
}));

vi.mock('@/worker/defaultQueue', () => ({
  getDefaultQueue: mocks.getDefaultQueue,
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function finalizeRequest(): Request {
  return new Request(
    'https://mitsailing.test/api/admin/cms-media/uploads/asset-1/finalize',
    { method: 'POST' }
  );
}

function routeProps() {
  return {
    params: Promise.resolve({ id: 'asset-1' }),
  };
}

function asset(status: 'queued' | 'uploading' = 'uploading') {
  return {
    byteSize: BigInt(Number.parseInt('1024', 10)),
    createdAt: new Date(Date.UTC(2026, 4, 17, 12)),
    id: 'asset-1',
    mediaKind: 'image',
    mimeType: 'image/png',
    originalFilename: 'Race Day.png',
    processingErrorCode: null,
    publicPath: '/cms-media/asset-1/race-day.png',
    status,
    storageProvider: 'server_folder',
  };
}

function headResponse(headers: Record<string, string>, status = 200): Response {
  return new Response(null, {
    headers,
    status,
  });
}

function stubAdminUser(): void {
  mocks.getCurrentUser.mockResolvedValue({
    id: 'admin-1',
    role: 'admin',
  });
}

describe('cms media upload finalize route', () => {
  it('queues processing when tusd reports a complete upload', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        headResponse({ 'Upload-Length': '1024', 'Upload-Offset': '1024' })
      );
    vi.stubGlobal('fetch', fetchMock);
    stubAdminUser();
    mocks.findUnique.mockResolvedValue(asset());
    mocks.update.mockResolvedValue(asset('queued'));

    const response = await POST(finalizeRequest(), routeProps());

    await expect(response.json()).resolves.toMatchObject({
      asset: {
        id: 'asset-1',
        status: 'queued',
      },
    });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://uploads.mitsailing.com/cms-media/uploads/asset-1',
      expect.objectContaining({ method: 'HEAD' })
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'queued' }),
        where: { id: 'asset-1' },
      })
    );
    expect(mocks.enqueueCmsMediaProcessingJob).toHaveBeenCalledWith(
      { name: 'default' },
      { assetId: 'asset-1' }
    );
  });

  it('returns 409 when the tus offset is incomplete', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          headResponse({ 'Upload-Length': '1024', 'Upload-Offset': '512' })
        )
    );
    stubAdminUser();
    mocks.findUnique.mockResolvedValue(asset());

    const response = await POST(finalizeRequest(), routeProps());

    await expect(response.json()).resolves.toEqual({
      error: 'upload_incomplete',
    });
    expect(response.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.enqueueCmsMediaProcessingJob).not.toHaveBeenCalled();
  });

  it('returns 409 when tus headers are missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(headResponse({}))
    );
    stubAdminUser();
    mocks.findUnique.mockResolvedValue(asset());

    const response = await POST(finalizeRequest(), routeProps());

    await expect(response.json()).resolves.toEqual({
      error: 'upload_incomplete',
    });
    expect(response.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('returns 409 when tusd cannot find the upload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(headResponse({}, 404))
    );
    stubAdminUser();
    mocks.findUnique.mockResolvedValue(asset());

    const response = await POST(finalizeRequest(), routeProps());

    await expect(response.json()).resolves.toEqual({
      error: 'upload_incomplete',
    });
    expect(response.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('returns 409 when tusd status cannot be read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new Error('network down'))
    );
    stubAdminUser();
    mocks.findUnique.mockResolvedValue(asset());

    const response = await POST(finalizeRequest(), routeProps());

    await expect(response.json()).resolves.toEqual({
      error: 'upload_incomplete',
    });
    expect(response.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
