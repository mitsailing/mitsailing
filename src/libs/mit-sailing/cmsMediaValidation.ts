import path from 'node:path';
import type { CmsMediaKind } from '@/libs/mit-sailing/cmsMediaTypes';

const CMS_MEDIA_MAX_BYTES = 10 * 1024 * 1024;
const CMS_MEDIA_MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const CMS_MEDIA_MAX_FILE_BYTES = 100 * 1024 * 1024;
const CMS_MEDIA_MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

export const CMS_MEDIA_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type CmsMediaMimeType = (typeof CMS_MEDIA_ALLOWED_MIME_TYPES)[number];

const CMS_MEDIA_ALLOWED_FILE_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;

const CMS_MEDIA_ALLOWED_VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const;

export type CmsMediaValidationErrorCode =
  | 'empty_file'
  | 'too_large'
  | 'unsupported_type'
  | 'mime_mismatch'
  | 'unsafe_storage_path';

const CMS_MEDIA_EXTENSIONS: Record<CmsMediaMimeType, string> = {
  'image/gif': '.gif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const CMS_MEDIA_FILE_EXTENSIONS: Record<
  (typeof CMS_MEDIA_ALLOWED_FILE_MIME_TYPES)[number],
  string
> = {
  'application/msword': '.doc',
  'application/pdf': '.pdf',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    '.pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    '.docx',
  'text/plain': '.txt',
};

const CMS_MEDIA_VIDEO_EXTENSIONS: Record<
  (typeof CMS_MEDIA_ALLOWED_VIDEO_MIME_TYPES)[number],
  string
> = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
};

const ALLOWED_MIME_TYPE_SET = new Set<string>(CMS_MEDIA_ALLOWED_MIME_TYPES);
const ALLOWED_FILE_MIME_TYPE_SET = new Set<string>(
  CMS_MEDIA_ALLOWED_FILE_MIME_TYPES
);
const ALLOWED_VIDEO_MIME_TYPE_SET = new Set<string>(
  CMS_MEDIA_ALLOWED_VIDEO_MIME_TYPES
);

function isCmsMediaMimeType(value: string): value is CmsMediaMimeType {
  return ALLOWED_MIME_TYPE_SET.has(value);
}

function isCmsMediaFileMimeType(
  value: string
): value is (typeof CMS_MEDIA_ALLOWED_FILE_MIME_TYPES)[number] {
  return ALLOWED_FILE_MIME_TYPE_SET.has(value);
}

function isCmsMediaVideoMimeType(
  value: string
): value is (typeof CMS_MEDIA_ALLOWED_VIDEO_MIME_TYPES)[number] {
  return ALLOWED_VIDEO_MIME_TYPE_SET.has(value);
}

function bytesStartWith(bytes: Uint8Array, signature: readonly number[]) {
  if (bytes.byteLength < signature.length) {
    return false;
  }
  return signature.every((byte, index) => bytes[index] === byte);
}

/**
 * Detects supported CMS image MIME types from file signatures.
 *
 * @param bytes - Uploaded file bytes
 * @returns Allowed MIME type, or null when unsupported
 */
export function detectCmsMediaMimeType(
  bytes: Uint8Array
): CmsMediaMimeType | null {
  if (bytesStartWith(bytes, [255, 216, 255])) {
    return 'image/jpeg';
  }
  if (bytesStartWith(bytes, [137, 80, 78, 71, 13, 10, 26, 10])) {
    return 'image/png';
  }
  if (
    bytesStartWith(bytes, [71, 73, 70, 56, 55, 97]) ||
    bytesStartWith(bytes, [71, 73, 70, 56, 57, 97])
  ) {
    return 'image/gif';
  }
  if (
    bytes.byteLength >= 12 &&
    bytesStartWith(bytes, [82, 73, 70, 70]) &&
    bytes[8] === 87 &&
    bytes[9] === 69 &&
    bytes[10] === 66 &&
    bytes[11] === 80
  ) {
    return 'image/webp';
  }
  return null;
}

function sanitizeCmsMediaFilenameWithExtension(props: {
  extension: string;
  originalFilename: string;
}): string {
  const basename = path.posix.basename(
    props.originalFilename.replaceAll('\\', '/')
  );
  const normalized = basename
    .normalize('NFKD')
    .replaceAll(/[^\w.-]+/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^\.+/g, '')
    .replaceAll(/\.+$/g, '')
    .toLowerCase();
  const stem =
    normalized
      .replace(/\.[a-z0-9]+$/u, '')
      .replaceAll(/\.+$/g, '')
      .replaceAll(/^-+|-+$/g, '') || 'upload';
  return `${stem.slice(0, 96)}${props.extension}`;
}

/**
 * Produces a stable, URL-friendly filename while preserving the detected type.
 *
 * @param originalFilename - Browser-provided filename
 * @param mimeType - Detected allowed MIME type
 * @returns Safe stored filename
 */
export function sanitizeCmsMediaFilename(
  originalFilename: string,
  mimeType: CmsMediaMimeType
): string {
  return sanitizeCmsMediaFilenameWithExtension({
    extension: CMS_MEDIA_EXTENSIONS[mimeType],
    originalFilename,
  });
}

