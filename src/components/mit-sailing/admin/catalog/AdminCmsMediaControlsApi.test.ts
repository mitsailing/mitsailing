import * as Sentry from '@sentry/nextjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isAdminImagePath,
  uploadCmsMediaFile,
} from './AdminCmsMediaControlsApi';
import { uploadCmsMediaWithTus } from './cmsMediaTusUpload';

const loggerMocks = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: loggerMocks.error,
    warn: loggerMocks.warn,
  },
}));

vi.mock(import('./cmsMediaTusUpload'), () => ({
  uploadCmsMediaWithTus: vi.fn(),
}));

function fetchInputPath(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.pathname;
  }
  return input.url;
}

function uploadSessionAsset(file: File) {
  return {
    createdAt: '2026-05-17T12:00:00.000Z',
    id: 'session-asset',
    originalFilename: file.name,
    publicPath: '/cms-media/session-asset.png',
  };
}

function uploadSessionDetails(file: File) {
  return {
    byteSize: file.size,
    endpoint: '/uploads',
    expiresAt: '2026-05-17T12:05:00.000Z',
    headers: { Authorization: 'Bearer test-token' },
    metadata: {
      assetId: 'session-asset',
      byteSize: String(file.size),
      filename: file.name,
      filetype: file.type,
      token: 'test-token',
    },
    protocol: 'tus',
  };
}

function uploadSessionResponse(
  file: File,
  props: {
    asset?: unknown;
    upload?: unknown;
  } = {}
) {
  return Response.json({
    asset: props.asset ?? uploadSessionAsset(file),
    upload: props.upload ?? uploadSessionDetails(file),
  });
}

