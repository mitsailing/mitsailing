import { afterEach, describe, expect, it, vi } from 'vitest';
import { DELETE } from './route';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  getCurrentUser: vi.fn(),
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

afterEach(() => {
  vi.clearAllMocks();
});

function routeProps() {
  return {
    params: Promise.resolve({ id: 'asset-1' }),
  };
}

function cancelRequest(): Request {
  return new Request(
    'https://mitsailing.test/api/admin/cms-media/uploads/asset-1',
    {
      method: 'DELETE',
    }
  );
}

function asset(
  status: 'failed' | 'processing' | 'queued' | 'ready' | 'uploading',
  processingErrorCode: string | null = null
) {
  return {
    byteSize: BigInt(Number.parseInt('1024', 10)),
    createdAt: new Date(Date.UTC(2026, 4, 17, 12)),
    id: 'asset-1',
    mediaKind: 'image',
    mimeType: 'image/png',
    originalFilename: 'Race Day.png',
    processingErrorCode,
    publicPath: '/cms-media/asset-1/race-day.png',
    status,
  };
}

function stubAdminUser(): void {
  mocks.getCurrentUser.mockResolvedValue({
    id: 'admin-1',
    role: 'admin',
  });
}

describe('cms media upload route', () => {
  it('marks uploading assets as cancelled', async () => {
    stubAdminUser();
    mocks.findUnique.mockResolvedValue(asset('uploading'));
    mocks.update.mockResolvedValue(asset('failed', 'upload_cancelled'));

    const response = await DELETE(cancelRequest(), routeProps());

    await expect(response.json()).resolves.toMatchObject({
      asset: {
        id: 'asset-1',
        processingErrorCode: 'upload_cancelled',
        status: 'failed',
      },
    });
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          processingErrorCode: 'upload_cancelled',
          status: 'failed',
        },
        where: { id: 'asset-1' },
      })
    );
  });

  it('does not cancel assets that already left uploading', async () => {
    stubAdminUser();
    mocks.findUnique.mockResolvedValue(asset('queued'));

    const response = await DELETE(cancelRequest(), routeProps());

    await expect(response.json()).resolves.toEqual({
      error: 'upload_not_cancellable',
    });
    expect(response.status).toBe(409);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
