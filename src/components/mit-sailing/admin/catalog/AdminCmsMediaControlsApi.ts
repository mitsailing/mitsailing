import type { CmsMediaTusUploadSession } from './cmsMediaTusUpload';
import { uploadCmsMediaWithTus } from './cmsMediaTusUpload';

const ADMIN_CMS_MEDIA_PATH = '/api/admin/cms-media';
const ADMIN_CMS_MEDIA_UPLOADS_PATH = '/api/admin/cms-media/uploads';
const CMS_MEDIA_UPLOAD_ASSET_ID_PATTERN = /^[a-z0-9_-]+$/iu;

export type CmsMediaAsset = {
  id: string;
  originalFilename: string;
  publicPath: string;
  createdAt: string;
};

export function isCmsMediaPath(value: string | undefined): value is string {
  return typeof value === 'string' && value.startsWith('/cms-media/');
}

export function isAdminImagePath(value: string | undefined): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  return /^\/(?!\/).+\.(?:gif|jpe?g|png|webp)$/iu.test(value.trim());
}

export function parseImageListValue(value: string | string[]): string[] {
  if (Array.isArray(value)) {
    return value.filter(isAdminImagePath);
  }
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(isAdminImagePath);
}

export function currentPageId(form: HTMLFormElement | null): string {
  if (!form) {
    return '';
  }
  const value = new FormData(form).get('pageId');
  return typeof value === 'string' ? value : '';
}

export function stringField(value: unknown, field: string) {
  if (typeof value !== 'object' || value === null) {
    return;
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, field);
  return typeof descriptor?.value === 'string' ? descriptor.value : undefined;
}

function numberField(value: unknown, field: string) {
  if (typeof value !== 'object' || value === null) {
    return;
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, field);
  return typeof descriptor?.value === 'number' &&
    Number.isFinite(descriptor.value)
    ? descriptor.value
    : undefined;
}

export function cmsMediaAssetFromUnknown(value: unknown): CmsMediaAsset | null {
  const id = stringField(value, 'id');
  const originalFilename = stringField(value, 'originalFilename');
  const publicPath = stringField(value, 'publicPath');
  const createdAt = stringField(value, 'createdAt');
  if (!id || !originalFilename || !isCmsMediaPath(publicPath) || !createdAt) {
    return null;
  }
  return { createdAt, id, originalFilename, publicPath };
}

export function cmsMediaAssetsFromUnknown(value: unknown): CmsMediaAsset[] {
  if (typeof value !== 'object' || value === null) {
    return [];
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, 'assets');
  if (!Array.isArray(descriptor?.value)) {
    return [];
  }
  return descriptor.value.flatMap((item: unknown) => {
    const asset = cmsMediaAssetFromUnknown(item);
    return asset ? [asset] : [];
  });
}

function objectField(value: unknown, field: string): unknown {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  return Reflect.get(value, field);
}

function cmsMediaAssetFromApiResponse(value: unknown): CmsMediaAsset | null {
  return (
    cmsMediaAssetFromUnknown(objectField(value, 'asset')) ??
    cmsMediaAssetFromUnknown(value)
  );
}

function cmsMediaUploadedAssetFromUnknown(props: {
  file: File;
  value: unknown;
}): CmsMediaAsset | null {
  const parsed = cmsMediaAssetFromApiResponse(props.value);
  if (parsed) {
    return parsed;
  }
  const publicPath =
    stringField(props.value, 'publicPath') ?? stringField(props.value, 'url');
  if (!isCmsMediaPath(publicPath)) {
    return null;
  }
  return {
    createdAt:
      stringField(props.value, 'createdAt') ?? new Date().toISOString(),
    id: stringField(props.value, 'id') ?? publicPath,
    originalFilename:
      stringField(props.value, 'originalFilename') ?? props.file.name,
    publicPath,
  };
}

export async function loadCmsMediaAssets(
  props: {
    pageId?: string;
  } = {}
): Promise<CmsMediaAsset[] | null> {
  const query = props.pageId
    ? `?${new URLSearchParams({ pageId: props.pageId })}`
    : '';
  const response = await fetch(`${ADMIN_CMS_MEDIA_PATH}${query}`);
  if (!response.ok) {
    return null;
  }
  const data: unknown = await response.json();
  return cmsMediaAssetsFromUnknown(data);
}

async function uploadCmsMediaFileDirect(props: {
  file: File;
  pageId?: string;
}): Promise<CmsMediaAsset | null> {
  const formData = new FormData();
  formData.set('file', props.file);
  if (props.pageId) {
    formData.set('pageId', props.pageId);
  }
  const response = await fetch(ADMIN_CMS_MEDIA_PATH, {
    body: formData,
    method: 'POST',
  });
  if (!response.ok) {
    return null;
  }
  const data: unknown = await response.json();
  return cmsMediaUploadedAssetFromUnknown({ file: props.file, value: data });
}

function stringRecordFromUnknown(
  value: unknown
): Record<string, string> | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const entries = Object.entries(value);
  if (!entries.every((entry) => typeof entry[1] === 'string')) {
    return null;
  }
  return Object.fromEntries(entries);
}