describe('uploadCmsMediaFile', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('filters non-string admin image paths', () => {
    const missingPath = new Map<string, string>().get('missing');
    expect(isAdminImagePath(missingPath)).toBe(false);
    expect(isAdminImagePath('/cms-media/hero.png')).toBe(true);
  });

  it('cancels session asset without finalizing resumed asset mismatch', async () => {
    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });
    vi.mocked(uploadCmsMediaWithTus).mockResolvedValue({
      assetId: 'resumed-asset',
    });

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = fetchInputPath(input);
      if (path === '/api/admin/cms-media/uploads' && init?.method === 'POST') {
        await Promise.resolve();
        return uploadSessionResponse(file);
      }
      if (
        path === '/api/admin/cms-media/uploads/resumed-asset/finalize' &&
        init?.method === 'POST'
      ) {
        await Promise.resolve();
        return Response.json({
          asset: {
            createdAt: '2026-05-17T12:00:00.000Z',
            id: 'resumed-asset',
            originalFilename: file.name,
            publicPath: '/cms-media/resumed-asset.png',
          },
        });
      }
      await Promise.resolve();
      return Response.json({ asset: null });
    });
    vi.stubGlobal('fetch', fetchMock);

    const asset = await uploadCmsMediaFile({ file });

    expect(asset).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/cms-media/uploads/session-asset',
      { method: 'DELETE' }
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/api\/admin\/cms-media\/uploads\/[^/]+\/finalize$/u
      ),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('skips cancellation fetches for unsafe session asset ids', async () => {
    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });
    vi.mocked(uploadCmsMediaWithTus).mockRejectedValueOnce(
      new Error('Upload failed')
    );

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = fetchInputPath(input);
      if (path === '/api/admin/cms-media/uploads' && init?.method === 'POST') {
        await Promise.resolve();
        return uploadSessionResponse(file, {
          asset: {
            ...uploadSessionAsset(file),
            id: 'unsafe/asset',
          },
        });
      }
      await Promise.resolve();
      return Response.json({ asset: null });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadCmsMediaFile({ file })).rejects.toThrow('Upload failed');

    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/admin/cms-media/uploads/unsafe%2Fasset',
      { method: 'DELETE' }
    );
  });

  it('cancels session asset when resumable upload fails', async () => {
    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });
    vi.mocked(uploadCmsMediaWithTus).mockRejectedValueOnce(
      new Error('Upload failed')
    );

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = fetchInputPath(input);
      if (path === '/api/admin/cms-media/uploads' && init?.method === 'POST') {
        await Promise.resolve();
        return uploadSessionResponse(file);
      }
      await Promise.resolve();
      return Response.json({ asset: null });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadCmsMediaFile({ file })).rejects.toThrow('Upload failed');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/cms-media/uploads/session-asset',
      { method: 'DELETE' }
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/api\/admin\/cms-media\/uploads\/[^/]+\/finalize$/u
      ),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('rejects malformed resumable upload session details', async () => {
    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = fetchInputPath(input);
      if (path === '/api/admin/cms-media/uploads' && init?.method === 'POST') {
        await Promise.resolve();
        return uploadSessionResponse(file, {
          upload: {
            ...uploadSessionDetails(file),
            byteSize: Number.NaN,
            headers: { Authorization: 123 },
          },
        });
      }
      await Promise.resolve();
      return Response.json({ asset: null });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadCmsMediaFile({ file })).rejects.toThrow(
      'CMS media upload session response invalid'
    );
    expect(uploadCmsMediaWithTus).not.toHaveBeenCalled();
  });

  it('preserves upload error when cancel fails', async () => {
    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });
    const uploadError = new Error('Upload failed');
    const cancelError = new Error('Cancel failed');
    vi.mocked(uploadCmsMediaWithTus).mockRejectedValueOnce(uploadError);

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = fetchInputPath(input);
      if (path === '/api/admin/cms-media/uploads' && init?.method === 'POST') {
        await Promise.resolve();
        return uploadSessionResponse(file);
      }
      if (
        path === '/api/admin/cms-media/uploads/session-asset' &&
        init?.method === 'DELETE'
      ) {
        await Promise.resolve();
        throw cancelError;
      }
      await Promise.resolve();
      return Response.json({ asset: null });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadCmsMediaFile({ file })).rejects.toThrow('Upload failed');

    expect(Sentry.captureException).toHaveBeenCalledWith(
      cancelError,
      expect.objectContaining({
        tags: { cmsMediaAction: 'cancelUpload' },
      })
    );
    expect(loggerMocks.error).toHaveBeenCalledWith(
      'Failed to cancel CMS media upload: {error}',
      { assetId: 'session-asset', error: cancelError }
    );
  });

  it('reports non-ok cancel response', async () => {
    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });
    vi.mocked(uploadCmsMediaWithTus).mockResolvedValue({
      assetId: 'resumed-asset',
    });

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = fetchInputPath(input);
      if (path === '/api/admin/cms-media/uploads' && init?.method === 'POST') {
        await Promise.resolve();
        return uploadSessionResponse(file);
      }
      if (
        path === '/api/admin/cms-media/uploads/session-asset' &&
        init?.method === 'DELETE'
      ) {
        await Promise.resolve();
        return new Response(null, {
          status: 500,
          statusText: 'Internal Server Error',
        });
      }
      await Promise.resolve();
      return Response.json({ asset: null });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadCmsMediaFile({ file })).resolves.toBeNull();

    const error = expect.objectContaining({
      message: 'CMS media upload cancel failed: 500 Internal Server Error',
    });
    expect(Sentry.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        tags: { cmsMediaAction: 'cancelUpload' },
      })
    );
    expect(loggerMocks.error).toHaveBeenCalledWith(
      'Failed to cancel CMS media upload: {error}',
      { assetId: 'session-asset', error }
    );
  });

  it('waits for queued session asset to become ready', async () => {
    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });
    vi.mocked(uploadCmsMediaWithTus).mockResolvedValue({
      assetId: 'session-asset',
    });
    let readinessRequests = 0;

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = fetchInputPath(input);
      if (path === '/api/admin/cms-media/uploads' && init?.method === 'POST') {
        await Promise.resolve();
        return uploadSessionResponse(file);
      }
      if (
        path === '/api/admin/cms-media/uploads/session-asset/finalize' &&
        init?.method === 'POST'
      ) {
        await Promise.resolve();
        return Response.json({
          asset: { ...uploadSessionAsset(file), status: 'queued' },
        });
      }
      if (path === '/api/admin/cms-media/uploads/session-asset') {
        readinessRequests += 1;
        if (readinessRequests === 1) {
          await Promise.resolve();
          return Response.json({
            asset: { ...uploadSessionAsset(file), status: 'processing' },
          });
        }
        await Promise.resolve();
        return Response.json({
          asset: { ...uploadSessionAsset(file), status: 'ready' },
        });
      }
      await Promise.resolve();
      return Response.json({ asset: null });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadCmsMediaFile({ file })).resolves.toEqual(
      expect.objectContaining({
        id: 'session-asset',
        originalFilename: 'hero.png',
        status: 'ready',
      })
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/cms-media/uploads/session-asset'
    );
    expect(readinessRequests).toBe(2);
  });

  it('reports finalize failure', async () => {
    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });
    vi.mocked(uploadCmsMediaWithTus).mockResolvedValue({
      assetId: 'session-asset',
    });

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = fetchInputPath(input);
      if (path === '/api/admin/cms-media/uploads' && init?.method === 'POST') {
        await Promise.resolve();
        return uploadSessionResponse(file);
      }
      if (
        path === '/api/admin/cms-media/uploads/session-asset/finalize' &&
        init?.method === 'POST'
      ) {
        await Promise.resolve();
        return new Response(null, { status: 500 });
      }
      await Promise.resolve();
      return Response.json({ asset: null });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadCmsMediaFile({ file })).resolves.toBeNull();

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'CMS media upload finalize failed',
      expect.objectContaining({
        level: 'error',
        tags: { cmsMediaAction: 'finalizeUpload' },
      })
    );
    expect(loggerMocks.error).toHaveBeenCalledWith(
      'CMS media upload finalize failed',
      {
        sessionAssetId: 'session-asset',
        uploadAssetId: 'session-asset',
      }
    );
  });

  it('falls back to direct upload when resumable uploads are unavailable', async () => {
    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = fetchInputPath(input);
      if (path === '/api/admin/cms-media/uploads' && init?.method === 'POST') {
        await Promise.resolve();
        return new Response(null, { status: 503 });
      }
      if (path === '/api/admin/cms-media' && init?.method === 'POST') {
        await Promise.resolve();
        return Response.json({
          asset: {
            createdAt: '2026-05-17T12:00:00.000Z',
            id: 'direct-asset',
            originalFilename: file.name,
            publicPath: '/cms-media/direct-asset.png',
          },
        });
      }
      await Promise.resolve();
      return Response.json({ asset: null });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadCmsMediaFile({ file })).resolves.toEqual(
      expect.objectContaining({
        id: 'direct-asset',
        originalFilename: 'hero.png',
      })
    );

    expect(uploadCmsMediaWithTus).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/cms-media',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('uploads direct fallback media with page context', async () => {
    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });
    const directFormDataValues: FormData[] = [];

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = fetchInputPath(input);
      if (path === '/api/admin/cms-media/uploads' && init?.method === 'POST') {
        await Promise.resolve();
        return new Response(null, { status: 503 });
      }
      if (path === '/api/admin/cms-media' && init?.method === 'POST') {
        if (init.body instanceof FormData) {
          directFormDataValues.push(init.body);
        }
        await Promise.resolve();
        return Response.json({
          createdAt: '2026-05-17T12:00:00.000Z',
          id: 'direct-asset',
          originalFilename: file.name,
          publicPath: '/cms-media/direct-asset.png',
        });
      }
      await Promise.resolve();
      return Response.json({ asset: null });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      uploadCmsMediaFile({ file, pageId: 'cms-page-1' })
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'direct-asset',
        originalFilename: 'hero.png',
      })
    );

    expect(directFormDataValues.at(0)?.get('pageId')).toBe('cms-page-1');
  });

  it('returns null when direct fallback upload is rejected', async () => {
    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = fetchInputPath(input);
      if (path === '/api/admin/cms-media/uploads' && init?.method === 'POST') {
        await Promise.resolve();
        return new Response(null, { status: 503 });
      }
      if (path === '/api/admin/cms-media' && init?.method === 'POST') {
        await Promise.resolve();
        return new Response(null, { status: 415 });
      }
      await Promise.resolve();
      return Response.json({ asset: null });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadCmsMediaFile({ file })).resolves.toBeNull();
  });

  it('parses direct fallback media from legacy response fields', async () => {
    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = fetchInputPath(input);
      if (path === '/api/admin/cms-media/uploads' && init?.method === 'POST') {
        await Promise.resolve();
        return new Response(null, { status: 503 });
      }
      if (path === '/api/admin/cms-media' && init?.method === 'POST') {
        await Promise.resolve();
        return Response.json({ url: '/cms-media/legacy-asset.png' });
      }
      await Promise.resolve();
      return Response.json({ asset: null });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadCmsMediaFile({ file })).resolves.toEqual(
      expect.objectContaining({
        id: '/cms-media/legacy-asset.png',
        originalFilename: 'hero.png',
        publicPath: '/cms-media/legacy-asset.png',
      })
    );
  });

  it('returns null when queued upload processing fails', async () => {
    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });
    vi.mocked(uploadCmsMediaWithTus).mockResolvedValue({
      assetId: 'session-asset',
    });

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = fetchInputPath(input);
      if (path === '/api/admin/cms-media/uploads' && init?.method === 'POST') {
        await Promise.resolve();
        return uploadSessionResponse(file);
      }
      if (
        path === '/api/admin/cms-media/uploads/session-asset/finalize' &&
        init?.method === 'POST'
      ) {
        await Promise.resolve();
        return Response.json({
          asset: { ...uploadSessionAsset(file), status: 'processing' },
        });
      }
      if (path === '/api/admin/cms-media/uploads/session-asset') {
        await Promise.resolve();
        return Response.json({
          asset: { ...uploadSessionAsset(file), status: 'failed' },
        });
      }
      await Promise.resolve();
      return Response.json({ asset: null });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadCmsMediaFile({ file })).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/cms-media/uploads/session-asset'
    );
  });

  it('returns null when queued upload readiness cannot be loaded', async () => {
    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });
    vi.mocked(uploadCmsMediaWithTus).mockResolvedValue({
      assetId: 'session-asset',
    });

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = fetchInputPath(input);
      if (path === '/api/admin/cms-media/uploads' && init?.method === 'POST') {
        await Promise.resolve();
        return uploadSessionResponse(file);
      }
      if (
        path === '/api/admin/cms-media/uploads/session-asset/finalize' &&
        init?.method === 'POST'
      ) {
        await Promise.resolve();
        return Response.json({
          asset: { ...uploadSessionAsset(file), status: 'queued' },
        });
      }
      if (path === '/api/admin/cms-media/uploads/session-asset') {
        await Promise.resolve();
        return new Response(null, { status: 500 });
      }
      await Promise.resolve();
      return Response.json({ asset: null });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadCmsMediaFile({ file })).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/cms-media/uploads/session-asset'
    );
  });

  it('returns null when queued upload readiness payload is invalid', async () => {
    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });
    vi.mocked(uploadCmsMediaWithTus).mockResolvedValue({
      assetId: 'session-asset',
    });

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = fetchInputPath(input);
      if (path === '/api/admin/cms-media/uploads' && init?.method === 'POST') {
        await Promise.resolve();
        return uploadSessionResponse(file);
      }
      if (
        path === '/api/admin/cms-media/uploads/session-asset/finalize' &&
        init?.method === 'POST'
      ) {
        await Promise.resolve();
        return Response.json({
          asset: { ...uploadSessionAsset(file), status: 'queued' },
        });
      }
      if (path === '/api/admin/cms-media/uploads/session-asset') {
        await Promise.resolve();
        return Response.json({ asset: { id: 'session-asset' } });
      }
      await Promise.resolve();
      return Response.json({ asset: null });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadCmsMediaFile({ file })).resolves.toBeNull();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/cms-media/uploads/session-asset'
    );
  });

  it('returns null when unsafe upload ids cannot be finalized', async () => {
    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });
    vi.mocked(uploadCmsMediaWithTus).mockResolvedValue({
      assetId: 'unsafe/asset',
    });

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const path = fetchInputPath(input);
      if (path === '/api/admin/cms-media/uploads' && init?.method === 'POST') {
        await Promise.resolve();
        return uploadSessionResponse(file, {
          asset: {
            ...uploadSessionAsset(file),
            id: 'unsafe/asset',
          },
        });
      }
      await Promise.resolve();
      return Response.json({ asset: null });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadCmsMediaFile({ file })).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/admin/cms-media/uploads/unsafe%2Fasset/finalize',
      { method: 'POST' }
    );
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'CMS media upload finalize failed',
      expect.objectContaining({
        tags: { cmsMediaAction: 'finalizeUpload' },
      })
    );
  });
});
