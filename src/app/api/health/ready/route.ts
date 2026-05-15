import { connection } from 'next/server';
import { Env } from '@/libs/Env';
import { isAuthorizedHealthRequest } from '@/libs/health/auth';
import { healthNoStoreHeaders } from '@/libs/health/constants';
import { getReadinessHealth } from '@/libs/health/readiness';

export const runtime = 'nodejs';

async function safeConnection(): Promise<void> {
  try {
    await connection();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('outside a request scope')) {
      return;
    }
    throw error;
  }
}

function unauthorizedResponse(includeBody: boolean) {
  const responseInit = { status: 401, headers: healthNoStoreHeaders };
  if (!includeBody) {
    return new Response(null, responseInit);
  }

  return Response.json({ status: 'unauthorized' }, responseInit);
}

async function readyResponse(params: {
  request: Request;
  includeBody: boolean;
}): Promise<Response> {
  const authorized = isAuthorizedHealthRequest({
    authorizationHeader: params.request.headers.get('authorization'),
    secret: Env.HEALTHCHECK_SECRET,
  });

  if (!authorized) {
    return unauthorizedResponse(params.includeBody);
  }

  // Tie readiness to the request so Prisma/db work isn't incorrectly cached.
  await safeConnection();

  const health = await getReadinessHealth();
  const responseInit = {
    status: health.status === 'ok' ? 200 : 503,
    headers: healthNoStoreHeaders,
  };

  if (!params.includeBody) {
    return new Response(null, responseInit);
  }

  return Response.json(health, responseInit);
}

export function GET(request: Request) {
  return readyResponse({ request, includeBody: true });
}

export function HEAD(request: Request) {
  return readyResponse({ request, includeBody: false });
}