type CmsMediaTusMetadata = CmsMediaTusUploadSession['metadata'];
type CmsMediaTusMetadataCandidate = {
  [Key in keyof CmsMediaTusMetadata]: string | undefined;
};

function hasCompleteTusMetadata(
  value: CmsMediaTusMetadataCandidate
): value is CmsMediaTusMetadata {
  return Object.values(value).every(
    (field) => typeof field === 'string' && field.length > 0
  );
}

function cmsMediaTusMetadataFromUnknown(value: unknown) {
  const metadata = {
    assetId: stringField(value, 'assetId'),
    byteSize: stringField(value, 'byteSize'),
    filename: stringField(value, 'filename'),
    filetype: stringField(value, 'filetype'),
    token: stringField(value, 'token'),
  };
  if (!hasCompleteTusMetadata(metadata)) {
    return null;
  }
  return metadata;
}

function uploadDetailsFromUnknown(
  value: unknown
): CmsMediaTusUploadSession | null {
  const upload = objectField(value, 'upload');
  const byteSize = numberField(upload, 'byteSize');
  const endpoint = stringField(upload, 'endpoint');
  const expiresAt = stringField(upload, 'expiresAt');
  const headers = stringRecordFromUnknown(objectField(upload, 'headers'));
  const metadata = cmsMediaTusMetadataFromUnknown(
    objectField(upload, 'metadata')
  );
  const protocol = stringField(upload, 'protocol');
  if (
    protocol !== 'tus' ||
    !endpoint ||
    !headers ||
    !metadata ||
    byteSize === undefined ||
    byteSize < 0 ||
    !expiresAt
  ) {
    return null;
  }
  return {
    byteSize,
    endpoint,
    expiresAt,
    headers,
    metadata,
    protocol,
  };
}

async function createCmsMediaUploadSession(props: {
  file: File;
  pageId?: string;
}): Promise<{
  asset: CmsMediaAsset;
  upload: CmsMediaTusUploadSession;
} | null> {
  const response = await fetch(ADMIN_CMS_MEDIA_UPLOADS_PATH, {
    body: JSON.stringify({
      byteSize: props.file.size,
      originalFilename: props.file.name,
      pageId: props.pageId,
      type: props.file.type,
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  if (response.status === 503) {
    return null;
  }
  if (!response.ok) {
    throw new Error('CMS media upload session failed');
  }
  const data: unknown = await response.json();
  const asset = cmsMediaUploadedAssetFromUnknown({
    file: props.file,
    value: data,
  });
  const upload = uploadDetailsFromUnknown(data);
  if (asset && upload) {
    return { asset, upload };
  }
  throw new Error('CMS media upload session response invalid');
}

function cmsMediaUploadAssetIdPathSegment(assetId: string): string | null {
  return CMS_MEDIA_UPLOAD_ASSET_ID_PATTERN.test(assetId)
    ? encodeURIComponent(assetId)
    : null;
}

function cmsMediaUploadPath(assetId: string): string | null {
  const pathSegment = cmsMediaUploadAssetIdPathSegment(assetId);
  return pathSegment
    ? [ADMIN_CMS_MEDIA_UPLOADS_PATH, pathSegment].join('/')
    : null;
}

function cmsMediaUploadFinalizePath(assetId: string): string | null {
  const uploadPath = cmsMediaUploadPath(assetId);
  return uploadPath ? [uploadPath, 'finalize'].join('/') : null;
}

async function finalizeCmsMediaUpload(
  assetId: string
): Promise<CmsMediaAsset | null> {
  const path = cmsMediaUploadFinalizePath(assetId);
  if (!path) {
    return null;
  }
  // nosemgrep: rules_lgpl_javascript_ssrf_rule-node-ssrf
  const response = await fetch(path, {
    method: 'POST',
  });
  if (!response.ok) {
    return null;
  }
  const data: unknown = await response.json();
  return cmsMediaAssetFromApiResponse(data);
}

async function cancelCmsMediaUpload(assetId: string): Promise<void> {
  const path = cmsMediaUploadPath(assetId);
  if (!path) {
    return;
  }
  // nosemgrep: rules_lgpl_javascript_ssrf_rule-node-ssrf
  await fetch(path, {
    method: 'DELETE',
  });
}

export async function uploadCmsMediaFile(props: {
  file: File;
  pageId?: string;
}): Promise<CmsMediaAsset | null> {
  const session = await createCmsMediaUploadSession(props);
  if (!session) {
    return uploadCmsMediaFileDirect(props);
  }
  let upload: Awaited<ReturnType<typeof uploadCmsMediaWithTus>>;
  try {
    upload = await uploadCmsMediaWithTus({
      file: props.file,
      session: session.upload,
    });
  } catch (error) {
    await cancelCmsMediaUpload(session.asset.id);
    throw error;
  }
  if (upload.assetId !== session.asset.id) {
    await cancelCmsMediaUpload(session.asset.id);
  }
  const finalized = await finalizeCmsMediaUpload(upload.assetId);
  if (finalized) {
    return finalized;
  }
  console.warn('CMS media upload finalize failed', {
    sessionAssetId: session.asset.id,
    uploadAssetId: upload.assetId,
  });
  return null;
}
