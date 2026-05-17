import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/libs/auth/dal';
import { Role } from '@/libs/auth/roles';
import { prisma } from '@/libs/DB';
import { cmsMediaByteSizeToNumber } from '@/libs/mit-sailing/cmsMediaValidation';

export const runtime = 'nodejs';

type CmsMediaUploadRouteProps = {
  params: Promise<{ id: string }>;
};

type CmsMediaUploadRouteAsset = {
  byteSize: bigint;
  createdAt: Date;
  id: string;
  mediaKind: 'file' | 'image' | 'video';
  mimeType: string;
  originalFilename: string;
  processingErrorCode: string | null;
  publicPath: string;
  status: 'failed' | 'processing' | 'queued' | 'ready' | 'uploading';
};

const cmsMediaUploadRouteAssetSelect = {
  byteSize: true,
  createdAt: true,
  id: true,
  mediaKind: true,
  mimeType: true,
  originalFilename: true,
  processingErrorCode: true,
  publicPath: true,
  status: true,
};

async function currentAdminUserId(): Promise<string | null> {
  const currentUser = await getCurrentUser();
  return currentUser?.role === Role.ADMIN ? currentUser.id : null;
}

function assetResponse(asset: CmsMediaUploadRouteAsset) {
  return {
    asset: {
      byteSize: cmsMediaByteSizeToNumber(asset.byteSize),
      createdAt: asset.createdAt.toISOString(),
      id: asset.id,
      mediaKind: asset.mediaKind,
      mimeType: asset.mimeType,
      originalFilename: asset.originalFilename,
      processingErrorCode: asset.processingErrorCode,
      publicPath: asset.publicPath,
      status: asset.status,
    },
  };
}

function uploadNotCancellableResponse() {
  return NextResponse.json(
    { error: 'upload_not_cancellable' },
    { status: 409 }
  );
}

async function findUploadAsset(id: string) {
  const asset = await prisma.cmsMediaAsset.findUnique({
    select: cmsMediaUploadRouteAssetSelect,
    where: { id },
  });
  return asset;
}

export async function GET(_request: Request, props: CmsMediaUploadRouteProps) {
  const userId = await currentAdminUserId();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await props.params;
  const asset = await findUploadAsset(id);
  if (!asset) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json(assetResponse(asset));
}

export async function DELETE(
  _request: Request,
  props: CmsMediaUploadRouteProps
) {
  const userId = await currentAdminUserId();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await props.params;
  const asset = await findUploadAsset(id);
  if (!asset) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (asset.status !== 'uploading') {
    return uploadNotCancellableResponse();
  }
  const result = await prisma.cmsMediaAsset.updateMany({
    data: {
      processingErrorCode: 'upload_cancelled',
      status: 'failed',
    },
    where: { id, status: 'uploading' },
  });
  if (result.count !== 1) {
    return uploadNotCancellableResponse();
  }
  const cancelledAsset = await findUploadAsset(id);
  if (!cancelledAsset) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json(assetResponse(cancelledAsset));
}
