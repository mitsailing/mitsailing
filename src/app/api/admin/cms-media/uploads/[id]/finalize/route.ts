import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/libs/auth/dal';
import { Role } from '@/libs/auth/roles';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { getCmsMediaTusUploadStatus } from '@/libs/mit-sailing/cmsMediaTusStatus';
import {
  cmsMediaUploadRouteAssetResponse,
  findCmsMediaUploadRouteAsset,
  isFinalizeIdempotentSuccessStatus,
} from '@/libs/mit-sailing/cmsMediaUploadRoute';
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

async function readCmsMediaTusUploadStatus(props: {
  assetId: string;
  baseUrl: string;
  byteSize: number;
}): Promise<Awaited<ReturnType<typeof getCmsMediaTusUploadStatus>> | null> {
  try {
    return await getCmsMediaTusUploadStatus(props);
  } catch (error) {
    logger.warn('Failed to read tusd upload status before finalize: {error}', {
      assetId: props.assetId,
      error,
    });
    return null;
  }
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
    const existingAsset = await findCmsMediaUploadRouteAsset(props.id);
    if (
      existingAsset &&
      isFinalizeIdempotentSuccessStatus(existingAsset.status)
    ) {
      return existingAsset;
    }
    return null;
  }
  const queuedAsset = await findCmsMediaUploadRouteAsset(props.id);
  if (!queuedAsset) {
    return null;
  }
  try {
    await enqueueCmsMediaProcessingJob(getDefaultQueue(), {
      assetId: props.id,
    });
  } catch (error) {
    try {
      await prisma.cmsMediaAsset.updateMany({
        data: {
          processingErrorCode: props.processingErrorCode,
          status: 'uploading',
        },
        where: { id: props.id, status: 'queued' },
      });
    } catch (repairError) {
      logger.error('Failed to repair CMS media asset queue state: {error}', {
        assetId: props.id,
        error: repairError,
        processingErrorCode: props.processingErrorCode,
      });
    }
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
  const asset = await findCmsMediaUploadRouteAsset(id);
  if (!asset) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (asset.storageProvider !== 'server_folder') {
    return NextResponse.json({ error: 'unsupported_storage' }, { status: 409 });
  }
  if (isFinalizeIdempotentSuccessStatus(asset.status)) {
    return NextResponse.json(cmsMediaUploadRouteAssetResponse(asset));
  }
  if (!Env.MEDIA_UPLOAD_BASE_URL) {
    return NextResponse.json(
      { error: 'upload_service_not_configured' },
      { status: 503 }
    );
  }
  const uploadStatus = await readCmsMediaTusUploadStatus({
    assetId: id,
    baseUrl: Env.MEDIA_UPLOAD_BASE_URL,
    byteSize: cmsMediaByteSizeToNumber(asset.byteSize),
  });
  if (!uploadStatus) {
    return NextResponse.json(
      { error: 'upload_status_unavailable' },
      { status: 503 }
    );
  }
  if (!uploadStatus.complete) {
    if (uploadStatus.reason === 'upload_status_unavailable') {
      logger.warn('tusd upload status unavailable before finalize', {
        assetId: id,
      });
      return NextResponse.json(
        { error: 'upload_status_unavailable' },
        { status: 503 }
      );
    }
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
      { error: 'upload_finalize_conflict' },
      { status: 409 }
    );
  }

  return NextResponse.json(cmsMediaUploadRouteAssetResponse(queuedAsset));
}
