import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => ({
  auth: { id: 'auth-instance' },
  handler: {
    GET: vi.fn(),
    POST: vi.fn(),
  },
  toNextJsHandler: vi.fn(),
}));

vi.mock('better-auth/next-js', () => ({
  toNextJsHandler: routeMocks.toNextJsHandler,
}));

vi.mock('@/libs/auth', () => ({
  auth: routeMocks.auth,
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  routeMocks.toNextJsHandler.mockReturnValue(routeMocks.handler);
});

describe('auth route handler', () => {
  it('exports Better Auth GET and POST handlers', async () => {
    const { GET, POST } = await import('./route');

    expect(routeMocks.toNextJsHandler).toHaveBeenCalledWith(routeMocks.auth);
    expect(GET).toBe(routeMocks.handler.GET);
    expect(POST).toBe(routeMocks.handler.POST);
  });
});
