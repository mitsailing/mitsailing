import type { CmsMediaUploadSessionAsset } from '@/libs/mit-sailing/cmsMediaTypes';
import { createCmsMediaUploadToken } from '@/libs/mit-sailing/cmsMediaUploadTokens';

const CMS_MEDIA_UPLOAD_TOKEN_TTL_MS = 15 * 60 * 1000;

export function buildCmsMediaUploadUrl(props: {
  assetId: string;
  baseUrl: string;
}): string {
  return `${props.baseUrl.replace(/\/$/u, '')}/cms-media/uploads/${encodeURIComponent(
    props.assetId
  )}`;
}

export function createCmsMediaUploadSession(props: {
  asset: CmsMediaUploadSessionAsset;
  baseUrl: string;
  now: Date;
  secret: string;
  storedFilename: string;
}): {
  asset: CmsMediaUploadSessionAsset;
  upload: {
    expiresAt: string;
    headers: {
      'content-type': string;
      'x-mitsailing-upload-token': string;
    };
    method: 'PUT';
    url: string;
  };
} {
  const expiresAt = props.now.getTime() + CMS_MEDIA_UPLOAD_TOKEN_TTL_MS;
  return {
    asset: props.asset,
    upload: {
      expiresAt: new Date(expiresAt).toISOString(),
      headers: {
        'content-type': props.asset.mimeType,
        'x-mitsailing-upload-token': createCmsMediaUploadToken({
          payload: {
            assetId: props.asset.id,
            byteSize: props.asset.byteSize,
            expiresAt,
            mimeType: props.asset.mimeType,
            storedFilename: props.storedFilename,
          },
          secret: props.secret,
        }),
      },
      method: 'PUT',
      url: buildCmsMediaUploadUrl({
        assetId: props.asset.id,
        baseUrl: props.baseUrl,
      }),
    },
  };
}
