import { afterEach, describe, expect, it, vi } from 'vitest';
import { uploadCmsMediaFile } from './AdminCmsMediaControlsApi';
import { uploadCmsMediaWithTus } from './cmsMediaTusUpload';

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
        return Response.json({
          asset: {
            createdAt: '2026-05-17T12:00:00.000Z',
            id: 'session-asset',
            originalFilename: file.name,
            publicPath: '/cms-media/session-asset.png',
          },
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
        return Response.json({
          asset: {
            createdAt: '2026-05-17T12:00:00.000Z',
            id: 'session-asset',
            originalFilename: file.name,
            publicPath: '/cms-media/session-asset.png',
          },
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
      '/api/admin/cms-media/uploads/session-asset/finalize',
      { method: 'POST' }
    );
  });
});
