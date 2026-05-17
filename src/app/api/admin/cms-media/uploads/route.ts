import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/libs/auth/dal';
import { Role } from '@/libs/auth/roles';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import {
  buildCmsMediaReadyPath,
  resolveCmsMediaUploadFilePath,
} from '@/libs/mit-sailing/cmsMediaFileStorage';
import type { CmsMediaUploadSessionAsset } from '@/libs/mit-sailing/cmsMediaTypes';
import { createCmsMediaUploadSession } from '@/libs/mit-sailing/cmsMediaUploadSessions';
import {
  buildCmsMediaPublicPath,
  validateCmsMediaMetadata,
} from '@/libs/mit-sailing/cmsMediaValidation';

export const runtime = 'nodejs';

type UploadSessionRequest = {
  byteSize: number;
  originalFilename: string;
  pageId: string | null;
  type: string;
};

function stringField(value: unknown, field: string): string | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const fieldValue = Reflect.get(value, field);
  return typeof fieldValue === 'string' ? fieldValue : null;
}

function numberField(value: unknown, field: string): number | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const fieldValue = Reflect.get(value, field);
  return typeof fieldValue === 'number' && Number.isSafeInteger(fieldValue)
    ? fieldValue
    : null;
}

function uploadSessionRequestFromUnknown(
  value: unknown
): UploadSessionRequest | null {
  const originalFilename = stringField(value, 'originalFilename');
  const type = stringField(value, 'type');
  const byteSize = numberField(value, 'byteSize');
  const pageId = stringField(value, 'pageId');
  if (!originalFilename || !type || byteSize === null) {
    return null;
  }
  return {
    byteSize,
    originalFilename,
    pageId: pageId && pageId.trim().length > 0 ? pageId.trim() : null,
    type,
  };
}

async function currentAdminUserId(): Promise<string | null> {
  const currentUser = await getCurrentUser();
  return currentUser?.role === Role.ADMIN ? currentUser.id : null;
}

async function requestBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function uploadSecret(): string | null {
  return Env.MEDIA_UPLOAD_SHARED_SECRET ?? null;
}

function sessionAssetFromRecord(asset: {
  byteSize: bigint;
  createdAt: Date;
  id: string;
  mediaKind: CmsMediaUploadSessionAsset['mediaKind'];
  mimeType: string;
  originalFilename: string;
  publicPath: string;
  status: CmsMediaUploadSessionAsset['status'];
}): CmsMediaUploadSessionAsset {
  return {
    byteSize: Number(asset.byteSize),
    createdAt: asset.createdAt.toISOString(),
    id: asset.id,
    mediaKind: asset.mediaKind,
    mimeType: asset.mimeType,
    originalFilename: asset.originalFilename,
    publicPath: asset.publicPath,
    status: asset.status,
  };
}

export async function POST(request: Request) {
  const userId = await currentAdminUserId();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const secret = uploadSecret();
  if (!secret) {
    return NextResponse.json(
      { error: 'upload_service_not_configured' },
      { status: 503 }
    );
  }
  const body = uploadSessionRequestFromUnknown(await requestBody(request));
  if (!body) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const validation = validateCmsMediaMetadata({
    byteSize: body.byteSize,
    declaredMimeType: body.type,
    originalFilename: body.originalFilename,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.code }, { status: 415 });
  }
  if (body.pageId) {
    const page = await prisma.cmsPage.findUnique({
      select: { id: true },
      where: { id: body.pageId },
    });
    if (!page) {
      return NextResponse.json({ error: 'invalid_page' }, { status: 400 });
    }
  }

  const id = randomUUID();
  const rawFilePath = resolveCmsMediaUploadFilePath({
    root: Env.MEDIA_STORAGE_ROOT,
    uploadId: id,
  });
  const readyFilePath = buildCmsMediaReadyPath({
    assetId: id,
    filename: validation.storedFilename,
    root: Env.MEDIA_STORAGE_ROOT,
  });
  if (!rawFilePath || !readyFilePath) {
    return NextResponse.json({ error: 'unsafe_storage_path' }, { status: 400 });
  }
  const publicPath = buildCmsMediaPublicPath({
    id,
    filename: validation.storedFilename,
  });
  const asset = await prisma.cmsMediaAsset.create({
    data: {
      id,
      byteSize: BigInt(body.byteSize),
      mediaKind: validation.mediaKind,
      mimeType: validation.mimeType,
      originalFilename: body.originalFilename,
      pageId: body.pageId,
      publicPath,
      rawFilePath,
      rawUploadId: id,
      readyFilePath,
      status: 'uploading',
      storageProvider: 'server_folder',
      storedFilename: validation.storedFilename,
      uploadedByUserId: userId,
    },
    select: {
      byteSize: true,
      createdAt: true,
      id: true,
      mediaKind: true,
      mimeType: true,
      originalFilename: true,
      publicPath: true,
      status: true,
    },
  });

  return NextResponse.json(
    createCmsMediaUploadSession({
      asset: sessionAssetFromRecord(asset),
      baseUrl: Env.MEDIA_UPLOAD_BASE_URL ?? '',
      now: new Date(),
      secret,
      storedFilename: validation.storedFilename,
    }),
    { status: 201 }
  );
}
