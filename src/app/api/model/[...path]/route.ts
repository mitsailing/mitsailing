import 'server-only';
import { RestApiHandler } from '@zenstackhq/server/api';
import { NextRequestHandler } from '@zenstackhq/server/next';
import type { NextRequest } from 'next/server';
import {
  getAppRolePermissions,
  hasPermission,
  Permission,
} from '@/libs/auth/appPermissions';
import { getSession } from '@/libs/auth/dal';
import { Env } from '@/libs/Env';
import { zenstackForAuthContext } from '@/libs/zenstack/auth';
import { appAuthContextFromSession } from '@/libs/zenstack/authContext';
import { schema } from '../../../../../zenstack/schema';

const MODEL_NAME_MAPPING = {
  EventCategory: 'event-categories',
} as const;

const ALLOWED_MODEL_SEGMENTS: ReadonlySet<string> = new Set(
  Object.values(MODEL_NAME_MAPPING)
);

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function modelSegmentFromContext(
  context: RouteContext
): Promise<string | null> {
  const params = await context.params;
  return params.path[0] ?? null;
}

async function authContextForRequest() {
  const session = await getSession();
  return appAuthContextFromSession(session);
}

async function authorizedAuthContextForRequest() {
  const authContext = await authContextForRequest();
  if (!authContext) {
    return null;
  }
  return hasPermission(
    getAppRolePermissions(authContext.appRole),
    Permission.EVENT_CATEGORIES_MANAGE
  )
    ? authContext
    : undefined;
}

async function getClient(_request: NextRequest) {
  const authContext = await authorizedAuthContextForRequest();
  if (!authContext) {
    throw new Error('Unauthorized');
  }
  return zenstackForAuthContext(authContext);
}

const handler = NextRequestHandler({
  apiHandler: new RestApiHandler({
    endpoint: `${Env.NEXT_PUBLIC_APP_URL}/api/model`,
    modelNameMapping: MODEL_NAME_MAPPING,
    schema,
  }),
  getClient,
  useAppDir: true,
});

async function allowlistedHandler(request: NextRequest, context: RouteContext) {
  const modelSegment = await modelSegmentFromContext(context);
  if (!modelSegment || !ALLOWED_MODEL_SEGMENTS.has(modelSegment)) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const authContext = await authorizedAuthContextForRequest();
  if (authContext === null) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authContext === undefined) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  return handler(request, context);
}

export {
  allowlistedHandler as DELETE,
  allowlistedHandler as GET,
  allowlistedHandler as PATCH,
  allowlistedHandler as POST,
  allowlistedHandler as PUT,
};
