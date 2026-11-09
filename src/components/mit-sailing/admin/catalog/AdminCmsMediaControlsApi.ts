import { reportCmsMediaClientError } from '@/libs/cms/reportCmsMediaClientError';
import {
  CMS_MEDIA_IMAGE_MAX_BYTES,
  CMS_MEDIA_PDF_MAX_BYTES,
  CMS_MEDIA_VIDEO_MAX_BYTES,
} from '@/libs/mit-sailing/cmsMediaValidation';
import type { CmsMediaTusUploadSession } from './cmsMediaTusUpload';
import { uploadCmsMediaWithTus } from './cmsMediaTusUpload';

const ADMIN_CMS_MEDIA_PATH = '/api/admin/cms-media';
const ADMIN_CMS_MEDIA_UPLOADS_PATH = '/api/admin/cms-media/uploads';
const CMS_MEDIA_UPLOAD_ASSET_ID_PATTERN = /^[a-z0-9_-]+$/iu;
const CMS_MEDIA_READY_TIMEOUT_MS = 30_000;
const CMS_MEDIA_READY_POLL_MS = 500;

type CmsMediaAssetStatus =
  | 'failed'
  | 'processing'
  | 'queued'
  | 'ready'
  | 'uploading';

export type CmsMediaAsset = {
  id: string;
  originalFilename: string;
  publicPath: string;
  createdAt: string;
  mimeType?: string;
  status?: CmsMediaAssetStatus;
};

type CmsMediaClientFailure = {
  error: string;
  route: string;
  status: number;
};

export type CmsMediaLoadResult =
  | { ok: true; assets: CmsMediaAsset[] }
  | { ok: false; failure: CmsMediaClientFailure };

export type CmsMediaUploadResult =
  | { ok: true; asset: CmsMediaAsset }
  | { ok: false; failure: CmsMediaClientFailure }
  | { ok: false; formError: string };

export function isCmsMediaPath(value: string | undefined): value is string {
  return typeof value === 'string' && value.startsWith('/cms-media/');
}

export function isAdminImagePath(value: string | undefined): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  return /^\/(?!\/).+\.(?:gif|jpe?g|png|webp)$/iu.test(value.trim());
}

export function isAdminVideoPath(value: string | undefined): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  return /^\/(?!\/).+\.(?:mp4|mov|webm)$/iu.test(value.trim());
}

export function isCmsMediaPdfPath(value: string | undefined): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  return (
    value.startsWith('/cms-media/') && value.toLowerCase().endsWith('.pdf')
  );
}

function isAdminMediaPath(value: string | undefined): value is string {
  return isAdminImagePath(value) || isAdminVideoPath(value);
}

export function parseImageListValue(value: string | string[]): string[] {
  if (Array.isArray(value)) {
    return value.filter(isAdminMediaPath);
  }
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(isAdminMediaPath);
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

function cmsMediaAssetStatusFromUnknown(
  value: string | undefined
): CmsMediaAssetStatus | undefined {
  if (
    value === 'failed' ||
    value === 'processing' ||
    value === 'queued' ||
    value === 'ready' ||
    value === 'uploading'
  ) {
    return value;
  }
  return undefined;
}

export function cmsMediaAssetFromUnknown(value: unknown): CmsMediaAsset | null {
  const id = stringField(value, 'id');
  const originalFilename = stringField(value, 'originalFilename');
  const publicPath = stringField(value, 'publicPath');
  const createdAt = stringField(value, 'createdAt');
  if (!id || !originalFilename || !isCmsMediaPath(publicPath) || !createdAt) {
    return null;
  }
  const status = cmsMediaAssetStatusFromUnknown(stringField(value, 'status'));
  const mimeType = stringField(value, 'mimeType');
  const asset = { createdAt, id, originalFilename, publicPath };
  return {
    ...asset,
    ...(mimeType ? { mimeType } : {}),
    ...(status ? { status } : {}),
  };
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
    mimeType: stringField(props.value, 'mimeType') ?? props.file.type,
    originalFilename:
      stringField(props.value, 'originalFilename') ?? props.file.name,
    publicPath,
  };
}

