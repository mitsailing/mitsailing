import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/libs/auth/dal';
import { Role } from '@/libs/auth/roles';
import { prisma } from '@/libs/DB';
import {
  cmsMediaUploadRouteAssetResponse,
  findCmsMediaUploadRouteAsset,
  isUploadCancelIdempotentSuccess,
} from '@/libs/mit-sailing/cmsMediaUploadRoute';

export const runtime = 'nodejs';

type CmsMediaUploadRouteProps = {
  params: Promise<{ id: string }>;
};

async function currentAdminUserId(): Promise<string | null> {
  const currentUser = await getCurrentUser();
  return currentUser?.role === Role.ADMIN ? currentUser.id : null;
}

function uploadNotCancellableResponse() {
  return NextResponse.json(
    { error: 'upload_not_cancellable' },
    { status: 409 }
  );
}

async function cancelUploadAsset(id: string) {
  const result = await prisma.cmsMediaAsset.updateMany({
    data: {
      processingErrorCode: 'upload_cancelled',
      status: 'failed',
    },
    where: { id, status: 'uploading' },
  });
  if (result.count !== 1) {
    const existingAsset = await findCmsMediaUploadRouteAsset(id);
    if (existingAsset && isUploadCancelIdempotentSuccess(existingAsset)) {
      return existingAsset;
    }
    return null;
  }
  return findCmsMediaUploadRouteAsset(id);
}

export async function GET(_request: Request, props: CmsMediaUploadRouteProps) {
  const userId = await currentAdminUserId();
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await props.params;
  const asset = await findCmsMediaUploadRouteAsset(id);
  if (!asset) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json(cmsMediaUploadRouteAssetResponse(asset));
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
  const asset = await findCmsMediaUploadRouteAsset(id);
  if (!asset) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (asset.status !== 'uploading') {
    if (isUploadCancelIdempotentSuccess(asset)) {
      return NextResponse.json(cmsMediaUploadRouteAssetResponse(asset));
    }
    return uploadNotCancellableResponse();
  }
  const cancelledAsset = await cancelUploadAsset(id);
  if (!cancelledAsset) {
    const existingAsset = await findCmsMediaUploadRouteAsset(id);
    if (!existingAsset) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return uploadNotCancellableResponse();
  }

  return NextResponse.json(cmsMediaUploadRouteAssetResponse(cancelledAsset));
}
