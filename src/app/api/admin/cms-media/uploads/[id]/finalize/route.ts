import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/libs/auth/dal';
import { Role } from '@/libs/auth/roles';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { getCmsMediaTusUploadStatus } from '@/libs/mit-sailing/cmsMediaTusStatus';
import { cmsMediaByteSizeToNumber } from '@/libs/mit-sailing/cmsMediaValidation';
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

async function queueAssetForProcessing(props: {
  id: string;
  processingErrorCode: string | null;
}) {
  const result = await prisma.cmsMediaAsset.updateMany({
    data: {
      processingErrorCode: null,
      status: 'queued',
    },
    where: { id: props.id, status: 'uploading' },
  });
  if (result.count !== 1) {
    return null;
  }
  const queuedAsset = await prisma.cmsMediaAsset.findUnique({
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
    where: { id: props.id },
  });
  if (!queuedAsset) {
    return null;
  }
  try {
    await enqueueCmsMediaProcessingJob(getDefaultQueue(), {
      assetId: props.id,
    });
  } catch (error) {
    await prisma.cmsMediaAsset.updateMany({
      data: {
        processingErrorCode: props.processingErrorCode,
        status: 'uploading',
      },
      where: { id: props.id, status: 'queued' },
    });
    throw error;
  }
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
  if (!Env.MEDIA_UPLOAD_BASE_URL) {
    return NextResponse.json(
      { error: 'upload_service_not_configured' },
      { status: 503 }
    );
  }
  const uploadStatus = await getCmsMediaTusUploadStatus({
    assetId: id,
    baseUrl: Env.MEDIA_UPLOAD_BASE_URL,
    byteSize: cmsMediaByteSizeToNumber(asset.byteSize),
  });
  if (!uploadStatus.complete) {
    return NextResponse.json({ error: 'upload_incomplete' }, { status: 409 });
  }
  let queuedAsset: Awaited<ReturnType<typeof queueAssetForProcessing>>;
  try {
    queuedAsset = await queueAssetForProcessing({
      id,
      processingErrorCode: asset.processingErrorCode,
    });
  } catch {
    return NextResponse.json(
      { error: 'processing_queue_unavailable' },
      { status: 503 }
    );
  }
  if (!queuedAsset) {
    return NextResponse.json(
      { error: 'upload_not_cancellable' },
      { status: 409 }
    );
  }

  return NextResponse.json(assetResponse(queuedAsset));
}
