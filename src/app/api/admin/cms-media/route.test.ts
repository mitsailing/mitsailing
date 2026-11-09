import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

const mocks = vi.hoisted(() => ({
  appEnv: 'staging',
  create: vi.fn(),
  deleteCmsMediaFile: vi.fn(),
  findMany: vi.fn(),
  getCurrentUser: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
  processCmsMediaImageBytes: vi.fn(),
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

vi.mock('@/libs/mit-sailing/cmsMediaImageProcessing', () => ({
  processCmsMediaImageBytes: mocks.processCmsMediaImageBytes,
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

function stubDockStaffUser() {
  mocks.getCurrentUser.mockResolvedValue({
    id: 'dock-1',
    role: 'dock_staff',
  });
}

function mediaListRequest() {
  return new Request('https://mitsailing.test/api/admin/cms-media');
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

function uploadFormData(props: { file?: File } = {}) {
  const formData = new FormData();
  if (props.file) {
    formData.set('file', props.file);
  }
  return formData;
}

function pngFile() {
  return new File([pngBytes], 'Race Day.png', { type: 'image/png' });
}

function pdfFile() {
  return new File(
    [new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])],
    'notes.pdf',
    {
      type: 'application/pdf',
    }
  );
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

  it('lists ready media for admin-area users', async () => {
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

    const response = await GET(mediaListRequest());

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
        where: { status: 'ready' },
      })
    );
  });

  it('forbids signed-in users without admin view from listing media', async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: 'user-1',
      role: 'user',
    });

    const response = await GET(mediaListRequest());

    await expect(response.json()).resolves.toEqual({ error: 'forbidden' });
    expect(response.status).toBe(403);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it('lists media for volunteer instructors with admin view', async () => {
    mocks.getCurrentUser.mockResolvedValue({
      id: 'volunteer-1',
      role: 'volunteer_instructor',
    });
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

    const response = await POST(
      uploadRequest(uploadFormData({ file: pngFile() }))
    );

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

    const response = await POST(
      uploadRequest(uploadFormData({ file: pngFile() }))
    );

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

  it('returns a storage error when the direct upload file cannot be written', async () => {
    const error = new Error('disk full');
    mocks.appEnv = 'local';
    stubAdminUser();
    mocks.processCmsMediaImageBytes.mockResolvedValue({
      byteSize: pngBytes.byteLength,
      bytes: pngBytes,
      mimeType: 'image/png',
      storedFilename: 'race-day.png',
    });
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
    mocks.processCmsMediaImageBytes.mockResolvedValue({
      byteSize: pngBytes.byteLength,
      bytes: pngBytes,
      mimeType: 'image/png',
      storedFilename: 'race-day.png',
    });
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
    mocks.processCmsMediaImageBytes.mockResolvedValue({
      byteSize: pngBytes.byteLength,
      bytes: pngBytes,
      mimeType: 'image/png',
      storedFilename: 'race-day.png',
    });
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

  it('creates a local direct upload asset for admins', async () => {
    const createdAt = new Date(Date.UTC(2026, 4, 17, 12));
    mocks.appEnv = 'local';
    stubAdminUser();
    mocks.processCmsMediaImageBytes.mockResolvedValue({
      byteSize: pngBytes.byteLength,
      bytes: pngBytes,
      mimeType: 'image/png',
      storedFilename: 'race-day.png',
    });
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
      uploadRequest(uploadFormData({ file: pngFile() }))
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
          status: 'ready',
          storageProvider: 'local',
          uploadedByUserId: 'admin-1',
        }),
      })
    );
  });

  it('creates a local PDF upload for dock staff', async () => {
    const createdAt = new Date(Date.UTC(2026, 4, 17, 12));
    const pdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52]);
    mocks.appEnv = 'local';
    stubDockStaffUser();
    mocks.writeCmsMediaFile.mockResolvedValue(
      '/var/lib/mitsailing/cms-media/ready/asset-2/notes.pdf'
    );
    mocks.create.mockResolvedValue({
      byteSize: BigInt(pdfBytes.byteLength),
      createdAt,
      id: 'asset-2',
      mimeType: 'application/pdf',
      originalFilename: 'notes.pdf',
      publicPath: '/cms-media/asset-2/notes.pdf',
    });

    const response = await POST(
      uploadRequest(uploadFormData({ file: pdfFile() }))
    );

    await expect(response.json()).resolves.toEqual({
      byteSize: pdfBytes.byteLength,
      createdAt: createdAt.toISOString(),
      id: 'asset-2',
      mimeType: 'application/pdf',
      originalFilename: 'notes.pdf',
      publicPath: '/cms-media/asset-2/notes.pdf',
      url: '/cms-media/asset-2/notes.pdf',
    });
    expect(response.status).toBe(200);
    expect(mocks.processCmsMediaImageBytes).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mediaKind: 'file',
        }),
      })
    );
  });
});
