import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as cmsMediaTusStatusModule from '@/libs/mit-sailing/cmsMediaTusStatus';
import { POST } from './route';

type GetCmsMediaTusUploadStatus =
  typeof cmsMediaTusStatusModule.getCmsMediaTusUploadStatus;

const mocks = vi.hoisted(() => ({
  enqueueCmsMediaProcessingJob: vi.fn(),
  findUnique: vi.fn(),
  getCmsMediaTusUploadStatus: vi.fn<GetCmsMediaTusUploadStatus>(),
  getCurrentUser: vi.fn(),
  getDefaultQueue: vi.fn(() => ({ name: 'default' })),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  mediaUploadBaseUrl: 'https://mitsailing.com' as string | undefined,
  update: vi.fn(),
  updateMany: vi.fn(),
  useMockTusStatus: false,
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
    get MEDIA_UPLOAD_BASE_URL() {
      return mocks.mediaUploadBaseUrl;
    },
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
  },
}));

vi.mock('@/libs/mit-sailing/cmsMediaTusStatus', async () => {
  const actual = await vi.importActual<typeof cmsMediaTusStatusModule>(
    '@/libs/mit-sailing/cmsMediaTusStatus'
  );
  return {
    getCmsMediaTusUploadStatus: async (
      props: Parameters<GetCmsMediaTusUploadStatus>[0]
    ) => {
      if (mocks.useMockTusStatus) {
        const status = await mocks.getCmsMediaTusUploadStatus(props);
        return status;
      }
      const status = await actual.getCmsMediaTusUploadStatus(props);
      return status;
    },
  };
});

vi.mock('@/worker/cmsMediaProcessingJob', () => ({
  enqueueCmsMediaProcessingJob: mocks.enqueueCmsMediaProcessingJob,
}));

vi.mock('@/worker/defaultQueue', () => ({
  getDefaultQueue: mocks.getDefaultQueue,
}));

