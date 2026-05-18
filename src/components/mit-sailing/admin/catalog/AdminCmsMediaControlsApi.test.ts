import * as Sentry from '@sentry/nextjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadCmsMediaFile } from './AdminCmsMediaControlsApi';
import { uploadCmsMediaWithTus } from './cmsMediaTusUpload';

vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
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

function uploadSessionResponse(file: File) {
  return Response.json({
    asset: uploadSessionAsset(file),
    upload: {
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
    },
  });
}

describe('uploadCmsMediaFile', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
      '/api/admin/cms-media/uploads/resumed-asset/finalize',
      { method: 'POST' }
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
        level: 'warning',
        tags: { cmsMediaAction: 'finalizeUpload' },
      })
    );
  });
});
