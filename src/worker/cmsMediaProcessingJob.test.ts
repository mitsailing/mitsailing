import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import type * as FsPromises from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CmsMediaProcessingQueue } from '@/worker/cmsMediaProcessingJob';

const update = vi.fn();
const findUnique = vi.fn();
const findMany = vi.fn();

vi.mock('@/libs/DB', () => ({
  prisma: {
    cmsMediaAsset: {
      findMany,
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
  mediaRoot = await mkdtemp(path.join(tmpdir(), 'mitsailing-media-'));
  vi.stubEnv('MEDIA_STORAGE_ROOT', mediaRoot);
  return mediaRoot;
}

function processingAsset(props: {
  byteSize: bigint;
  rawPath: string;
  readyPath: string;
}) {
  return {
    byteSize: props.byteSize,
    id: 'asset-1',
    mediaKind: 'image',
    mimeType: 'image/png',
    rawFilePath: props.rawPath,
    rawUploadId: 'asset-1',
    readyFilePath: props.readyPath,
    status: 'queued',
    storageProvider: 'server_folder',
    storedFilename: 'race-day.png',
    updatedAt: new Date(Date.UTC(2026, 4, 17, 12)),
  };
}

describe('cms media processing job', () => {
  it('enqueues processing jobs with stable asset ids', async () => {
    const { enqueueCmsMediaProcessingJob } =
      await import('@/worker/cmsMediaProcessingJob');
    const add = vi.fn<CmsMediaProcessingQueue['add']>().mockResolvedValue(null);

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
      byteSize: BigInt(Number('11')),
      id: 'asset-1',
      mediaKind: 'image',
      mimeType: 'image/png',
      rawFilePath: rawPath,
      rawUploadId: 'asset-1',
      readyFilePath: readyPath,
      status: 'queued',
      storageProvider: 'server_folder',
      storedFilename: 'race-day.png',
      updatedAt: new Date(Date.UTC(2026, 4, 17, 12)),
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

  it('marks smaller raw uploads as byte size mismatches before MIME sniffing', async () => {
    const root = await createMediaRoot();
    const { processCmsMediaProcessingJob } =
      await import('@/worker/cmsMediaProcessingJob');
    const rawPath = path.join(root, 'uploads', 'asset-1');
    const readyPath = path.join(root, 'ready', 'asset-1', 'race-day.png');
    await mkdir(path.dirname(rawPath), { recursive: true });
    await writeFile(rawPath, Buffer.from([0]));
    findUnique.mockResolvedValue(
      processingAsset({
        byteSize: BigInt(Number('1024')),
        rawPath,
        readyPath,
      })
    );

    await expect(
      processCmsMediaProcessingJob({ assetId: 'asset-1' })
    ).rejects.toThrow('byte size');

    expect(update).toHaveBeenCalledWith({
      data: {
        processingErrorCode: 'byte_size_mismatch',
        status: 'failed',
      },
      where: { id: 'asset-1' },
    });
  });

  it('marks larger raw uploads as byte size mismatches before MIME sniffing', async () => {
    const root = await createMediaRoot();
    const { processCmsMediaProcessingJob } =
      await import('@/worker/cmsMediaProcessingJob');
    const rawPath = path.join(root, 'uploads', 'asset-1');
    const readyPath = path.join(root, 'ready', 'asset-1', 'race-day.png');
    await mkdir(path.dirname(rawPath), { recursive: true });
    await writeFile(rawPath, Buffer.alloc(2048));
    findUnique.mockResolvedValue(
      processingAsset({
        byteSize: BigInt(Number('1024')),
        rawPath,
        readyPath,
      })
    );

    await expect(
      processCmsMediaProcessingJob({ assetId: 'asset-1' })
    ).rejects.toThrow('byte size');

    expect(update).toHaveBeenCalledWith({
      data: {
        processingErrorCode: 'byte_size_mismatch',
        status: 'failed',
      },
      where: { id: 'asset-1' },
    });
  });

  it('compares raw upload byte size without unsafe bigint coercion', async () => {
    const root = await createMediaRoot();
    const rawSize = Number.MAX_SAFE_INTEGER + 1;
    const rawPath = path.join(root, 'uploads', 'asset-1');
    const readyPath = path.join(root, 'ready', 'asset-1', 'race-day.png');
    let statCalls = 0;
    vi.resetModules();
    vi.doMock('node:fs/promises', async (importActual) => {
      const actual = await importActual<typeof FsPromises>();
      return {
        ...actual,
        stat: vi.fn(async () => {
          statCalls += 1;
          if (statCalls === 1) {
            throw new Error('missing ready file');
          }
          const size = await Promise.resolve(rawSize);
          return { size };
        }),
      };
    });
    const { processCmsMediaProcessingJob } =
      await import('@/worker/cmsMediaProcessingJob');
    await mkdir(path.dirname(rawPath), { recursive: true });
    await writeFile(rawPath, Buffer.from([0]));
    findUnique.mockResolvedValue({
      ...processingAsset({
        byteSize: BigInt(rawSize) + BigInt(Number('1')),
        rawPath,
        readyPath,
      }),
      mediaKind: 'file',
      mimeType: 'application/pdf',
    });

    await expect(
      processCmsMediaProcessingJob({ assetId: 'asset-1' })
    ).rejects.toThrow('byte size');

    expect(update).toHaveBeenCalledWith({
      data: {
        processingErrorCode: 'byte_size_mismatch',
        status: 'failed',
      },
      where: { id: 'asset-1' },
    });
  });

  it('re-enqueues queued and stale processing server-folder assets', async () => {
    const { reconcileCmsMediaProcessingJobs } =
      await import('@/worker/cmsMediaProcessingJob');
    const now = new Date(Date.UTC(2026, 4, 17, 12, 30));
    const add = vi.fn<CmsMediaProcessingQueue['add']>().mockResolvedValue(null);
    findMany.mockResolvedValue([{ id: 'queued-1' }, { id: 'stale-1' }]);

    await reconcileCmsMediaProcessingJobs({ add }, now);

    expect(findMany).toHaveBeenCalledWith({
      orderBy: [{ updatedAt: 'asc' }],
      select: { id: true },
      take: 500,
      where: {
        OR: [
          { status: 'queued' },
          {
            status: 'processing',
            updatedAt: { lt: new Date(Date.UTC(2026, 4, 17, 12, 15)) },
          },
        ],
        storageProvider: 'server_folder',
      },
    });
    expect(add).toHaveBeenCalledTimes(2);
    expect(add).toHaveBeenNthCalledWith(
      1,
      'cms-media-processing',
      { assetId: 'queued-1' },
      expect.objectContaining({
        jobId: 'cms-media-processing:queued-1',
      })
    );
    expect(add).toHaveBeenNthCalledWith(
      2,
      'cms-media-processing',
      { assetId: 'stale-1' },
      expect.objectContaining({
        jobId: 'cms-media-processing:stale-1',
      })
    );
  });

  it('reconciles stale processing jobs in cursor batches', async () => {
    const { reconcileCmsMediaProcessingJobs } =
      await import('@/worker/cmsMediaProcessingJob');
    const now = new Date(Date.UTC(2026, 4, 17, 12, 30));
    const add = vi.fn<CmsMediaProcessingQueue['add']>().mockResolvedValue(null);
    findMany
      .mockResolvedValueOnce([{ id: 'asset-1' }, { id: 'asset-2' }])
      .mockResolvedValueOnce([{ id: 'asset-3' }]);

    await reconcileCmsMediaProcessingJobs({ add }, now, { batchSize: 2 });

    expect(findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        orderBy: [{ updatedAt: 'asc' }],
        take: 2,
      })
    );
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        cursor: { id: 'asset-2' },
        orderBy: [{ updatedAt: 'asc' }],
        skip: 1,
        take: 2,
      })
    );
    expect(add).toHaveBeenCalledTimes(3);
  });

  it('does not re-enqueue recent processing, uploading, ready, or local assets', async () => {
    const { reconcileCmsMediaProcessingJobs } =
      await import('@/worker/cmsMediaProcessingJob');
    const add = vi.fn<CmsMediaProcessingQueue['add']>().mockResolvedValue(null);
    findMany.mockResolvedValue([]);

    await reconcileCmsMediaProcessingJobs(
      { add },
      new Date(Date.UTC(2026, 4, 17, 12, 30))
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 500,
        where: expect.objectContaining({
          OR: [
            { status: 'queued' },
            {
              status: 'processing',
              updatedAt: { lt: new Date(Date.UTC(2026, 4, 17, 12, 15)) },
            },
          ],
          storageProvider: 'server_folder',
        }),
      })
    );
    expect(add).not.toHaveBeenCalled();
  });
});