async function responseErrorMessage(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    const error = stringField(data, 'error');
    if (error) {
      return error;
    }
  } catch {
    // Fall through to status text.
  }
  return response.statusText || `HTTP ${response.status}`;
}

function validateCmsMediaBrowserFile(file: File): string | null {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  const isPdf = type === 'application/pdf' || name.endsWith('.pdf');
  const isHeic =
    type === 'image/heic' ||
    type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif');
  const isImage =
    type === 'image/jpeg' ||
    type === 'image/jpg' ||
    type === 'image/png' ||
    type === 'image/webp' ||
    type === 'image/gif' ||
    isHeic ||
    /\.(?:jpe?g|png|webp|gif)$/u.test(name);
  const isVideo =
    type === 'video/mp4' ||
    type === 'video/webm' ||
    type === 'video/quicktime' ||
    /\.(?:mp4|webm|mov)$/u.test(name);

  if (isPdf) {
    if (file.size > CMS_MEDIA_PDF_MAX_BYTES) {
      return 'too_large';
    }
    return null;
  }
  if (isImage) {
    if (file.size > CMS_MEDIA_IMAGE_MAX_BYTES) {
      return 'too_large';
    }
    return null;
  }
  if (isVideo) {
    if (file.size > CMS_MEDIA_VIDEO_MAX_BYTES) {
      return 'too_large';
    }
    return null;
  }
  return 'unsupported_type';
}

export async function loadCmsMediaAssets(
  props: {
    userId?: string | null;
  } = {}
): Promise<CmsMediaLoadResult> {
  const response = await fetch(ADMIN_CMS_MEDIA_PATH);
  if (!response.ok) {
    const error = await responseErrorMessage(response);
    const failure = {
      error,
      route: ADMIN_CMS_MEDIA_PATH,
      status: response.status,
    };
    reportCmsMediaClientError({
      action: 'listAssets',
      message: error,
      route: failure.route,
      status: failure.status,
      userId: props.userId,
    });
    return { ok: false, failure };
  }
  const data: unknown = await response.json();
  return { ok: true, assets: cmsMediaAssetsFromUnknown(data) };
}