afterEach(() => {
  mocks.mediaUploadBaseUrl = 'https://mitsailing.com';
  mocks.useMockTusStatus = false;
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

function asset(
  status: 'processing' | 'queued' | 'ready' | 'uploading' = 'uploading',
  props: { storageProvider?: 'local' | 'server_folder' } = {}
) {
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
    storageProvider: props.storageProvider ?? 'server_folder',
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
  it('rejects unauthenticated upload finalization', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await POST(finalizeRequest(), routeProps());

    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(response.status).toBe(401);
    expect(mocks.findUnique).not.toHaveBeenCalled();
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.enqueueCmsMediaProcessingJob).not.toHaveBeenCalled();
  });

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
      'https://mitsailing.com/cms-media/uploads/asset-1',
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

  it('returns processing asset when finalize is called again after processing starts', async () => {
    stubAdminUser();
    mocks.findUnique.mockResolvedValue(asset('processing'));

    const response = await POST(finalizeRequest(), routeProps());

    await expect(response.json()).resolves.toMatchObject({
      asset: {
        id: 'asset-1',
        status: 'processing',
      },
    });
    expect(response.status).toBe(200);
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.enqueueCmsMediaProcessingJob).not.toHaveBeenCalled();
  });

  it('returns ready asset when finalize is repeated after processing completes', async () => {
    stubAdminUser();
    mocks.findUnique.mockResolvedValue(asset('ready'));

    const response = await POST(finalizeRequest(), routeProps());

    await expect(response.json()).resolves.toMatchObject({
      asset: {
        id: 'asset-1',
        status: 'ready',
      },
    });
    expect(response.status).toBe(200);
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.enqueueCmsMediaProcessingJob).not.toHaveBeenCalled();
  });

  it('returns not found when the upload asset is missing', async () => {
    stubAdminUser();
    mocks.findUnique.mockResolvedValue(null);

    const response = await POST(finalizeRequest(), routeProps());

    await expect(response.json()).resolves.toEqual({ error: 'not_found' });
    expect(response.status).toBe(404);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('rejects finalize for local direct-upload assets', async () => {
    stubAdminUser();
    mocks.findUnique.mockResolvedValue(
      asset('uploading', { storageProvider: 'local' })
    );

    const response = await POST(finalizeRequest(), routeProps());

    await expect(response.json()).resolves.toEqual({
      error: 'unsupported_storage',
    });
    expect(response.status).toBe(409);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('returns unavailable when the upload service base url is missing', async () => {
    stubAdminUser();
    mocks.mediaUploadBaseUrl = undefined;
    mocks.findUnique.mockResolvedValue(asset());

    const response = await POST(finalizeRequest(), routeProps());

    await expect(response.json()).resolves.toEqual({
      error: 'upload_service_not_configured',
    });
    expect(response.status).toBe(503);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('returns 409 when another finalize has only marked the asset queued', async () => {
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

    await expect(response.json()).resolves.toEqual({
      error: 'upload_finalize_conflict',
    });
    expect(response.status).toBe(409);
    expect(mocks.enqueueCmsMediaProcessingJob).not.toHaveBeenCalled();
  });

  it('returns processing asset when another finalize already moved status forward', async () => {
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
      .mockResolvedValueOnce(asset('processing'));
    mocks.updateMany.mockResolvedValue({ count: 0 });

    const response = await POST(finalizeRequest(), routeProps());

    await expect(response.json()).resolves.toMatchObject({
      asset: {
        id: 'asset-1',
        status: 'processing',
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

  it('returns conflict when queued asset disappears after finalize update', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          headResponse({ 'Upload-Length': '1024', 'Upload-Offset': '1024' })
        )
    );
    stubAdminUser();
    mocks.findUnique.mockResolvedValueOnce(asset()).mockResolvedValueOnce(null);
    mocks.updateMany.mockResolvedValue({ count: 1 });

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

  it('logs repair failures after enqueue fails', async () => {
    const enqueueError = new Error('redis down');
    const repairError = new Error('postgres down');
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
    mocks.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(repairError);
    mocks.enqueueCmsMediaProcessingJob.mockRejectedValue(enqueueError);

    const response = await POST(finalizeRequest(), routeProps());

    await expect(response.json()).resolves.toEqual({
      error: 'processing_queue_unavailable',
    });
    expect(response.status).toBe(503);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Failed to repair CMS media asset queue state: {error}',
      {
        assetId: 'asset-1',
        error: repairError,
        processingErrorCode: null,
      }
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

  it('returns unavailable when tusd status response is invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 500 }))
    );
    stubAdminUser();
    mocks.findUnique.mockResolvedValue(asset());

    const response = await POST(finalizeRequest(), routeProps());

    await expect(response.json()).resolves.toEqual({
      error: 'upload_status_unavailable',
    });
    expect(response.status).toBe(503);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'tusd upload status unavailable before finalize',
      { assetId: 'asset-1' }
    );
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('returns unavailable when the tusd status helper throws', async () => {
    const error = new Error('unexpected tus status failure');
    mocks.useMockTusStatus = true;
    mocks.getCmsMediaTusUploadStatus.mockRejectedValue(error);
    stubAdminUser();
    mocks.findUnique.mockResolvedValue(asset());

    const response = await POST(finalizeRequest(), routeProps());

    await expect(response.json()).resolves.toEqual({
      error: 'upload_status_unavailable',
    });
    expect(response.status).toBe(503);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Failed to read tusd upload status before finalize: {error}',
      { assetId: 'asset-1', error }
    );
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });

  it('returns 503 when tusd status cannot be read', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new Error('network down'))
    );
    stubAdminUser();
    mocks.findUnique.mockResolvedValue(asset());

    const response = await POST(finalizeRequest(), routeProps());

    await expect(response.json()).resolves.toEqual({
      error: 'upload_status_unavailable',
    });
    expect(response.status).toBe(503);
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.enqueueCmsMediaProcessingJob).not.toHaveBeenCalled();
  });
});
