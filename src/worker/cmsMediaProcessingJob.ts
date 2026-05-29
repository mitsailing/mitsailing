import type { BigIntStats } from 'node:fs';
import { chmod, mkdir, open, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import type { JobsOptions } from 'bullmq';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import {
  buildCmsMediaReadyPath,
  resolveCmsMediaUploadFilePath,
} from '@/libs/mit-sailing/cmsMediaFileStorage';
import { detectCmsMediaKind } from '@/libs/mit-sailing/cmsMediaValidation';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';

export const CMS_MEDIA_PROCESSING_JOB_NAME = 'cms-media-processing';

const CMS_MEDIA_PROCESSING_JOB_OPTS: JobsOptions = {
  attempts: 3,
  backoff: { delay: 60_000, type: 'exponential' },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
};

const CMS_MEDIA_PROCESSING_STALE_MS = 15 * 60 * 1000;
const CMS_MEDIA_RECONCILE_BATCH_SIZE = 500;

type CmsMediaProcessingJobData = {
  assetId: string;
};

type CmsMediaProcessingAsset = {
  byteSize: bigint;
  id: string;
  mediaKind: 'file' | 'image' | 'video';
  mimeType: string;
  rawFilePath: string | null;
  rawUploadId: string | null;
  readyFilePath: string | null;
  status: 'failed' | 'processing' | 'queued' | 'ready' | 'uploading';
  storageProvider: 'local' | 'server_folder';
  storedFilename: string;
  updatedAt: Date;
};

export type CmsMediaProcessingQueue = Pick<
  {
    add: (
      name: string,
      data: CmsMediaProcessingJobData,
      opts?: JobsOptions
    ) => Promise<unknown>;
  },
  'add'
>;

function cmsMediaProcessingJobDataFromUnknown(
  data: unknown
): CmsMediaProcessingJobData {
  if (typeof data !== 'object' || data === null) {
    throw new TypeError('CMS media processing job data must be an object');
  }
  const assetId = Reflect.get(data, 'assetId');
  if (typeof assetId !== 'string' || assetId.length === 0) {
    throw new TypeError('CMS media processing job data must include assetId');
  }
  return { assetId };
}

function assetPaths(asset: CmsMediaProcessingAsset): {
  rawPath: string;
  readyPath: string;
} | null {
  const rawPath = resolveCmsMediaUploadFilePath({
    root: Env.MEDIA_STORAGE_ROOT,
    uploadId: asset.rawUploadId ?? asset.id,
  });
  const readyPath = buildCmsMediaReadyPath({
    assetId: asset.id,
    filename: asset.storedFilename,
    root: Env.MEDIA_STORAGE_ROOT,
  });
  if (
    !rawPath ||
    !readyPath ||
    asset.rawFilePath !== rawPath ||
    asset.readyFilePath !== readyPath
  ) {
    return null;
  }
  return { rawPath, readyPath };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (safeErrorCode(error) !== 'ENOENT') {
      throw error;
    }
    return false;
  }
}

async function fileStat(filePath: string): Promise<BigIntStats | null> {
  try {
    return await stat(filePath, { bigint: true });
  } catch (error) {
    if (safeErrorCode(error) !== 'ENOENT') {
      throw error;
    }
    return null;
  }
}

async function readHeader(filePath: string): Promise<Uint8Array> {
  const handle = await open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(4096);
    const result = await handle.read(buffer, 0, buffer.byteLength, 0);
    return buffer.subarray(0, result.bytesRead);
  } finally {
    await handle.close();
  }
}

async function markCmsMediaFailed(props: {
  assetId: string;
  code: string;
}): Promise<void> {
  await prisma.cmsMediaAsset.update({
    data: {
      processingErrorCode: props.code,
      status: 'failed',
    },
    where: { id: props.assetId },
  });
}

async function markCmsMediaReady(assetId: string): Promise<void> {
  await prisma.cmsMediaAsset.update({
    data: {
      processedAt: new Date(),
      processingErrorCode: null,
      status: 'ready',
    },
    where: { id: assetId },
  });
}

async function ensureReadyMediaPermissions(readyPath: string): Promise<void> {
  await chmod(path.dirname(readyPath), 0o755);
  await chmod(readyPath, 0o644);
}

