import { randomUUID } from 'node:crypto';
import { mkdir, open, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { resolveCmsMediaUploadFilePath } from '@/libs/mit-sailing/cmsMediaFileStorage';
import { verifyCmsMediaUploadToken } from '@/libs/mit-sailing/cmsMediaUploadTokens';

type CmsMediaUploadServiceOptions = {
  allowedOrigin?: string;
  now?: () => Date;
  root: string;
  secret: string;
};

type UploadValidation =
  | {
      ok: true;
      byteSize: number;
      uploadId: string;
      uploadPath: string;
    }
  | {
      ok: false;
      status: number;
    };

type UploadTokenValidation =
  | {
      ok: true;
      byteSize: number;
      uploadId: string;
    }
  | {
      ok: false;
      status: number;
    };

function uploadIdFromUrl(url: string): string | null {
  const { pathname } = new URL(url);
  const prefix = '/cms-media/uploads/';
  if (!pathname.startsWith(prefix)) {
    return null;
  }
  const uploadId = pathname.slice(prefix.length);
  return uploadId.length > 0 && !uploadId.includes('/') ? uploadId : null;
}

function contentLength(request: Request): number | null {
  const value = request.headers.get('content-length');
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function validationResponse(status: number): UploadValidation {
  return { ok: false, status };
}

function validateUploadDestination(options: {
  root: string;
  uploadId: string | null;
}): { ok: true; uploadPath: string; uploadId: string } | UploadValidation {
  if (!options.uploadId) {
    return validationResponse(404);
  }
  const uploadPath = resolveCmsMediaUploadFilePath({
    root: options.root,
    uploadId: options.uploadId,
  });
  if (!uploadPath) {
    return validationResponse(400);
  }
  return { ok: true, uploadId: options.uploadId, uploadPath };
}

function validateUploadToken(
  request: Request,
  options: CmsMediaUploadServiceOptions & { uploadId: string }
): UploadTokenValidation {
  const token = request.headers.get('x-mitsailing-upload-token');
  if (!token) {
    return validationResponse(401);
  }
  const payload = verifyCmsMediaUploadToken({
    now: options.now?.(),
    secret: options.secret,
    token,
  });
  if (payload?.assetId !== options.uploadId) {
    return validationResponse(403);
  }
  const requestLength = contentLength(request);
  if (requestLength === null) {
    return validationResponse(411);
  }
  if (requestLength !== payload.byteSize) {
    return validationResponse(400);
  }
  if (request.headers.get('content-type') !== payload.mimeType) {
    return validationResponse(415);
  }
  return {
    byteSize: payload.byteSize,
    ok: true,
    uploadId: options.uploadId,
  };
}

function validateUploadRequest(
  request: Request,
  options: CmsMediaUploadServiceOptions
): UploadValidation {
  const destination = validateUploadDestination({
    root: options.root,
    uploadId: uploadIdFromUrl(request.url),
  });
  if (!destination.ok) {
    return destination;
  }
  const token = validateUploadToken(request, {
    ...options,
    uploadId: destination.uploadId,
  });
  if (!token.ok) {
    return token;
  }
  return { ...token, uploadPath: destination.uploadPath };
}

function responseWithCors(
  request: Request,
  options: CmsMediaUploadServiceOptions,
  init: ResponseInit
): Response {
  const headers = new Headers(init.headers);
  const origin = request.headers.get('origin');
  if (options.allowedOrigin && origin === options.allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', options.allowedOrigin);
    headers.set('Vary', 'Origin');
  }
  return new Response(null, { ...init, headers });
}

function preflightResponse(
  request: Request,
  options: CmsMediaUploadServiceOptions
): Response {
  return responseWithCors(request, options, {
    headers: {
      'Access-Control-Allow-Headers': 'content-type,x-mitsailing-upload-token',
      'Access-Control-Allow-Methods': 'PUT,OPTIONS',
      'Access-Control-Max-Age': '600',
    },
    status: 204,
  });
}

async function writeRequestBody(props: {
  expectedBytes: number;
  stream: ReadableStream<Uint8Array>;
  tempPath: string;
}): Promise<number> {
  let actualBytes = 0;
  const reader = props.stream.getReader();
  const handle = await open(props.tempPath, 'wx', 0o600);
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }
      actualBytes += result.value.byteLength;
      if (actualBytes > props.expectedBytes) {
        return 413;
      }
      let offset = 0;
      while (offset < result.value.byteLength) {
        const { bytesWritten } = await handle.write(
          result.value,
          offset,
          result.value.byteLength - offset
        );
        if (bytesWritten <= 0) {
          return 500;
        }
        offset += bytesWritten;
      }
    }
  } finally {
    await handle.close();
  }
  return actualBytes === props.expectedBytes ? 201 : 400;
}

async function writeUpload(props: {
  byteSize: number;
  request: Request;
  uploadPath: string;
}): Promise<number> {
  if (!props.request.body) {
    return 400;
  }
  await mkdir(path.dirname(props.uploadPath), { recursive: true });
  const tempPath = `${props.uploadPath}.tmp-${randomUUID()}`;
  const status = await writeRequestBody({
    expectedBytes: props.byteSize,
    stream: props.request.body,
    tempPath,
  });
  if (status !== 201) {
    await rm(tempPath, { force: true });
    return status;
  }
  try {
    await rename(tempPath, props.uploadPath);
  } catch (error: unknown) {
    try {
      await rm(tempPath, { force: true });
    } catch {
      // Preserve the original write or rename error.
    }
    throw error;
  }
  return 201;
}

export function createCmsMediaUploadService(
  options: CmsMediaUploadServiceOptions
): {
  handle: (request: Request) => Promise<Response>;
} {
  return {
    async handle(request: Request): Promise<Response> {
      if (
        request.method === 'GET' &&
        new URL(request.url).pathname === '/api/health/live'
      ) {
        return responseWithCors(request, options, { status: 204 });
      }
      if (request.method === 'OPTIONS') {
        return preflightResponse(request, options);
      }
      if (request.method !== 'PUT') {
        return responseWithCors(request, options, { status: 405 });
      }
      const validation = validateUploadRequest(request, options);
      if (!validation.ok) {
        return responseWithCors(request, options, {
          status: validation.status,
        });
      }
      const status = await writeUpload({
        byteSize: validation.byteSize,
        request,
        uploadPath: validation.uploadPath,
      });
      return responseWithCors(request, options, { status });
    },
  };
}
