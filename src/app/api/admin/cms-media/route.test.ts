import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

const mocks = vi.hoisted(() => ({
  appEnv: 'staging',
  create: vi.fn(),
  deleteCmsMediaFile: vi.fn(),
  findMany: vi.fn(),
  findPageUnique: vi.fn(),
  getCurrentUser: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  writeCmsMediaFile: vi.fn(),
}));

vi.mock('@/libs/auth/dal', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    cmsMediaAsset: {
      create: mocks.create,
      findMany: mocks.findMany,
    },
    cmsPage: {
      findUnique: mocks.findPageUnique,
    },
  },
}));

vi.mock('@/libs/Env', () => ({
  Env: {
    get APP_ENV() {
      return mocks.appEnv;
    },
    CMS_MEDIA_ROOT: '.test-cms-media-unused',
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
  },
}));

vi.mock('@/libs/mit-sailing/cmsMediaStorage', () => ({
  deleteCmsMediaFile: mocks.deleteCmsMediaFile,
  writeCmsMediaFile: mocks.writeCmsMediaFile,
}));

const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const storedRaceDayPngPath =
  '/var/lib/mitsailing/cms-media/ready/asset-1/race-day.png';

function stubAdminUser() {
  mocks.getCurrentUser.mockResolvedValue({
    id: 'admin-1',
    role: 'admin',
  });
}

function mediaListRequest(pageId?: string): Request {
  const url = new URL('https://mitsailing.test/api/admin/cms-media');
  if (pageId) {
    url.searchParams.set('pageId', pageId);
  }
  return new Request(url);
}

function uploadRequest(body?: BodyInit, contentType?: string): Request {
  const headers = new Headers();
  if (contentType) {
    headers.set('Content-Type', contentType);
  }
  return new Request('https://mitsailing.test/api/admin/cms-media', {
    body,
    headers,
    method: 'POST',
  });
}

function uploadFormData(props: { file?: File; pageId?: string } = {}) {
  const formData = new FormData();
  if (props.file) {
    formData.set('file', props.file);
  }
  if (props.pageId !== undefined) {
    formData.set('pageId', props.pageId);
  }
  return formData;
}

function pngFile() {
  return new File([pngBytes], 'Race Day.png', { type: 'image/png' });
}