async function processServerFolderAsset(
  asset: CmsMediaProcessingAsset
): Promise<void> {
  const paths = assetPaths(asset);
  if (!paths) {
    await markCmsMediaFailed({
      assetId: asset.id,
      code: 'unsafe_storage_path',
    });
    return;
  }
  if (await fileExists(paths.readyPath)) {
    await ensureReadyMediaPermissions(paths.readyPath);
    await markCmsMediaReady(asset.id);
    return;
  }
  const rawStat = await fileStat(paths.rawPath);
  if (!rawStat) {
    await markCmsMediaFailed({ assetId: asset.id, code: 'missing_upload' });
    throw new Error('CMS media upload file is missing');
  }
  if (rawStat.size !== asset.byteSize) {
    await markCmsMediaFailed({
      assetId: asset.id,
      code: 'byte_size_mismatch',
    });
    throw new Error('CMS media upload byte size does not match metadata');
  }
  const header = await readHeader(paths.rawPath);
  if (detectCmsMediaKind(header, asset.mimeType) !== asset.mediaKind) {
    await markCmsMediaFailed({ assetId: asset.id, code: 'mime_mismatch' });
    throw new Error('CMS media upload signature does not match metadata');
  }
  await prisma.cmsMediaAsset.update({
    data: { status: 'processing' },
    where: { id: asset.id },
  });
  await mkdir(path.dirname(paths.readyPath), { recursive: true });
  await rename(paths.rawPath, paths.readyPath);
  await ensureReadyMediaPermissions(paths.readyPath);
  await markCmsMediaReady(asset.id);
}

export async function enqueueCmsMediaProcessingJob(
  queue: CmsMediaProcessingQueue,
  data: CmsMediaProcessingJobData
): Promise<void> {
  await queue.add(CMS_MEDIA_PROCESSING_JOB_NAME, data, {
    ...CMS_MEDIA_PROCESSING_JOB_OPTS,
    jobId: `${CMS_MEDIA_PROCESSING_JOB_NAME}:${data.assetId}`,
  });
}

export async function reconcileCmsMediaProcessingJobs(
  queue: CmsMediaProcessingQueue,
  now: Date,
  options: { batchSize?: number } = {}
): Promise<void> {
  const staleBefore = new Date(now.getTime() - CMS_MEDIA_PROCESSING_STALE_MS);
  const batchSize = options.batchSize ?? CMS_MEDIA_RECONCILE_BATCH_SIZE;
  const where: Prisma.CmsMediaAssetWhereInput = {
    OR: [
      { status: 'queued' },
      { status: 'processing', updatedAt: { lt: staleBefore } },
    ],
    storageProvider: 'server_folder',
  };
  let cursor: { id: string } | undefined;
  for (;;) {
    const assets = await prisma.cmsMediaAsset.findMany({
      ...(cursor ? { cursor, skip: 1 } : {}),
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
      take: batchSize,
      where,
    });
    for (const asset of assets) {
      await enqueueCmsMediaProcessingJob(queue, { assetId: asset.id });
    }
    if (assets.length < batchSize) {
      return;
    }
    const lastAsset = assets.at(-1);
    if (!lastAsset) {
      return;
    }
    cursor = { id: lastAsset.id };
  }
}

export async function processCmsMediaProcessingJob(
  data: unknown
): Promise<void> {
  const params = cmsMediaProcessingJobDataFromUnknown(data);
  const asset = await prisma.cmsMediaAsset.findUnique({
    select: {
      byteSize: true,
      id: true,
      mediaKind: true,
      mimeType: true,
      rawFilePath: true,
      rawUploadId: true,
      readyFilePath: true,
      status: true,
      storageProvider: true,
      storedFilename: true,
      updatedAt: true,
    },
    where: { id: params.assetId },
  });
  if (!asset || asset.status === 'ready' || asset.storageProvider === 'local') {
    return;
  }
  try {
    await processServerFolderAsset(asset);
  } catch (error: unknown) {
    logger.error(
      '[cms-media:process] asset_id={assetId} error_name={errorName} error_code={errorCode}',
      {
        assetId: params.assetId,
        errorCode: safeErrorCode(error) ?? 'unknown',
        errorName: safeErrorName(error),
      }
    );
    throw error;
  }
}
