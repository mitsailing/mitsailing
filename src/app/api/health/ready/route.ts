import { Env } from '@/libs/Env';
import { isAuthorizedHealthRequest } from '@/libs/health/auth';
import { healthNoStoreHeaders } from '@/libs/health/constants';
import { getReadinessHealth } from '@/libs/health/readiness';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

export async function GET(request: Request) {
  const response = await readyResponse({ request, includeBody: true });
  return response;
}

export async function HEAD(request: Request) {
  const response = await readyResponse({ request, includeBody: false });
  return response;
}
