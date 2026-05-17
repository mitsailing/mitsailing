import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const update = vi.fn();
const findUnique = vi.fn();

vi.mock('@/libs/DB', () => ({
  prisma: {
    cmsMediaAsset: {
      findUnique,
      update,
    },
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

let mediaRoot: string | null = null;

afterEach(async () => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
  if (mediaRoot) {
    await rm(mediaRoot, { force: true, recursive: true });
    mediaRoot = null;
  }
});

async function createMediaRoot(): Promise<string> {
  mediaRoot = path.join(tmpdir(), `mitsailing-media-${crypto.randomUUID()}`);
  await mkdir(mediaRoot, { recursive: true });
  vi.stubEnv('MEDIA_STORAGE_ROOT', mediaRoot);
  return mediaRoot;
}

describe('cms media processing job', () => {
  it('enqueues processing jobs with stable asset ids', async () => {
    const { enqueueCmsMediaProcessingJob } =
      await import('@/worker/cmsMediaProcessingJob');
    const add = vi.fn( async () => Promise.resolve());

    await enqueueCmsMediaProcessingJob({ add }, { assetId: 'asset-1' });

    expect(add).toHaveBeenCalledWith(
      'cms-media-processing',
      { assetId: 'asset-1' },
      expect.objectContaining({
        jobId: 'cms-media-processing:asset-1',
      })
    );
  });

  it('moves uploaded image bytes into the ready folder', async () => {
    const root = await createMediaRoot();
    const { processCmsMediaProcessingJob } =
      await import('@/worker/cmsMediaProcessingJob');
    const rawPath = path.join(root, 'uploads', 'asset-1');
    const readyPath = path.join(root, 'ready', 'asset-1', 'race-day.png');
    await mkdir(path.dirname(rawPath), { recursive: true });
    await writeFile(
      rawPath,
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])
    );
    findUnique.mockResolvedValue({
      id: 'asset-1',
      mediaKind: 'image',
      mimeType: 'image/png',
      rawFilePath: rawPath,
      rawUploadId: 'asset-1',
      readyFilePath: readyPath,
      status: 'queued',
      storageProvider: 'server_folder',
      storedFilename: 'race-day.png',
    });

    await processCmsMediaProcessingJob({ assetId: 'asset-1' });

    await expect(readFile(readyPath)).resolves.toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])
    );
    expect(update).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        processingErrorCode: null,
        status: 'ready',
      }),
      where: { id: 'asset-1' },
    });
  });
});
