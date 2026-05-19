import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@/libs/auth/roles';

vi.mock('server-only', () => ({}));

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

type NextRequestHandlerOptions = {
  getClient: (request: NextRequest) => Promise<unknown>;
};

const mocks = vi.hoisted(() => {
  const handler = vi.fn(
    async (_request: NextRequest, _context: RouteContext) => {
      await Promise.resolve();
      return Response.json({ data: [] });
    }
  );
  const setAuth = vi.fn((authContext: unknown) => ({
    authContext,
    model: 'protected-client',
  }));
  return {
    getSession: vi.fn(),
    handler,
    nextRequestHandler: vi.fn((_options: NextRequestHandlerOptions) => handler),
    restApiHandler: vi.fn(function RestApiHandler(options: unknown) {
      return { options };
    }),
    setAuth,
    zenstackForAuthContext: vi.fn((authContext: unknown) =>
      setAuth(authContext)
    ),
  };
});

vi.mock('@zenstackhq/server/api', () => ({
  RestApiHandler: mocks.restApiHandler,
}));

vi.mock('@zenstackhq/server/next', () => ({
  NextRequestHandler: mocks.nextRequestHandler,
}));

vi.mock('@/libs/auth/dal', () => ({
  getSession: mocks.getSession,
}));

vi.mock('@/libs/Env', () => ({
  Env: { NEXT_PUBLIC_APP_URL: 'https://example.test' },
}));

vi.mock('@/libs/zenstack/auth', () => ({
  zenstackForAuthContext: mocks.zenstackForAuthContext,
}));

vi.mock('../../../../../zenstack/schema', () => ({
  schema: { models: {} },
}));

function request(path: string) {
  return new NextRequest(`https://example.test${path}`);
}

function context(path: string[]): RouteContext {
  return { params: Promise.resolve({ path }) };
}

function session(props?: {
  appRole?: unknown;
  banned?: boolean;
  emailVerified?: boolean;
  impersonatedBy?: string | null;
}) {
  return {
    session: { impersonatedBy: props?.impersonatedBy ?? null },
    user: {
      appRole: props?.appRole ?? Role.ADMIN,
      banned: props?.banned ?? false,
      emailVerified: props?.emailVerified ?? true,
      id: 'admin-1',
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mocks.getSession.mockResolvedValue(session());
});

function nextRequestHandlerOptions(): NextRequestHandlerOptions {
  const options = mocks.nextRequestHandler.mock.calls[0]?.[0];
  if (!options) {
    throw new Error('Expected NextRequestHandler options');
  }
  return options;
}

describe('/api/model/[...path]', () => {
  it.each([
    ['unauthenticated session', null],
    ['impersonated session', session({ impersonatedBy: 'owner-1' })],
    ['banned user', session({ banned: true })],
    ['unverified user', session({ emailVerified: false })],
  ])('returns 401 before dispatch for %s', async (_name, authSession) => {
    mocks.getSession.mockResolvedValue(authSession);
    const { GET } = await import('./route');

    const response = await GET(
      request('/api/model/event-categories'),
      context(['event-categories'])
    );

    expect(response.status).toBe(401);
    expect(mocks.handler).not.toHaveBeenCalled();
    expect(mocks.zenstackForAuthContext).not.toHaveBeenCalled();
  });

  it('returns 403 before dispatch for sessions without event category management', async () => {
    mocks.getSession.mockResolvedValue(session({ appRole: Role.DOCK_STAFF }));
    const { GET } = await import('./route');

    const response = await GET(
      request('/api/model/event-categories'),
      context(['event-categories'])
    );

    expect(response.status).toBe(403);
    expect(mocks.handler).not.toHaveBeenCalled();
    expect(mocks.zenstackForAuthContext).not.toHaveBeenCalled();
  });

  it.each(['user', 'event', 'session'])(
    'returns 404 before dispatch for %s',
    async (modelSegment) => {
      const { GET } = await import('./route');

      const response = await GET(
        request(`/api/model/${modelSegment}`),
        context([modelSegment])
      );

      expect(response.status).toBe(404);
      expect(mocks.handler).not.toHaveBeenCalled();
      expect(mocks.zenstackForAuthContext).not.toHaveBeenCalled();
    }
  );

  it('dispatches allowlisted event categories with protected auth', async () => {
    const { GET } = await import('./route');
    const routeContext = context(['event-categories']);
    const routeRequest = request('/api/model/event-categories');

    const response = await GET(routeRequest, routeContext);

    expect(response.status).toBe(200);
    expect(mocks.handler).toHaveBeenCalledWith(routeRequest, routeContext);
    await nextRequestHandlerOptions().getClient(routeRequest);
    expect(mocks.zenstackForAuthContext).toHaveBeenCalledWith({
      appRole: Role.ADMIN,
      id: 'admin-1',
    });
  });

  it('configures REST model mapping for event categories only', async () => {
    await import('./route');

    expect(mocks.restApiHandler).toHaveBeenCalledWith({
      endpoint: 'https://example.test/api/model',
      modelNameMapping: {
        EventCategory: 'event-categories',
      },
      schema: { models: {} },
    });
    expect(mocks.nextRequestHandler).toHaveBeenCalledWith({
      apiHandler: expect.any(Object),
      getClient: expect.any(Function),
      useAppDir: true,
    });
  });
});
