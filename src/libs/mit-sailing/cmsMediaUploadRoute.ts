import { prisma } from '@/libs/DB';
import { cmsMediaByteSizeToNumber } from '@/libs/mit-sailing/cmsMediaValidation';

const CMS_MEDIA_UPLOAD_ROUTE_ASSET_SELECT = {
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
} as const;

export type CmsMediaUploadRouteAsset = {
  byteSize: bigint;
  createdAt: Date;
  id: string;
  mediaKind: 'file' | 'image' | 'video';
  mimeType: string;
  originalFilename: string;
  processingErrorCode: string | null;
  publicPath: string;
  status: 'failed' | 'processing' | 'queued' | 'ready' | 'uploading';
  storageProvider: 'local' | 'server_folder';
};

export type CmsMediaUploadRouteAssetStatus = CmsMediaUploadRouteAsset['status'];

export function isFinalizeIdempotentSuccessStatus(
  status: CmsMediaUploadRouteAssetStatus
) {
  return status === 'processing' || status === 'ready';
}

export function isUploadCancelIdempotentSuccess(
  asset: CmsMediaUploadRouteAsset
) {
  return (
    asset.status === 'failed' &&
    asset.processingErrorCode === 'upload_cancelled'
  );
}

export function cmsMediaUploadRouteAssetResponse(asset: {
  byteSize: bigint;
  createdAt: Date;
  id: string;
  mediaKind: CmsMediaUploadRouteAsset['mediaKind'];
  mimeType: string;
  originalFilename: string;
  processingErrorCode: string | null;
  publicPath: string;
  status: CmsMediaUploadRouteAssetStatus;
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

export async function findCmsMediaUploadRouteAsset(id: string) {
  const asset = await prisma.cmsMediaAsset.findUnique({
    select: CMS_MEDIA_UPLOAD_ROUTE_ASSET_SELECT,
    where: { id },
  });
  return asset;
}
