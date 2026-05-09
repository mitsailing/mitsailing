import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockProtect = vi.fn();

vi.mock('@/libs/Arcjet', () => ({
  default: {
    withRule: vi.fn(() => ({ protect: mockProtect })),
  },
}));

vi.mock('@arcjet/next', () => ({
  detectBot: vi.fn(() => ({})),
}));

const intlFn = vi.fn(() => NextResponse.next());

vi.mock('next-intl/middleware', () => ({
  default: vi.fn(() => intlFn),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Headers()),
}));

const getSession = vi.fn();

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession,
    },
  },
}));

describe('proxy', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mockProtect.mockReset();
    mockProtect.mockResolvedValue({ isDenied: () => false });
    getSession.mockReset();
    getSession.mockResolvedValue(null);
    intlFn.mockReset();
    intlFn.mockImplementation(() => NextResponse.next());
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('runs intl middleware when Arcjet is not configured', async () => {
    vi.stubEnv('ARCJET_KEY', '');
    const { default: proxy } = await import('@/proxy');
    const request = new NextRequest(new URL('http://localhost:3008/en/about'));
    const response = await proxy(request);
    expect(response.status).toBe(200);
    expect(intlFn).toHaveBeenCalledWith(request);
    expect(mockProtect).not.toHaveBeenCalled();
  });

  it('continues to session and intl when Arcjet is configured and allows the request', async () => {
    vi.stubEnv('ARCJET_KEY', 'test-key');
    mockProtect.mockResolvedValue({ isDenied: () => false });
    const { default: proxy } = await import('@/proxy');
    const request = new NextRequest(new URL('http://localhost:3008/en/fleet'));
    const response = await proxy(request);
    expect(response.status).toBe(200);
    expect(mockProtect).toHaveBeenCalled();
    expect(intlFn).toHaveBeenCalledWith(request);
  });

  it('returns 403 when Arcjet denies the request', async () => {
    vi.stubEnv('ARCJET_KEY', 'test-key');
    mockProtect.mockResolvedValue({ isDenied: () => true });
    const { default: proxy } = await import('@/proxy');
    const request = new NextRequest(new URL('http://localhost:3008/en/about'));
    const response = await proxy(request);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toEqual({ error: 'Forbidden' });
    expect(intlFn).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated visitors away from account routes', async () => {
    vi.stubEnv('ARCJET_KEY', '');
    getSession.mockResolvedValue(null);
    const { default: proxy } = await import('@/proxy');
    const target = new URL('http://localhost:3008/en/account?tab=security');
    const expectedCallback = `${target.pathname}${target.search}`;
    const request = new NextRequest(target);
    const response = await proxy(request);
    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    if (!location) {
      throw new Error('Expected redirect location');
    }
    const redirectUrl = new URL(location, request.url);
    expect(redirectUrl.pathname).toBe('/login');
    expect(redirectUrl.searchParams.get('callbackUrl')).toBe(expectedCallback);
    expect(intlFn).not.toHaveBeenCalled();
  });

  it('allows authenticated visitors through account routes', async () => {
    vi.stubEnv('ARCJET_KEY', '');
    getSession.mockResolvedValue({ user: { id: 'u1' } });
    const { default: proxy } = await import('@/proxy');
    const request = new NextRequest(
      new URL('http://localhost:3008/en/profile')
    );
    await proxy(request);
    expect(intlFn).toHaveBeenCalledWith(request);
  });
});