describe('cms media route', () => {
  afterEach(() => {
    mocks.appEnv = 'staging';
    vi.clearAllMocks();
  });

  it('rejects unauthenticated media list reads', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await GET(mediaListRequest());

    await expect(response.json()).resolves.toEqual({
      error: 'unauthorized',
    });
    expect(response.status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it('lists ready media for the requested CMS page', async () => {
    const createdAt = new Date(Date.UTC(2026, 4, 17, 12));
    stubAdminUser();
    mocks.findMany.mockResolvedValue([
      {
        byteSize: BigInt(Number.parseInt('1024', 10)),
        createdAt,
        id: 'asset-1',
        mimeType: 'image/png',
        originalFilename: 'Race Day.png',
        publicPath: '/cms-media/asset-1/race-day.png',
      },
    ]);

    const response = await GET(mediaListRequest(' cms-home '));

    await expect(response.json()).resolves.toEqual({
      assets: [
        {
          byteSize: 1024,
          createdAt: createdAt.toISOString(),
          id: 'asset-1',
          mimeType: 'image/png',
          originalFilename: 'Race Day.png',
          publicPath: '/cms-media/asset-1/race-day.png',
        },
      ],
    });
    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 100,
        where: { pageId: 'cms-home', status: 'ready' },
      })
    );
  });

  it('lists ready media across pages when no CMS page is requested', async () => {
    stubAdminUser();
    mocks.findMany.mockResolvedValue([]);

    const response = await GET(mediaListRequest());

    await expect(response.json()).resolves.toEqual({ assets: [] });
    expect(response.status).toBe(200);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'ready' },
      })
    );
  });

  it('rejects unauthenticated direct uploads before storage checks', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await POST(uploadRequest());

    await expect(response.json()).resolves.toEqual({
      error: 'unauthorized',
    });
    expect(response.status).toBe(401);
    expect(mocks.loggerWarn).not.toHaveBeenCalled();
  });

  it('rejects invalid direct upload form data', async () => {
    mocks.appEnv = 'local';
    stubAdminUser();

    const response = await POST(uploadRequest('{}', 'application/json'));

    await expect(response.json()).resolves.toEqual({
      error: 'invalid_form_data',
    });
    expect(response.status).toBe(400);
    expect(mocks.writeCmsMediaFile).not.toHaveBeenCalled();
  });

  it('forbids direct uploads outside local environments', async () => {
    stubAdminUser();

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

  it('rejects direct uploads without a file', async () => {
    mocks.appEnv = 'local';
    stubAdminUser();

    const response = await POST(uploadRequest(uploadFormData()));

    await expect(response.json()).resolves.toEqual({
      error: 'missing_file',
    });
    expect(response.status).toBe(400);
    expect(mocks.writeCmsMediaFile).not.toHaveBeenCalled();
  });

  it('rejects unsupported direct upload file types', async () => {
    mocks.appEnv = 'local';
    stubAdminUser();

    const response = await POST(
      uploadRequest(
        uploadFormData({
          file: new File(['plain text'], 'notes.txt', { type: 'text/plain' }),
        })
      )
    );

    await expect(response.json()).resolves.toEqual({
      error: 'unsupported_type',
    });
    expect(response.status).toBe(415);
    expect(mocks.writeCmsMediaFile).not.toHaveBeenCalled();
  });

  it('rejects direct uploads for unknown CMS pages', async () => {
    mocks.appEnv = 'local';
    stubAdminUser();
    mocks.findPageUnique.mockResolvedValue(null);

    const response = await POST(
      uploadRequest(uploadFormData({ file: pngFile(), pageId: 'missing-page' }))
    );

    await expect(response.json()).resolves.toEqual({
      error: 'invalid_page',
    });
    expect(response.status).toBe(400);
    expect(mocks.findPageUnique).toHaveBeenCalledWith({
      select: { id: true },
      where: { id: 'missing-page' },
    });
    expect(mocks.writeCmsMediaFile).not.toHaveBeenCalled();
  });

  it('returns a storage error when the direct upload file cannot be written', async () => {
    const error = new Error('disk full');
    mocks.appEnv = 'local';
    stubAdminUser();
    mocks.writeCmsMediaFile.mockRejectedValue(error);

    const response = await POST(
      uploadRequest(uploadFormData({ file: pngFile() }))
    );

    await expect(response.json()).resolves.toEqual({
      error: 'storage_failed',
    });
    expect(response.status).toBe(500);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Failed to write CMS media file: {error}',
      { error }
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('returns an unsafe path error when direct storage rejects the file path', async () => {
    mocks.appEnv = 'local';
    stubAdminUser();
    mocks.writeCmsMediaFile.mockResolvedValue(null);

    const response = await POST(
      uploadRequest(uploadFormData({ file: pngFile() }))
    );

    await expect(response.json()).resolves.toEqual({
      error: 'unsafe_storage_path',
    });
    expect(response.status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('cleans up direct upload files when the asset record cannot be created', async () => {
    const error = new Error('postgres down');
    mocks.appEnv = 'local';
    stubAdminUser();
    mocks.writeCmsMediaFile.mockResolvedValue(storedRaceDayPngPath);
    mocks.create.mockRejectedValue(error);

    const response = await POST(
      uploadRequest(uploadFormData({ file: pngFile() }))
    );

    await expect(response.json()).resolves.toEqual({
      error: 'asset_create_failed',
    });
    expect(response.status).toBe(500);
    expect(mocks.deleteCmsMediaFile).toHaveBeenCalledWith(
      expect.objectContaining({ filename: 'race-day.png' })
    );
    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Failed to record CMS media asset: {error}',
      { error }
    );
  });

  it('logs cleanup failures while preserving direct upload create failure', async () => {
    const createError = new Error('postgres down');
    const cleanupError = new Error('unlink failed');
    mocks.appEnv = 'local';
    stubAdminUser();
    mocks.writeCmsMediaFile.mockResolvedValue(storedRaceDayPngPath);
    mocks.create.mockRejectedValue(createError);
    mocks.deleteCmsMediaFile.mockRejectedValue(cleanupError);

    const response = await POST(
      uploadRequest(uploadFormData({ file: pngFile() }))
    );

    await expect(response.json()).resolves.toEqual({
      error: 'asset_create_failed',
    });
    expect(response.status).toBe(500);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Failed to remove orphaned CMS media file: {error}',
      { error: cleanupError }
    );
    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Failed to record CMS media asset: {error}',
      { error: createError }
    );
  });

  it('creates a local direct upload asset for admins', async () => {
    const createdAt = new Date(Date.UTC(2026, 4, 17, 12));
    mocks.appEnv = 'local';
    stubAdminUser();
    mocks.findPageUnique.mockResolvedValue({ id: 'cms-home' });
    mocks.writeCmsMediaFile.mockResolvedValue(storedRaceDayPngPath);
    mocks.create.mockResolvedValue({
      byteSize: BigInt(pngBytes.byteLength),
      createdAt,
      id: 'asset-1',
      mimeType: 'image/png',
      originalFilename: 'Race Day.png',
      publicPath: '/cms-media/asset-1/race-day.png',
    });

    const response = await POST(
      uploadRequest(uploadFormData({ file: pngFile(), pageId: ' cms-home ' }))
    );

    await expect(response.json()).resolves.toEqual({
      byteSize: pngBytes.byteLength,
      createdAt: createdAt.toISOString(),
      id: 'asset-1',
      mimeType: 'image/png',
      originalFilename: 'Race Day.png',
      publicPath: '/cms-media/asset-1/race-day.png',
      url: '/cms-media/asset-1/race-day.png',
    });
    expect(response.status).toBe(200);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mediaKind: 'image',
          pageId: 'cms-home',
          status: 'ready',
          storageProvider: 'local',
          uploadedByUserId: 'admin-1',
        }),
      })
    );
  });
});