function sanitizeCmsMediaFilenameForKind(props: {
  mediaKind: CmsMediaKind;
  mimeType: string;
  originalFilename: string;
}): string {
  if (props.mediaKind === 'image' && isCmsMediaMimeType(props.mimeType)) {
    return sanitizeCmsMediaFilename(props.originalFilename, props.mimeType);
  }
  if (props.mediaKind === 'file' && isCmsMediaFileMimeType(props.mimeType)) {
    return sanitizeCmsMediaFilenameWithExtension({
      extension: CMS_MEDIA_FILE_EXTENSIONS[props.mimeType],
      originalFilename: props.originalFilename,
    });
  }
  if (props.mediaKind === 'video' && isCmsMediaVideoMimeType(props.mimeType)) {
    return sanitizeCmsMediaFilenameWithExtension({
      extension: CMS_MEDIA_VIDEO_EXTENSIONS[props.mimeType],
      originalFilename: props.originalFilename,
    });
  }
  return sanitizeCmsMediaFilenameWithExtension({
    extension: '.bin',
    originalFilename: props.originalFilename,
  });
}

export function buildCmsMediaPublicPath(props: {
  id: string;
  filename: string;
}): string {
  return `/cms-media/${encodeURIComponent(props.id)}/${encodeURIComponent(
    props.filename
  )}`;
}

function isStorageSegment(value: string): boolean {
  return (
    value.length > 0 &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !value.includes('\\')
  );
}

/**
 * Resolves a CMS media storage path while enforcing root containment.
 *
 * @param props - Root directory plus DB-backed id/filename segments
 * @returns Absolute storage path, or null when the input escapes the root
 */
export function resolveCmsMediaStoragePath(props: {
  root: string;
  id: string;
  filename: string;
}): string | null {
  if (!isStorageSegment(props.id) || !isStorageSegment(props.filename)) {
    return null;
  }
  const root = path.resolve(props.root);
  const candidate = path.resolve(root, props.id, props.filename);
  const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  return candidate.startsWith(rootPrefix) ? candidate : null;
}

export function validateCmsMediaUpload(props: {
  bytes: Uint8Array;
  declaredMimeType: string;
  originalFilename: string;
}):
  | { ok: true; mimeType: CmsMediaMimeType; storedFilename: string }
  | { ok: false; code: CmsMediaValidationErrorCode } {
  if (props.bytes.byteLength === 0) {
    return { ok: false, code: 'empty_file' };
  }
  if (props.bytes.byteLength > CMS_MEDIA_MAX_BYTES) {
    return { ok: false, code: 'too_large' };
  }
  if (
    props.declaredMimeType.length > 0 &&
    !isCmsMediaMimeType(props.declaredMimeType)
  ) {
    return { ok: false, code: 'unsupported_type' };
  }
  const detected = detectCmsMediaMimeType(props.bytes);
  if (!detected) {
    return { ok: false, code: 'unsupported_type' };
  }
  if (
    props.declaredMimeType.length > 0 &&
    props.declaredMimeType !== detected
  ) {
    return { ok: false, code: 'mime_mismatch' };
  }
  return {
    ok: true,
    mimeType: detected,
    storedFilename: sanitizeCmsMediaFilename(props.originalFilename, detected),
  };
}

export function mediaKindFromMimeType(mimeType: string): CmsMediaKind | null {
  if (isCmsMediaMimeType(mimeType)) {
    return 'image';
  }
  if (isCmsMediaFileMimeType(mimeType)) {
    return 'file';
  }
  if (isCmsMediaVideoMimeType(mimeType)) {
    return 'video';
  }
  return null;
}

function mediaMaxBytes(kind: CmsMediaKind): number {
  if (kind === 'image') {
    return CMS_MEDIA_MAX_IMAGE_BYTES;
  }
  if (kind === 'video') {
    return CMS_MEDIA_MAX_VIDEO_BYTES;
  }
  return CMS_MEDIA_MAX_FILE_BYTES;
}

export function validateCmsMediaMetadata(props: {
  byteSize: number;
  declaredMimeType: string;
  originalFilename: string;
}):
  | {
      ok: true;
      mediaKind: CmsMediaKind;
      mimeType: string;
      storedFilename: string;
    }
  | { ok: false; code: CmsMediaValidationErrorCode } {
  if (props.byteSize <= 0) {
    return { ok: false, code: 'empty_file' };
  }
  const mediaKind = mediaKindFromMimeType(props.declaredMimeType);
  if (!mediaKind) {
    return { ok: false, code: 'unsupported_type' };
  }
  if (props.byteSize > mediaMaxBytes(mediaKind)) {
    return { ok: false, code: 'too_large' };
  }
  return {
    ok: true,
    mediaKind,
    mimeType: props.declaredMimeType,
    storedFilename: sanitizeCmsMediaFilenameForKind({
      mediaKind,
      mimeType: props.declaredMimeType,
      originalFilename: props.originalFilename,
    }),
  };
}

export function detectCmsMediaKind(
  bytes: Uint8Array,
  declaredMimeType: string
): CmsMediaKind | null {
  if (detectCmsMediaMimeType(bytes)) {
    return 'image';
  }
  if (
    declaredMimeType === 'application/pdf' &&
    bytesStartWith(bytes, [37, 80, 68, 70])
  ) {
    return 'file';
  }
  if (
    (declaredMimeType === 'video/mp4' ||
      declaredMimeType === 'video/quicktime') &&
    bytes.byteLength >= 12 &&
    bytes[4] === 102 &&
    bytes[5] === 116 &&
    bytes[6] === 121 &&
    bytes[7] === 112
  ) {
    return 'video';
  }
  if (
    declaredMimeType === 'video/webm' &&
    bytesStartWith(bytes, [26, 69, 223, 163])
  ) {
    return 'video';
  }
  return mediaKindFromMimeType(declaredMimeType);
}
