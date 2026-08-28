import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as CmsMediaTusStatusModule from '@/libs/mit-sailing/cmsMediaTusStatus';

const loggerError = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: loggerError,
  },
}));

let getCmsMediaTusUploadStatus: typeof CmsMediaTusStatusModule.getCmsMediaTusUploadStatus;

beforeEach(async () => {
  vi.resetModules();
  ({ getCmsMediaTusUploadStatus } =
    await import('@/libs/mit-sailing/cmsMediaTusStatus'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  loggerError.mockClear();
});

function headResponse(headers: Record<string, string>, status = 200): Response {
  return new Response(null, {
    headers,
    status,
  });
}

describe('cms media tus status', () => {
  it('returns complete when offset and length match the expected byte size', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        headResponse({ 'Upload-Length': '1024', 'Upload-Offset': '1024' })
      );
    vi.stubGlobal('fetch', fetchMock);

    const status = await getCmsMediaTusUploadStatus({
      assetId: 'asset-1',
      baseUrl: 'https://mitsailing.com',
      byteSize: 1024,
    });

    expect(status).toEqual({ complete: true });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://mitsailing.com/cms-media/uploads/asset-1',
      expect.objectContaining({
        method: 'HEAD',
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('returns incomplete when the offset is behind the expected byte size', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          headResponse({ 'Upload-Length': '1024', 'Upload-Offset': '512' })
        )
    );

    await expect(
      getCmsMediaTusUploadStatus({
        assetId: 'asset-1',
        baseUrl: 'https://mitsailing.com',
        byteSize: 1024,
      })
    ).resolves.toEqual({
      complete: false,
      reason: 'upload_incomplete',
    });
  });

  it('returns incomplete when tus headers are missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(headResponse({}))
    );

    await expect(
      getCmsMediaTusUploadStatus({
        assetId: 'asset-1',
        baseUrl: 'https://mitsailing.com',
        byteSize: 1024,
      })
    ).resolves.toEqual({
      complete: false,
      reason: 'missing_upload_headers',
    });
  });

  it('returns incomplete when tusd cannot find the upload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(headResponse({}, 404))
    );

    await expect(
      getCmsMediaTusUploadStatus({
        assetId: 'asset-1',
        baseUrl: 'https://mitsailing.com',
        byteSize: 1024,
      })
    ).resolves.toEqual({
      complete: false,
      reason: 'upload_not_found',
    });
  });

  it('returns incomplete when the tus status request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new Error('network down'))
    );

    await expect(
      getCmsMediaTusUploadStatus({
        assetId: 'asset-1',
        baseUrl: 'https://mitsailing.com',
        byteSize: 1024,
      })
    ).resolves.toEqual({
      complete: false,
      reason: 'upload_status_unavailable',
    });
    expect(loggerError).toHaveBeenCalledWith(
      'Failed to read CMS media tus upload status: {error}',
      expect.objectContaining({
        assetId: 'asset-1',
        error: expect.any(Error),
      })
    );
  });
});
