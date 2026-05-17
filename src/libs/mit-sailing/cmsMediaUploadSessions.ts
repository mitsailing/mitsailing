import type { CmsMediaUploadSessionAsset } from '@/libs/mit-sailing/cmsMediaTypes';
import { createCmsMediaUploadToken } from '@/libs/mit-sailing/cmsMediaUploadTokens';

const CMS_MEDIA_UPLOAD_TOKEN_TTL_MS = 15 * 60 * 1000;

export function buildCmsMediaTusEndpoint(props: { baseUrl: string }): string {
  return `${props.baseUrl.replace(/\/$/u, '')}/cms-media/uploads/`;
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
    byteSize: number;
    endpoint: string;
    expiresAt: string;
    headers: Record<string, string>;
    metadata: {
      assetId: string;
      byteSize: string;
      filename: string;
      filetype: string;
      token: string;
    };
    protocol: 'tus';
  };
} {
  const expiresAt = props.now.getTime() + CMS_MEDIA_UPLOAD_TOKEN_TTL_MS;
  const token = createCmsMediaUploadToken({
    payload: {
      assetId: props.asset.id,
      byteSize: props.asset.byteSize,
      expiresAt,
      mimeType: props.asset.mimeType,
      storedFilename: props.storedFilename,
    },
    secret: props.secret,
  });
  return {
    asset: props.asset,
    upload: {
      byteSize: props.asset.byteSize,
      endpoint: buildCmsMediaTusEndpoint({
        baseUrl: props.baseUrl,
      }),
      expiresAt: new Date(expiresAt).toISOString(),
      headers: {
        'x-mitsailing-upload-token': token,
      },
      metadata: {
        assetId: props.asset.id,
        byteSize: String(props.asset.byteSize),
        filename: props.storedFilename,
        filetype: props.asset.mimeType,
        token,
      },
      protocol: 'tus',
    },
  };
}
