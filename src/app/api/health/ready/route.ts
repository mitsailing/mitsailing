import { NextResponse } from 'next/server';
import { Env } from '@/libs/Env';
import { isAuthorizedHealthRequest } from '@/libs/health/auth';
import { healthNoStoreHeaders } from '@/libs/health/constants';
import type { ReadinessMode } from '@/libs/health/readiness';
import { getReadinessHealth } from '@/libs/health/readiness';
import { safeConnection } from '@/libs/health/utils';

export const runtime = 'nodejs';

function unauthorizedResponse(includeBody: boolean) {
  const responseInit = { status: 401, headers: healthNoStoreHeaders };
  if (!includeBody) {
    return new NextResponse(null, responseInit);
  }

  return NextResponse.json({ status: 'unauthorized' }, responseInit);
}

function readinessModeForRequest(request: Request): ReadinessMode {
  const requestedMode = new URL(request.url).searchParams.get('mode');
  return requestedMode === 'service' ? 'service' : 'public';
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

  const health = await getReadinessHealth({
    mode: readinessModeForRequest(params.request),
  });
  const responseInit = {
    status: health.status === 'ok' ? 200 : 503,
    headers: healthNoStoreHeaders,
  };

  if (!params.includeBody) {
    return new NextResponse(null, responseInit);
  }

  return NextResponse.json(health, responseInit);
}

export async function GET(request: Request) {
  const response = await readyResponse({ request, includeBody: true });
  return response;
}

export async function HEAD(request: Request) {
  const response = await readyResponse({ request, includeBody: false });
  return response;
}
