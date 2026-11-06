import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import type * as FsPromises from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
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
  mediaKind?: 'file' | 'image' | 'video';
  mimeType?: string;
  originalFilename?: string;
  rawPath: string;
  readyPath: string;
  storedFilename?: string;
}) {
  return {
    byteSize: props.byteSize,
    id: 'asset-1',
    mediaKind: props.mediaKind ?? 'image',
    mimeType: props.mimeType ?? 'image/png',
    originalFilename: props.originalFilename ?? 'Race Day.png',
    rawFilePath: props.rawPath,
    rawUploadId: 'asset-1',
    readyFilePath: props.readyPath,
    status: 'queued',
    storageProvider: 'server_folder',
    storedFilename: props.storedFilename ?? 'race-day.png',
    updatedAt: new Date(Date.UTC(2026, 4, 17, 12)),
  };
}

async function tinyPngBytes() {
  const bytes = await sharp({
    create: {
      background: { b: 0, g: 0, r: 255 },
      channels: 3,
      height: 8,
      width: 8,
    },
  })
    .png()
    .toBuffer();
  return bytes;
}

describe('cms media processing job', () => {
  it('enqueues processing jobs with BullMQ deduplication ids', async () => {
    const { enqueueCmsMediaProcessingJob } =
      await import('@/worker/cmsMediaProcessingJob');
    const add = vi.fn<CmsMediaProcessingQueue['add']>().mockResolvedValue(null);

    await enqueueCmsMediaProcessingJob({ add }, { assetId: 'asset-1' });

    const options = add.mock.calls[0]?.[2];
    expect(add).toHaveBeenCalledWith(
      'cms-media-processing',
      {
        assetId: 'asset-1',
      },
      expect.any(Object)
    );
    expect(options).toEqual(
      expect.objectContaining({
        deduplication: { id: 'cms-media-processing-asset-1' },
      })
    );
    expect(options).not.toHaveProperty('jobId');
  });

  it('rejects non-object processing job data', async () => {
    const { processCmsMediaProcessingJob } =
      await import('@/worker/cmsMediaProcessingJob');

    await expect(processCmsMediaProcessingJob(null)).rejects.toThrow(
      'CMS media processing job data must be an object'
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects processing job data without asset ids', async () => {
    const { processCmsMediaProcessingJob } =
      await import('@/worker/cmsMediaProcessingJob');

    await expect(processCmsMediaProcessingJob({ assetId: '' })).rejects.toThrow(
      'CMS media processing job data must include assetId'
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('skips missing, ready, and local media assets', async () => {
    const { processCmsMediaProcessingJob } =
      await import('@/worker/cmsMediaProcessingJob');
    findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'asset-1',
        status: 'ready',
        storageProvider: 'server_folder',
      })
      .mockResolvedValueOnce({
        id: 'asset-1',
        status: 'queued',
        storageProvider: 'local',
      });

    await processCmsMediaProcessingJob({ assetId: 'missing-asset' });
    await processCmsMediaProcessingJob({ assetId: 'ready-asset' });
    await processCmsMediaProcessingJob({ assetId: 'local-asset' });

    expect(update).not.toHaveBeenCalled();
  });

  it('moves uploaded image bytes into the ready folder', async () => {
    const root = await createMediaRoot();
    const { processCmsMediaProcessingJob } =
      await import('@/worker/cmsMediaProcessingJob');
    const pngBytes = await tinyPngBytes();
    const rawPath = path.join(root, 'uploads', 'asset-1');
    const readyPath = path.join(root, 'ready', 'asset-1', 'race-day.png');
    await mkdir(path.dirname(rawPath), { recursive: true });
    await writeFile(rawPath, pngBytes);
    findUnique.mockResolvedValue({
      byteSize: BigInt(pngBytes.byteLength),
      id: 'asset-1',
      mediaKind: 'image',
      mimeType: 'image/png',
      originalFilename: 'Race Day.png',
      rawFilePath: rawPath,
      rawUploadId: 'asset-1',
      readyFilePath: readyPath,
      status: 'queued',
      storageProvider: 'server_folder',
      storedFilename: 'race-day.png',
      updatedAt: new Date(Date.UTC(2026, 4, 17, 12)),
    });

    await processCmsMediaProcessingJob({ assetId: 'asset-1' });

    const readyBytes = await readFile(readyPath);
    expect(readyBytes.byteLength).toBeGreaterThan(0);
    expect(readyBytes.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );
    const readyDirStat = await stat(path.dirname(readyPath));
    const readyFileStat = await stat(readyPath);
    expect(readyDirStat.mode.toString(8).slice(-3)).toBe('755');
    expect(readyFileStat.mode.toString(8).slice(-3)).toBe('644');
    expect(update).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        mimeType: 'image/png',
        processingErrorCode: null,
        status: 'ready',
        storedFilename: 'race-day.png',
      }),
      where: { id: 'asset-1' },
    });
  });

  it('uses asset ids when raw upload ids are absent', async () => {
    const root = await createMediaRoot();
    const { processCmsMediaProcessingJob } =
      await import('@/worker/cmsMediaProcessingJob');
    const pngBytes = await tinyPngBytes();
    const rawPath = path.join(root, 'uploads', 'asset-1');
    const readyPath = path.join(root, 'ready', 'asset-1', 'race-day.png');
    await mkdir(path.dirname(rawPath), { recursive: true });
    await writeFile(rawPath, pngBytes);
    findUnique.mockResolvedValue({
      ...processingAsset({
        byteSize: BigInt(pngBytes.byteLength),
        rawPath,
        readyPath,
      }),
      rawUploadId: null,
    });

    await processCmsMediaProcessingJob({ assetId: 'asset-1' });

    const readyBytes = await readFile(readyPath);
    expect(readyBytes.subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    );
    expect(update).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        processingErrorCode: null,
        status: 'ready',
      }),
      where: { id: 'asset-1' },
    });
  });

  it('moves pdf bytes unchanged into the ready folder', async () => {
    const root = await createMediaRoot();
    const { processCmsMediaProcessingJob } =
      await import('@/worker/cmsMediaProcessingJob');
    const pdfBytes = Buffer.from('%PDF-1.4 handbook');
    const rawPath = path.join(root, 'uploads', 'asset-1');
    const readyPath = path.join(root, 'ready', 'asset-1', 'handbook.pdf');
    await mkdir(path.dirname(rawPath), { recursive: true });
    await writeFile(rawPath, pdfBytes);
    findUnique.mockResolvedValue(
      processingAsset({
        byteSize: BigInt(pdfBytes.byteLength),
        mediaKind: 'file',
        mimeType: 'application/pdf',
        originalFilename: 'handbook.pdf',
        rawPath,
        readyPath,
        storedFilename: 'handbook.pdf',
      })
    );

    await processCmsMediaProcessingJob({ assetId: 'asset-1' });

    await expect(readFile(readyPath)).resolves.toEqual(pdfBytes);
    expect(update).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        processingErrorCode: null,
        status: 'ready',
      }),
      where: { id: 'asset-1' },
    });
  });

  it('fixes ready file permissions when retrying an already moved file', async () => {
    const root = await createMediaRoot();
    const { processCmsMediaProcessingJob } =
      await import('@/worker/cmsMediaProcessingJob');
    const rawPath = path.join(root, 'uploads', 'asset-1');
    const readyPath = path.join(root, 'ready', 'asset-1', 'race-day.png');
    await mkdir(path.dirname(readyPath), { recursive: true });
    await writeFile(
      readyPath,
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])
    );
    await chmod(path.dirname(readyPath), 0o700);
    await chmod(readyPath, 0o600);
    findUnique.mockResolvedValue(
      processingAsset({
        byteSize: BigInt(Number('11')),
        rawPath,
        readyPath,
      })
    );

    await processCmsMediaProcessingJob({ assetId: 'asset-1' });

    const readyDirStat = await stat(path.dirname(readyPath));
    const readyFileStat = await stat(readyPath);
    expect(readyDirStat.mode.toString(8).slice(-3)).toBe('755');
    expect(readyFileStat.mode.toString(8).slice(-3)).toBe('644');
    expect(update).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        processingErrorCode: null,
        status: 'ready',
      }),
      where: { id: 'asset-1' },
    });
  });

  it('marks unsafe storage paths as failed without filesystem access', async () => {
    const root = await createMediaRoot();
    const { processCmsMediaProcessingJob } =
      await import('@/worker/cmsMediaProcessingJob');
    findUnique.mockResolvedValue(
      processingAsset({
        byteSize: BigInt(Number('11')),
        rawPath: path.join(root, 'uploads', 'asset-1'),
        readyPath: path.join(root, 'ready', 'other-asset', 'race-day.png'),
      })
    );

    await processCmsMediaProcessingJob({ assetId: 'asset-1' });

    expect(update).toHaveBeenCalledWith({
      data: {
        processingErrorCode: 'unsafe_storage_path',
        status: 'failed',
      },
      where: { id: 'asset-1' },
    });
  });

  it('marks missing raw uploads before retrying the job', async () => {
    const root = await createMediaRoot();
    const { processCmsMediaProcessingJob } =
      await import('@/worker/cmsMediaProcessingJob');
    const rawPath = path.join(root, 'uploads', 'asset-1');
    const readyPath = path.join(root, 'ready', 'asset-1', 'race-day.png');
    findUnique.mockResolvedValue(
      processingAsset({
        byteSize: BigInt(Number('11')),
        rawPath,
        readyPath,
      })
    );

    await expect(
      processCmsMediaProcessingJob({ assetId: 'asset-1' })
    ).rejects.toThrow('CMS media upload file is missing');

    expect(update).toHaveBeenCalledWith({
      data: {
        processingErrorCode: 'missing_upload',
        status: 'failed',
      },
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

  it('marks MIME mismatches before publishing uploaded media', async () => {
    const root = await createMediaRoot();
    const { processCmsMediaProcessingJob } =
      await import('@/worker/cmsMediaProcessingJob');
    const rawPath = path.join(root, 'uploads', 'asset-1');
    const readyPath = path.join(root, 'ready', 'asset-1', 'race-day.png');
    await mkdir(path.dirname(rawPath), { recursive: true });
    await writeFile(rawPath, Buffer.from('%PDF-1.7\n'));
    findUnique.mockResolvedValue(
      processingAsset({
        byteSize: BigInt(Number('9')),
        rawPath,
        readyPath,
      })
    );

    await expect(
      processCmsMediaProcessingJob({ assetId: 'asset-1' })
    ).rejects.toThrow('CMS media upload signature does not match metadata');

    expect(update).toHaveBeenCalledWith({
      data: {
        processingErrorCode: 'mime_mismatch',
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
            throw Object.assign(new Error('missing ready file'), {
              code: 'ENOENT',
            });
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

  it('surfaces ready file stat failures for retry', async () => {
    const root = await createMediaRoot();
    const rawPath = path.join(root, 'uploads', 'asset-1');
    const readyPath = path.join(root, 'ready', 'asset-1', 'race-day.png');
    const statError = Object.assign(new Error('permission denied'), {
      code: 'EACCES',
    });
    vi.resetModules();
    vi.doMock('node:fs/promises', async (importActual) => {
      const actual = await importActual<typeof FsPromises>();
      return {
        ...actual,
        stat: vi.fn(async (...args: Parameters<typeof actual.stat>) => {
          const [filePath] = args;
          if (filePath === readyPath) {
            throw statError;
          }
          const statResult = await actual.stat(...args);
          return statResult;
        }),
      };
    });
    const { processCmsMediaProcessingJob } =
      await import('@/worker/cmsMediaProcessingJob');
    await mkdir(path.dirname(rawPath), { recursive: true });
    await writeFile(
      rawPath,
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])
    );
    findUnique.mockResolvedValue(
      processingAsset({
        byteSize: BigInt(Number('11')),
        rawPath,
        readyPath,
      })
    );

    await expect(
      processCmsMediaProcessingJob({ assetId: 'asset-1' })
    ).rejects.toThrow('permission denied');

    expect(update).not.toHaveBeenCalled();
  });

  it('surfaces raw upload stat failures for retry', async () => {
    const root = await createMediaRoot();
    const rawPath = path.join(root, 'uploads', 'asset-1');
    const readyPath = path.join(root, 'ready', 'asset-1', 'race-day.png');
    const statError = Object.assign(new Error('input/output error'), {
      code: 'EIO',
    });
    vi.resetModules();
    vi.doMock('node:fs/promises', async (importActual) => {
      const actual = await importActual<typeof FsPromises>();
      return {
        ...actual,
        stat: vi.fn(async (...args: Parameters<typeof actual.stat>) => {
          const [filePath] = args;
          if (filePath === readyPath) {
            throw Object.assign(new Error('missing ready file'), {
              code: 'ENOENT',
            });
          }
          if (filePath === rawPath) {
            throw statError;
          }
          const statResult = await actual.stat(...args);
          return statResult;
        }),
      };
    });
    const { processCmsMediaProcessingJob } =
      await import('@/worker/cmsMediaProcessingJob');
    await mkdir(path.dirname(rawPath), { recursive: true });
    await writeFile(
      rawPath,
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])
    );
    findUnique.mockResolvedValue(
      processingAsset({
        byteSize: BigInt(Number('11')),
        rawPath,
        readyPath,
      })
    );

    await expect(
      processCmsMediaProcessingJob({ assetId: 'asset-1' })
    ).rejects.toThrow('input/output error');

    expect(update).not.toHaveBeenCalled();
  });

  it('re-enqueues queued and stale processing server-folder assets', async () => {
    const { reconcileCmsMediaProcessingJobs } =
      await import('@/worker/cmsMediaProcessingJob');
    const now = new Date(Date.UTC(2026, 4, 17, 12, 30));
    const add = vi.fn<CmsMediaProcessingQueue['add']>().mockResolvedValue(null);
    findMany.mockResolvedValue([{ id: 'queued-1' }, { id: 'stale-1' }]);

    await reconcileCmsMediaProcessingJobs({ add }, now);

    expect(findMany).toHaveBeenCalledWith({
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
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
        deduplication: { id: 'cms-media-processing-queued-1' },
      })
    );
    expect(add).toHaveBeenNthCalledWith(
      2,
      'cms-media-processing',
      { assetId: 'stale-1' },
      expect.objectContaining({
        deduplication: { id: 'cms-media-processing-stale-1' },
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
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: 2,
      })
    );
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        cursor: { id: 'asset-2' },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
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
