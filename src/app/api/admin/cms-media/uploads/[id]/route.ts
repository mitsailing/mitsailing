import { NextResponse } from 'next/server';
import { prisma } from '@/libs/DB';
import { authorizeCmsMediaLibraryAccess } from '@/libs/mit-sailing/cmsMediaAuthorization';
import {
  cmsMediaUploadRouteAssetResponse,
  findCmsMediaUploadRouteAsset,
  isUploadCancelIdempotentSuccess,
} from '@/libs/mit-sailing/cmsMediaUploadRoute';

export const runtime = 'nodejs';

type CmsMediaUploadRouteProps = {
  params: Promise<{ id: string }>;
};

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
  const auth = await authorizeCmsMediaLibraryAccess();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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
  const auth = await authorizeCmsMediaLibraryAccess();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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
