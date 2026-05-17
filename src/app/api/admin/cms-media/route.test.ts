import { describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/libs/auth/dal', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    cmsMediaAsset: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/libs/Env', () => ({
  Env: {
    APP_ENV: 'staging',
    CMS_MEDIA_ROOT: '/srv/mitsailing-test-cms-media',
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('@/libs/mit-sailing/cmsMediaStorage', () => ({
  deleteCmsMediaFile: vi.fn(),
  writeCmsMediaFile: vi.fn(),
}));

function uploadRequest(): Request {
  return new Request('https://mitsailing.test/api/admin/cms-media', {
    method: 'POST',
  });
}

describe('cms media route', () => {
  it('forbids direct uploads outside local environments', async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
    });

    const response = await POST(uploadRequest());

    await expect(response.json()).resolves.toEqual({
      error: 'direct_upload_disabled',
    });
    expect(response.status).toBe(403);
  });
});
