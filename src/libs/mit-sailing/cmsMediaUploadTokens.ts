import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CmsMediaUploadTokenPayload } from '@/libs/mit-sailing/cmsMediaTypes';

function encodePayload(payload: CmsMediaUploadTokenPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function signPayloadSegment(props: {
  payloadSegment: string;
  secret: string;
}): string {
  return createHmac('sha256', props.secret)
    .update(props.payloadSegment)
    .digest('base64url');
}

function signaturesMatch(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'base64url');
  const rightBytes = Buffer.from(right, 'base64url');
  return (
    leftBytes.byteLength === rightBytes.byteLength &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}

function parseUploadPayload(value: string): CmsMediaUploadTokenPayload | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const assetId = Reflect.get(parsed, 'assetId');
  const byteSize = Reflect.get(parsed, 'byteSize');
  const expiresAt = Reflect.get(parsed, 'expiresAt');
  const mimeType = Reflect.get(parsed, 'mimeType');
  const storedFilename = Reflect.get(parsed, 'storedFilename');
  if (
    typeof assetId !== 'string' ||
    typeof byteSize !== 'number' ||
    typeof expiresAt !== 'number' ||
    typeof mimeType !== 'string' ||
    typeof storedFilename !== 'string'
  ) {
    return null;
  }
  return { assetId, byteSize, expiresAt, mimeType, storedFilename };
}

export function createCmsMediaUploadToken(props: {
  payload: CmsMediaUploadTokenPayload;
  secret: string;
}): string {
  const payloadSegment = encodePayload(props.payload);
  const signature = signPayloadSegment({
    payloadSegment,
    secret: props.secret,
  });
  return `${payloadSegment}.${signature}`;
}

export function verifyCmsMediaUploadToken(props: {
  now?: Date;
  secret: string;
  token: string;
}): CmsMediaUploadTokenPayload | null {
  const segments = props.token.split('.');
  const [payloadSegment, signature] = segments;
  if (segments.length !== 2 || !payloadSegment || !signature) {
    return null;
  }
  const expectedSignature = signPayloadSegment({
    payloadSegment,
    secret: props.secret,
  });
  if (!signaturesMatch(signature, expectedSignature)) {
    return null;
  }
  const payload = parseUploadPayload(payloadSegment);
  if (!payload) {
    return null;
  }
  const now = props.now ?? new Date();
  return payload.expiresAt > now.getTime() ? payload : null;
}
