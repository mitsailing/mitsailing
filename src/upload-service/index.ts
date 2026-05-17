import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { Env } from '@/libs/Env';
import { logger } from '@/libs/Logger';
import { createCmsMediaUploadService } from '@/upload-service/server';

const uploadSecret = Env.MEDIA_UPLOAD_SHARED_SECRET;

if (!uploadSecret) {
  throw new Error('MEDIA_UPLOAD_SHARED_SECRET is required for upload service');
}

const service = createCmsMediaUploadService({
  allowedOrigin: Env.NEXT_PUBLIC_APP_URL,
  root: Env.MEDIA_STORAGE_ROOT,
  secret: uploadSecret,
});

function requestHeaders(request: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
    } else if (typeof value === 'string') {
      headers.set(key, value);
    }
  }
  return headers;
}

function requestBody(request: IncomingMessage): BodyInit {
  return new ReadableStream<Uint8Array>({
    cancel(): void {
      request.destroy();
    },
    start(controller): void {
      request.on('data', (chunk: unknown) => {
        if (chunk instanceof Uint8Array) {
          controller.enqueue(chunk);
        }
      });
      request.once('end', () => {
        controller.close();
      });
      request.once('error', (error) => {
        controller.error(error);
      });
    },
  });
}

type StreamingRequestInit = RequestInit & {
  duplex: 'half';
};

const server = createServer(async (request, response) => {
  const host = request.headers.host ?? '127.0.0.1:3000';
  const url = new URL(request.url ?? '/', `http://${host}`);
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const requestInit: StreamingRequestInit = {
    body: hasBody ? requestBody(request) : undefined,
    duplex: 'half',
    headers: requestHeaders(request),
    method: request.method,
  };
  const serviceResponse = await service.handle(new Request(url, requestInit));

  response.statusCode = serviceResponse.status;
  for (const [key, value] of serviceResponse.headers.entries()) {
    response.setHeader(key, value);
  }
  response.end();
});

server.listen(3000, '0.0.0.0', () => {
  logger.info('CMS media upload service started');
});
