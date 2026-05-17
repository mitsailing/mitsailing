import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/libs/auth/dal';
import { Role } from '@/libs/auth/roles';
import { prisma } from '@/libs/DB';
import { enqueueCmsMediaProcessingJob } from '@/worker/cmsMediaProcessingJob';
import { getDefaultQueue } from '@/worker/defaultQueue';

export const runtime = 'nodejs';

type CmsMediaUploadFinalizeRouteProps = {
  params: Promise<{ id: string }>;
};

async function currentAdminUserId(): Promise<string | null> {
  const currentUser = await getCurrentUser();
  return currentUser?.role === Role.ADMIN ? currentUser.id : null;
}

function assetResponse(asset: {
  byteSize: bigint;
  createdAt: Date;
  id: string;
  mediaKind: 'file' | 'image' | 'video';
  mimeType: string;
  originalFilename: string;
  processingErrorCode: string | null;
  publicPath: string;
  status: 'failed' | 'processing' | 'queued' | 'ready' | 'uploading';
}) {
  return {
    asset: {
      byteSize: Number(asset.byteSize),
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

async function queueAssetForProcessing(id: string) {
  const queuedAsset = await prisma.cmsMediaAsset.update({
    data: {
      processingErrorCode: null,
      status: 'queued',
    },
    select: {
      byteSize: true,
      createdAt: true,
      id: true,
      mediaKind: true,
      mimeType: true,
      originalFilename: true,
      processingErrorCode: true,
      publicPath: true,
      status: true,
    },
    where: { id },
  });
  await enqueueCmsMediaProcessingJob(getDefaultQueue(), { assetId: id });
  return queuedAsset;
}

export async function POST(
  _request: Request,
  props: CmsMediaUploadFinalizeRouteProps
) {
  const userId = await currentAdminUserId();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await props.params;
  const asset = await prisma.cmsMediaAsset.findUnique({
    select: {
      byteSize: true,
      createdAt: true,
      id: true,
      mediaKind: true,
      mimeType: true,
      originalFilename: true,
      processingErrorCode: true,
      publicPath: true,
      status: true,
      storageProvider: true,
    },
    where: { id },
  });
  if (!asset) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (asset.storageProvider !== 'server_folder') {
    return NextResponse.json({ error: 'unsupported_storage' }, { status: 409 });
  }
  if (
    asset.status === 'ready' ||
    asset.status === 'processing' ||
    asset.status === 'queued'
  ) {
    return NextResponse.json(assetResponse(asset));
  }
  const queuedAsset = await queueAssetForProcessing(id);

  return NextResponse.json(assetResponse(queuedAsset));
}
