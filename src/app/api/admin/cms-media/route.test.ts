import { describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  loggerWarn: vi.fn(),
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
    CMS_MEDIA_ROOT: '.test-cms-media-unused',
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: vi.fn(),
    warn: mocks.loggerWarn,
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
  it('rejects unauthenticated direct uploads before storage checks', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await POST(uploadRequest());

    await expect(response.json()).resolves.toEqual({
      error: 'unauthorized',
    });
    expect(response.status).toBe(401);
    expect(mocks.loggerWarn).not.toHaveBeenCalled();
  });

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
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Blocked direct CMS media upload outside local app environment',
      {
        appEnv: 'staging',
        userId: 'admin-1',
      }
    );
  });
});
