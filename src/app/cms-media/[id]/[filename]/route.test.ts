import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  loggerError: vi.fn(),
  mediaPublicBaseUrl: undefined as string | undefined,
  mediaRoot: `${process.cwd()}/test-results/cms-media-route-test-${process.pid}`,
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    cmsMediaAsset: {
      findUnique: mocks.findUnique,
    },
  },
}));

vi.mock('@/libs/Env', () => ({
  Env: {
    CMS_MEDIA_ROOT: mocks.mediaRoot,
    get MEDIA_PUBLIC_BASE_URL() {
      return mocks.mediaPublicBaseUrl;
    },
    MEDIA_STORAGE_ROOT: mocks.mediaRoot,
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: mocks.loggerError,
  },
}));

const assetId = 'asset-1';
const filename = 'race-day.png';
const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

function routeProps() {
  return {
    params: Promise.resolve({ filename, id: assetId }),
  };
}

function readyFilePath() {
  return path.join(mocks.mediaRoot, 'ready', assetId, filename);
}

function readyAsset(
  props: {
    mimeType?: string;
    readyFilePath?: string | null;
    storageProvider?: 'local' | 'server_folder';
  } = {}
) {
  return {
    mimeType: props.mimeType ?? 'image/png',
    publicPath: `/cms-media/${assetId}/${filename}`,
    readyFilePath: props.readyFilePath ?? readyFilePath(),
    status: 'ready',
    storageProvider: props.storageProvider ?? 'server_folder',
    storedFilename: filename,
  };
}

describe('cms media route', () => {
  beforeEach(async () => {
    await rm(mocks.mediaRoot, { force: true, recursive: true });
    mocks.mediaPublicBaseUrl = undefined;
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await rm(mocks.mediaRoot, { force: true, recursive: true });
  });

  it('serves server-folder media from the ready storage path', async () => {
    const filePath = readyFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes);
    mocks.findUnique.mockResolvedValue(readyAsset());

    const response = await GET(
      new Request(`https://mitsailing.test/cms-media/${assetId}/${filename}`),
      routeProps()
    );

    await expect(response.arrayBuffer()).resolves.toEqual(bytes.buffer);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
  });

  it('does not serve server-folder media from an unexpected ready file path', async () => {
    const filePath = readyFilePath();
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes);
    mocks.findUnique.mockResolvedValue(
      readyAsset({
        readyFilePath: path.join(mocks.mediaRoot, 'other', assetId, filename),
      })
    );

    const response = await GET(
      new Request(`https://mitsailing.test/cms-media/${assetId}/${filename}`),
      routeProps()
    );

    expect(response.status).toBe(404);
  });

  it('returns not found when the ready file is missing from storage', async () => {
    mocks.findUnique.mockResolvedValue(readyAsset());

    const response = await GET(
      new Request(`https://mitsailing.test/cms-media/${assetId}/${filename}`),
      routeProps()
    );

    expect(response.status).toBe(404);
  });

  it('returns not found when the media record does not match the request', async () => {
    mocks.findUnique.mockResolvedValue({
      ...readyAsset(),
      publicPath: `/cms-media/${assetId}/other.png`,
      storedFilename: 'other.png',
    });

    const response = await GET(
      new Request(`https://mitsailing.test/cms-media/${assetId}/${filename}`),
      routeProps()
    );

    expect(response.status).toBe(404);
  });

  it('returns not found when the media record is not ready', async () => {
    mocks.findUnique.mockResolvedValue({
      ...readyAsset(),
      status: 'processing',
    });

    const response = await GET(
      new Request(`https://mitsailing.test/cms-media/${assetId}/${filename}`),
      routeProps()
    );

    expect(response.status).toBe(404);
  });

  it('redirects server-folder media to the public media origin when configured', async () => {
    mocks.mediaPublicBaseUrl = 'https://media.mitsailing.test/';
    mocks.findUnique.mockResolvedValue(readyAsset());

    const response = await GET(
      new Request(`https://mitsailing.test/cms-media/${assetId}/${filename}`),
      routeProps()
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      `https://media.mitsailing.test/cms-media/${assetId}/${filename}`
    );
  });

  it('serves local media with an octet-stream fallback for unknown mime types', async () => {
    const filePath = path.join(mocks.mediaRoot, assetId, filename);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, bytes);
    mocks.findUnique.mockResolvedValue(
      readyAsset({
        mimeType: 'image/svg+xml',
        readyFilePath: null,
        storageProvider: 'local',
      })
    );

    const response = await GET(
      new Request(`https://mitsailing.test/cms-media/${assetId}/${filename}`),
      routeProps()
    );

    await expect(response.arrayBuffer()).resolves.toEqual(bytes.buffer);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'application/octet-stream'
    );
  });

  it('returns server error when the media asset lookup fails', async () => {
    const error = new Error('database unavailable');
    mocks.findUnique.mockRejectedValue(error);

    const response = await GET(
      new Request(`https://mitsailing.test/cms-media/${assetId}/${filename}`),
      routeProps()
    );

    expect(response.status).toBe(500);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Failed to fetch CMS media asset: {error}',
      { error }
    );
  });

  it('returns server error when the ready file cannot be read', async () => {
    const filePath = readyFilePath();
    await mkdir(filePath, { recursive: true });
    mocks.findUnique.mockResolvedValue(readyAsset());

    const response = await GET(
      new Request(`https://mitsailing.test/cms-media/${assetId}/${filename}`),
      routeProps()
    );

    expect(response.status).toBe(500);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Failed to read CMS media file: {error}',
      { error: expect.any(Error) }
    );
  });
});
