import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  findUnique: vi.fn(),
  getCurrentUser: vi.fn(),
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
    MEDIA_UPLOAD_SHARED_SECRET:
      'test-upload-secret-with-at-least-thirty-two-chars',
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

function uploadSessionRequest(): Request {
  return new Request('https://mitsailing.test/api/admin/cms-media/uploads', {
    body: JSON.stringify({
      byteSize: 1024,
      originalFilename: 'race-day.png',
      pageId: null,
      type: 'image/png',
    }),
    method: 'POST',
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
});
