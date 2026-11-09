import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { authorizeCmsMediaLibraryAccess } from '@/libs/mit-sailing/cmsMediaAuthorization';
import { processCmsMediaImageBytes } from '@/libs/mit-sailing/cmsMediaImageProcessing';
import {
  deleteCmsMediaFile,
  writeCmsMediaFile,
} from '@/libs/mit-sailing/cmsMediaStorage';
import {
  buildCmsMediaPublicPath,
  cmsMediaByteSizeToNumber,
  validateCmsMediaUpload,
} from '@/libs/mit-sailing/cmsMediaValidation';

export const runtime = 'nodejs';

type CreatedCmsMediaAsset = {
  id: string;
  originalFilename: string;
  mimeType: string;
  byteSize: bigint;
  publicPath: string;
  createdAt: Date;
};

export async function GET(_request: Request) {
  const auth = await authorizeCmsMediaLibraryAccess();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const assets = await prisma.cmsMediaAsset.findMany({
    orderBy: [{ createdAt: 'desc' }],
    take: 100,
    where: {
      status: 'ready',
    },
    select: {
      id: true,
      originalFilename: true,
      mimeType: true,
      byteSize: true,
      publicPath: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    assets: assets.map((asset) => ({
      id: asset.id,
      originalFilename: asset.originalFilename,
      mimeType: asset.mimeType,
      byteSize: cmsMediaByteSizeToNumber(asset.byteSize),
      publicPath: asset.publicPath,
      createdAt: asset.createdAt.toISOString(),
    })),
  });
}

/**
 * Uploads one CMS image or PDF into DB-backed local storage.
 *
 * @param request - Multipart body with one `file` field
 * @returns Uploaded asset metadata and app-relative URL
 */
export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form_data' }, { status: 400 });
  }

  const auth = await authorizeCmsMediaLibraryAccess();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (Env.APP_ENV === 'production' || Env.APP_ENV === 'staging') {
    logger.warn(
      'Blocked direct CMS media upload outside local app environment',
      {
        appEnv: Env.APP_ENV,
        userId: auth.userId,
      }
    );
    return NextResponse.json(
      { error: 'direct_upload_disabled' },
      { status: 403 }
    );
  }

  const file = formData.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing_file' }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validation = validateCmsMediaUpload({
    bytes,
    declaredMimeType: file.type,
    originalFilename: file.name,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.code }, { status: 415 });
  }

  let readyBytes = bytes;
  let { mimeType } = validation;
  let { storedFilename } = validation;
  if (validation.mediaKind === 'image') {
    try {
      const processed = await processCmsMediaImageBytes({
        bytes,
        mimeType: validation.mimeType,
        originalFilename: file.name,
      });
      readyBytes = new Uint8Array(processed.bytes);
      ({ mimeType } = processed);
      ({ storedFilename } = processed);
    } catch (error: unknown) {
      logger.error('Failed to process CMS media image: {error}', { error });
      return NextResponse.json(
        { error: 'image_processing_failed' },
        { status: 500 }
      );
    }
  }

  const id = randomUUID();
  const publicPath = buildCmsMediaPublicPath({
    id,
    filename: storedFilename,
  });
  let writtenPath: string | null;
  try {
    writtenPath = await writeCmsMediaFile({
      id,
      filename: storedFilename,
      bytes: readyBytes,
    });
  } catch (error: unknown) {
    logger.error('Failed to write CMS media file: {error}', { error });
    return NextResponse.json({ error: 'storage_failed' }, { status: 500 });
  }
  if (!writtenPath) {
    return NextResponse.json({ error: 'unsafe_storage_path' }, { status: 400 });
  }

  let asset: CreatedCmsMediaAsset;
  try {
    asset = await prisma.cmsMediaAsset.create({
      data: {
        id,
        storedFilename,
        originalFilename: file.name,
        mimeType,
        byteSize: BigInt(readyBytes.byteLength),
        mediaKind: validation.mediaKind,
        processedAt: new Date(),
        publicPath,
        status: 'ready',
        storageProvider: 'local',
        uploadedByUserId: auth.userId,
      },
      select: {
        id: true,
        originalFilename: true,
        mimeType: true,
        byteSize: true,
        publicPath: true,
        createdAt: true,
      },
    });
  } catch (error: unknown) {
    try {
      await deleteCmsMediaFile({ id, filename: storedFilename });
    } catch (cleanupError: unknown) {
      logger.error('Failed to remove orphaned CMS media file: {error}', {
        error: cleanupError,
      });
    }
    logger.error('Failed to record CMS media asset: {error}', { error });
    return NextResponse.json({ error: 'asset_create_failed' }, { status: 500 });
  }

  return NextResponse.json({
    id: asset.id,
    originalFilename: asset.originalFilename,
    mimeType: asset.mimeType,
    byteSize: cmsMediaByteSizeToNumber(asset.byteSize),
    publicPath: asset.publicPath,
    url: asset.publicPath,
    createdAt: asset.createdAt.toISOString(),
  });
}
