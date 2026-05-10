import path from 'node:path';

const CMS_MEDIA_MAX_BYTES = 10 * 1024 * 1024;

export const CMS_MEDIA_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type CmsMediaMimeType = (typeof CMS_MEDIA_ALLOWED_MIME_TYPES)[number];

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

const ALLOWED_MIME_TYPE_SET = new Set<string>(CMS_MEDIA_ALLOWED_MIME_TYPES);

function isCmsMediaMimeType(value: string): value is CmsMediaMimeType {
  return ALLOWED_MIME_TYPE_SET.has(value);
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
  const basename = path.posix.basename(originalFilename.replaceAll('\\', '/'));
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
  return `${stem.slice(0, 96)}${CMS_MEDIA_EXTENSIONS[mimeType]}`;
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
