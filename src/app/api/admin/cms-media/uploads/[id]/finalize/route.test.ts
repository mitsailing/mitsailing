import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  enqueueCmsMediaProcessingJob: vi.fn(),
  findUnique: vi.fn(),
  getCurrentUser: vi.fn(),
  getDefaultQueue: vi.fn(() => ({ name: 'default' })),
  update: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock('@/libs/auth/dal', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    cmsMediaAsset: {
      findUnique: mocks.findUnique,
      update: mocks.update,
      updateMany: mocks.updateMany,
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
    mocks.findUnique
      .mockResolvedValueOnce(asset())
      .mockResolvedValueOnce(asset('queued'));
    mocks.updateMany.mockResolvedValue({ count: 1 });

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
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'queued' }),
        where: { id: 'asset-1', status: 'uploading' },
      })
    );
    expect(mocks.enqueueCmsMediaProcessingJob).toHaveBeenCalledWith(
      { name: 'default' },
      { assetId: 'asset-1' }
    );
  });

  it('returns queued asset when finalize is called again', async () => {
    stubAdminUser();
    mocks.findUnique.mockResolvedValue(asset('queued'));

    const response = await POST(finalizeRequest(), routeProps());

    await expect(response.json()).resolves.toMatchObject({
      asset: {
        id: 'asset-1',
        status: 'queued',
      },
    });
    expect(response.status).toBe(200);
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.enqueueCmsMediaProcessingJob).not.toHaveBeenCalled();
  });

  it('returns queued asset when another finalize already updated status', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          headResponse({ 'Upload-Length': '1024', 'Upload-Offset': '1024' })
        )
    );
    stubAdminUser();
    mocks.findUnique
      .mockResolvedValueOnce(asset())
      .mockResolvedValueOnce(asset('queued'));
    mocks.updateMany.mockResolvedValue({ count: 0 });

    const response = await POST(finalizeRequest(), routeProps());

    await expect(response.json()).resolves.toMatchObject({
      asset: {
        id: 'asset-1',
        status: 'queued',
      },
    });
    expect(response.status).toBe(200);
    expect(mocks.enqueueCmsMediaProcessingJob).not.toHaveBeenCalled();
  });

  it('does not queue processing when the asset leaves uploading before update', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          headResponse({ 'Upload-Length': '1024', 'Upload-Offset': '1024' })
        )
    );
    stubAdminUser();
    mocks.findUnique.mockResolvedValue(asset());
    mocks.updateMany.mockResolvedValue({ count: 0 });

    const response = await POST(finalizeRequest(), routeProps());

    await expect(response.json()).resolves.toEqual({
      error: 'upload_finalize_conflict',
    });
    expect(response.status).toBe(409);
    expect(mocks.enqueueCmsMediaProcessingJob).not.toHaveBeenCalled();
  });

  it('repairs queued status when enqueue fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          headResponse({ 'Upload-Length': '1024', 'Upload-Offset': '1024' })
        )
    );
    stubAdminUser();
    mocks.findUnique
      .mockResolvedValueOnce(asset())
      .mockResolvedValueOnce(asset('queued'));
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.enqueueCmsMediaProcessingJob.mockRejectedValue(
      new Error('redis down')
    );

    const response = await POST(finalizeRequest(), routeProps());

    await expect(response.json()).resolves.toEqual({
      error: 'processing_queue_unavailable',
    });
    expect(response.status).toBe(503);
    expect(mocks.updateMany).toHaveBeenLastCalledWith({
      data: {
        processingErrorCode: null,
        status: 'uploading',
      },
      where: { id: 'asset-1', status: 'queued' },
    });
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
    expect(mocks.updateMany).not.toHaveBeenCalled();
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
    expect(mocks.updateMany).not.toHaveBeenCalled();
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
    expect(mocks.updateMany).not.toHaveBeenCalled();
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
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
