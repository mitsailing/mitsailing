export const CMS_MEDIA_KINDS = ['image', 'file', 'video'] as const;

export type CmsMediaKind = (typeof CMS_MEDIA_KINDS)[number];

export type CmsMediaUploadTokenPayload = {
  assetId: string;
  byteSize: number;
  expiresAt: number;
  mimeType: string;
  storedFilename: string;
};

export type CmsMediaUploadSessionAsset = {
  id: string;
  byteSize: number;
  createdAt: string;
  mediaKind: CmsMediaKind;
  mimeType: string;
  originalFilename: string;
  publicPath: string;
  status: 'failed' | 'processing' | 'queued' | 'ready' | 'uploading';
};
