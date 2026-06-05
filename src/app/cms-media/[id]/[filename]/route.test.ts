import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  loggerError: vi.fn(),
  mediaRoot: `${process.cwd()}/local/cms-media-route-test`,
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

function readyAsset(props: { readyFilePath?: string | null } = {}) {
  return {
    mimeType: 'image/png',
    publicPath: `/cms-media/${assetId}/${filename}`,
    readyFilePath: props.readyFilePath ?? readyFilePath(),
    status: 'ready',
    storageProvider: 'server_folder',
    storedFilename: filename,
  };
}

describe('cms media route', () => {
  beforeEach(async () => {
    await rm(mocks.mediaRoot, { force: true, recursive: true });
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
});
