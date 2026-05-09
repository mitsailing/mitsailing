import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/libs/auth/dal';
import { Role } from '@/libs/auth/roles';
import { prisma } from '@/libs/DB';
import { writeCmsMediaFile } from '@/libs/mit-sailing/cmsMediaStorage';
import {
  buildCmsMediaPublicPath,
  validateCmsMediaUpload,
} from '@/libs/mit-sailing/cmsMediaValidation';

async function currentAdminUserId(): Promise<string | null> {
  const currentUser = await getCurrentUser();
  return currentUser?.role === Role.ADMIN ? currentUser.id : null;
}

export async function GET() {
  const userId = await currentAdminUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const assets = await prisma.cmsMediaAsset.findMany({
    orderBy: [{ createdAt: 'desc' }],
    take: 100,
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
      byteSize: asset.byteSize,
      publicPath: asset.publicPath,
      createdAt: asset.createdAt.toISOString(),
    })),
  });
}

/**
 * Uploads one CMS image into DB-backed local storage.
 *
 * @param request - Multipart body with one `file` field
 * @returns Uploaded asset metadata and app-relative URL
 */
export async function POST(request: Request) {
  const userId = await currentAdminUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const pageId = formData.get('pageId');
  const normalizedPageId =
    typeof pageId === 'string' && pageId.trim().length > 0
      ? pageId.trim()
      : null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Expected file field' }, { status: 400 });
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

  if (normalizedPageId) {
    const page = await prisma.cmsPage.findUnique({
      where: { id: normalizedPageId },
      select: { id: true },
    });
    if (!page) {
      return NextResponse.json({ error: 'invalid_page' }, { status: 400 });
    }
  }

  const id = randomUUID();
  const publicPath = buildCmsMediaPublicPath({
    id,
    filename: validation.storedFilename,
  });
  const writtenPath = await writeCmsMediaFile({
    id,
    filename: validation.storedFilename,
    bytes,
  });
  if (!writtenPath) {
    return NextResponse.json({ error: 'unsafe_storage_path' }, { status: 400 });
  }

  const asset = await prisma.cmsMediaAsset.create({
    data: {
      id,
      pageId: normalizedPageId,
      storedFilename: validation.storedFilename,
      originalFilename: file.name,
      mimeType: validation.mimeType,
      byteSize: bytes.byteLength,
      publicPath,
      uploadedByUserId: userId,
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
    id: asset.id,
    originalFilename: asset.originalFilename,
    mimeType: asset.mimeType,
    byteSize: asset.byteSize,
    publicPath: asset.publicPath,
    url: asset.publicPath,
    createdAt: asset.createdAt.toISOString(),
  });
}
