import { once } from 'node:events';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
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

const INTERNAL_BASE_URL = 'http://127.0.0.1';

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

async function writeResponseBody(props: {
  body: ReadableStream<Uint8Array> | null;
  response: ServerResponse;
}): Promise<void> {
  if (!props.body) {
    props.response.end();
    return;
  }
  const reader = props.body.getReader();
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }
      if (!props.response.write(result.value)) {
        await once(props.response, 'drain');
      }
    }
  } finally {
    reader.releaseLock();
  }
  props.response.end();
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', INTERNAL_BASE_URL);
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
    await writeResponseBody({
      body: serviceResponse.body,
      response,
    });
  } catch (error: unknown) {
    logger.error('[upload-service] request handling failed', { error });
    if (response.headersSent) {
      response.destroy(error instanceof Error ? error : undefined);
      return;
    }
    response.statusCode = 500;
    response.end();
  }
});

server.listen(3000, '0.0.0.0', () => {
  logger.info('CMS media upload service started');
});