async function uploadCmsMediaFileDirect(props: {
  file: File;
  userId?: string | null;
}): Promise<CmsMediaUploadResult> {
  const formData = new FormData();
  formData.set('file', props.file);
  const response = await fetch(ADMIN_CMS_MEDIA_PATH, {
    body: formData,
    method: 'POST',
  });
  if (!response.ok) {
    const error = await responseErrorMessage(response);
    const failure = {
      error,
      route: ADMIN_CMS_MEDIA_PATH,
      status: response.status,
    };
    reportCmsMediaClientError({
      action: 'uploadFile',
      message: error,
      route: failure.route,
      status: failure.status,
      userId: props.userId,
    });
    return { ok: false, failure };
  }
  const data: unknown = await response.json();
  const asset = cmsMediaUploadedAssetFromUnknown({
    file: props.file,
    value: data,
  });
  if (!asset) {
    const failure = {
      error: 'invalid_upload_response',
      route: ADMIN_CMS_MEDIA_PATH,
      status: 500,
    };
    reportCmsMediaClientError({
      action: 'uploadFile',
      message: failure.error,
      route: failure.route,
      status: failure.status,
      userId: props.userId,
    });
    return { ok: false, failure };
  }
  return { ok: true, asset };
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

type CreateSessionResult =
  | {
      ok: true;
      session: { asset: CmsMediaAsset; upload: CmsMediaTusUploadSession };
    }
  | { ok: false; fallbackDirect: true }
  | { ok: false; failure: CmsMediaClientFailure };

async function createCmsMediaUploadSession(props: {
  file: File;
  userId?: string | null;
}): Promise<CreateSessionResult> {
  const response = await fetch(ADMIN_CMS_MEDIA_UPLOADS_PATH, {
    body: JSON.stringify({
      byteSize: props.file.size,
      originalFilename: props.file.name,
      type: props.file.type,
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  if (response.status === 503) {
    return { ok: false, fallbackDirect: true };
  }
  if (!response.ok) {
    const error = await responseErrorMessage(response);
    const failure = {
      error,
      route: ADMIN_CMS_MEDIA_UPLOADS_PATH,
      status: response.status,
    };
    reportCmsMediaClientError({
      action: 'uploadFile',
      message: error,
      route: failure.route,
      status: failure.status,
      userId: props.userId,
    });
    return { ok: false, failure };
  }
  const data: unknown = await response.json();
  const asset = cmsMediaUploadedAssetFromUnknown({
    file: props.file,
    value: data,
  });
  const upload = uploadDetailsFromUnknown(data);
  if (asset && upload) {
    return { ok: true, session: { asset, upload } };
  }
  const failure = {
    error: 'invalid_upload_session',
    route: ADMIN_CMS_MEDIA_UPLOADS_PATH,
    status: 500,
  };
  reportCmsMediaClientError({
    action: 'uploadFile',
    message: failure.error,
    route: failure.route,
    status: failure.status,
    userId: props.userId,
  });
  return { ok: false, failure };
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

async function finalizeCmsMediaUpload(props: {
  assetId: string;
  userId?: string | null;
}): Promise<CmsMediaUploadResult> {
  const path = cmsMediaUploadFinalizePath(props.assetId);
  if (!path) {
    const failure = {
      error: 'invalid_asset_id',
      route: ADMIN_CMS_MEDIA_UPLOADS_PATH,
      status: 400,
    };
    reportCmsMediaClientError({
      action: 'finalizeUpload',
      message: failure.error,
      route: failure.route,
      status: failure.status,
      uploadAssetId: props.assetId,
      userId: props.userId,
    });
    return { ok: false, failure };
  }
  // nosemgrep: rules_lgpl_javascript_ssrf_rule-node-ssrf
  const response = await fetch(path, {
    method: 'POST',
  });
  if (!response.ok) {
    const error = await responseErrorMessage(response);
    const failure = {
      error,
      route: path,
      status: response.status,
    };
    reportCmsMediaClientError({
      action: 'finalizeUpload',
      message: error,
      route: failure.route,
      status: failure.status,
      uploadAssetId: props.assetId,
      userId: props.userId,
    });
    return { ok: false, failure };
  }
  const data: unknown = await response.json();
  const asset = cmsMediaAssetFromApiResponse(data);
  if (!asset) {
    const failure = {
      error: 'invalid_finalize_response',
      route: path,
      status: 500,
    };
    reportCmsMediaClientError({
      action: 'finalizeUpload',
      message: failure.error,
      route: failure.route,
      status: failure.status,
      uploadAssetId: props.assetId,
      userId: props.userId,
    });
    return { ok: false, failure };
  }
  return { ok: true, asset };
}

async function delay(ms: number): Promise<void> {
  const deferred = Promise.withResolvers<boolean>();
  globalThis.setTimeout(() => {
    deferred.resolve(true);
  }, ms);
  await deferred.promise;
}

async function waitForCmsMediaReady(props: {
  assetId: string;
  userId?: string | null;
}): Promise<CmsMediaUploadResult> {
  const path = cmsMediaUploadPath(props.assetId);
  if (!path) {
    return {
      ok: false,
      failure: {
        error: 'invalid_asset_id',
        route: ADMIN_CMS_MEDIA_UPLOADS_PATH,
        status: 400,
      },
    };
  }
  const deadline = Date.now() + CMS_MEDIA_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    // nosemgrep: rules_lgpl_javascript_ssrf_rule-node-ssrf -- path is a same-origin upload API route built from an allowlisted asset id.
    const response = await fetch(path);
    if (!response.ok) {
      const error = await responseErrorMessage(response);
      const failure = {
        error,
        route: path,
        status: response.status,
      };
      reportCmsMediaClientError({
        action: 'uploadFile',
        message: error,
        route: failure.route,
        status: failure.status,
        uploadAssetId: props.assetId,
        userId: props.userId,
      });
      return { ok: false, failure };
    }
    const asset = cmsMediaAssetFromApiResponse(await response.json());
    if (!asset) {
      return {
        ok: false,
        failure: {
          error: 'invalid_upload_status',
          route: path,
          status: 500,
        },
      };
    }
    if (asset.status === 'ready') {
      return { ok: true, asset };
    }
    if (asset.status === 'failed') {
      const failure = {
        error: 'processing_failed',
        route: path,
        status: 500,
      };
      reportCmsMediaClientError({
        action: 'uploadFile',
        message: failure.error,
        route: failure.route,
        status: failure.status,
        uploadAssetId: props.assetId,
        userId: props.userId,
      });
      return { ok: false, failure };
    }
    await delay(CMS_MEDIA_READY_POLL_MS);
  }
  const failure = {
    error: 'processing_timeout',
    route: path,
    status: 504,
  };
  reportCmsMediaClientError({
    action: 'uploadFile',
    message: failure.error,
    route: failure.route,
    status: failure.status,
    uploadAssetId: props.assetId,
    userId: props.userId,
  });
  return { ok: false, failure };
}

async function cancelCmsMediaUpload(props: {
  assetId: string;
  userId?: string | null;
}): Promise<void> {
  const path = cmsMediaUploadPath(props.assetId);
  if (!path) {
    return;
  }
  try {
    // nosemgrep: rules_lgpl_javascript_ssrf_rule-node-ssrf -- path is a same-origin upload API route built from an allowlisted asset id.
    const response = await fetch(path, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(
        `CMS media upload cancel failed: ${response.status} ${response.statusText}`
      );
    }
  } catch (error) {
    reportCmsMediaClientError({
      action: 'cancelUpload',
      assetId: props.assetId,
      error,
      message: 'Failed to cancel CMS media upload',
      route: path,
      status: 500,
      userId: props.userId,
    });
  }
}

export async function uploadCmsMediaFile(props: {
  file: File;
  userId?: string | null;
}): Promise<CmsMediaUploadResult> {
  const browserError = validateCmsMediaBrowserFile(props.file);
  if (browserError) {
    return { ok: false, formError: browserError };
  }
  const sessionResult = await createCmsMediaUploadSession(props);
  if (!sessionResult.ok) {
    if ('fallbackDirect' in sessionResult) {
      return uploadCmsMediaFileDirect(props);
    }
    return sessionResult;
  }
  const { session } = sessionResult;
  let upload: Awaited<ReturnType<typeof uploadCmsMediaWithTus>>;
  try {
    upload = await uploadCmsMediaWithTus({
      file: props.file,
      session: session.upload,
    });
  } catch (error) {
    await cancelCmsMediaUpload({
      assetId: session.asset.id,
      userId: props.userId,
    });
    throw error;
  }
  if (upload.assetId !== session.asset.id) {
    await cancelCmsMediaUpload({
      assetId: session.asset.id,
      userId: props.userId,
    });
    const failure = {
      error: 'upload_asset_mismatch',
      route: ADMIN_CMS_MEDIA_UPLOADS_PATH,
      status: 500,
    };
    reportCmsMediaClientError({
      action: 'uploadFile',
      message: failure.error,
      route: failure.route,
      sessionAssetId: session.asset.id,
      status: failure.status,
      uploadAssetId: upload.assetId,
      userId: props.userId,
    });
    return { ok: false, failure };
  }
  const finalized = await finalizeCmsMediaUpload({
    assetId: upload.assetId,
    userId: props.userId,
  });
  if (!finalized.ok) {
    return finalized;
  }
  if (finalized.asset.status === 'ready' || !finalized.asset.status) {
    return finalized;
  }
  return waitForCmsMediaReady({
    assetId: upload.assetId,
    userId: props.userId,
  });
}
