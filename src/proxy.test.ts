import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
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
  headers: vi.fn(() => new globalThis.Headers()),
}));

const getSession = vi.fn();
const resolveLegacyRedirect = vi.fn();

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      getSession,
    },
  },
}));

vi.mock('@/libs/mit-sailing/legacyRedirects', () => ({
  resolveLegacyRedirect,
}));

describe('proxy', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mockProtect.mockReset();
    mockProtect.mockResolvedValue({ isDenied: () => false });
    getSession.mockReset();
    getSession.mockResolvedValue(null);
    resolveLegacyRedirect.mockReset();
    resolveLegacyRedirect.mockResolvedValue(null);
    intlFn.mockReset();
    intlFn.mockImplementation(() => NextResponse.next());
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('Arcjet', () => {
    it('runs intl middleware when Arcjet is not configured', async () => {
      vi.stubEnv('ARCJET_KEY', '');
      const { default: proxy } = await import('@/proxy');
      const request = new NextRequest(
        new globalThis.URL('http://localhost:3008/en/about')
      );
      const response = await proxy(request);
      expect(response.status).toBe(200);
      expect(intlFn).toHaveBeenCalledWith(request);
      expect(mockProtect).not.toHaveBeenCalled();
    });

    it('continues to session and intl when Arcjet is configured and allows the request', async () => {
      vi.stubEnv('ARCJET_KEY', 'test-key');
      mockProtect.mockResolvedValue({ isDenied: () => false });
      const { default: proxy } = await import('@/proxy');
      const request = new NextRequest(
        new globalThis.URL('http://localhost:3008/en/fleet')
      );
      const response = await proxy(request);
      expect(response.status).toBe(200);
      expect(mockProtect).toHaveBeenCalled();
      expect(intlFn).toHaveBeenCalledWith(request);
    });

    it('returns 403 when Arcjet denies the request', async () => {
      vi.stubEnv('ARCJET_KEY', 'test-key');
      mockProtect.mockResolvedValue({ isDenied: () => true });
      const { default: proxy } = await import('@/proxy');
      const request = new NextRequest(
        new globalThis.URL('http://localhost:3008/en/about')
      );
      const response = await proxy(request);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body).toEqual({ error: 'Forbidden' });
      expect(intlFn).not.toHaveBeenCalled();
    });
  });

  describe('authentication / account routes', () => {
    it('allows authenticated account routes after Arcjet approval', async () => {
      vi.stubEnv('ARCJET_KEY', 'some-non-empty-key');
      getSession.mockResolvedValue({ user: { id: 'u1' } });
      const { default: proxy } = await import('@/proxy');
      const request = new NextRequest(
        new globalThis.URL('http://localhost:3008/en/account?tab=security')
      );
      const response = await proxy(request);

      expect(response.status).toBe(200);
      expect(mockProtect).toHaveBeenCalledWith(request);
      expect(intlFn).toHaveBeenCalledWith(request);
    });

    it('redirects unauthenticated account routes after Arcjet approval', async () => {
      vi.stubEnv('ARCJET_KEY', 'some-non-empty-key');
      getSession.mockResolvedValue(null);
      const { default: proxy } = await import('@/proxy');
      const target = new globalThis.URL(
        'http://localhost:3008/en/account?tab=security'
      );
      const request = new NextRequest(target);
      const response = await proxy(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      if (!location) {
        throw new Error('Expected redirect location');
      }
      const redirectUrl = new globalThis.URL(location, request.url);
      expect(redirectUrl.pathname).toBe('/login');
      expect(redirectUrl.searchParams.get('callbackUrl')).toBe(
        `${target.pathname}${target.search}`
      );
      expect(mockProtect).toHaveBeenCalledWith(request);
      expect(intlFn).not.toHaveBeenCalled();
    });

    it('redirects unauthenticated visitors away from account routes', async () => {
      vi.stubEnv('ARCJET_KEY', '');
      getSession.mockResolvedValue(null);
      const { default: proxy } = await import('@/proxy');
      const target = new globalThis.URL(
        'http://localhost:3008/en/account?tab=security'
      );
      const expectedCallback = `${target.pathname}${target.search}`;
      const request = new NextRequest(target);
      const response = await proxy(request);
      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      if (!location) {
        throw new Error('Expected redirect location');
      }
      const redirectUrl = new globalThis.URL(location, request.url);
      expect(redirectUrl.pathname).toBe('/login');
      expect(redirectUrl.searchParams.get('callbackUrl')).toBe(
        expectedCallback
      );
      expect(intlFn).not.toHaveBeenCalled();
    });

    it('allows authenticated visitors through account routes', async () => {
      vi.stubEnv('ARCJET_KEY', '');
      getSession.mockResolvedValue({ user: { id: 'u1' } });
      const { default: proxy } = await import('@/proxy');
      const request = new NextRequest(
        new globalThis.URL('http://localhost:3008/en/profile')
      );
      const response = await proxy(request);
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
      expect(intlFn).toHaveBeenCalledWith(request);
    });
  });

  describe('legacy redirects', () => {
    it('matches uppercase legacy dotted paths before static file exclusions', async () => {
      const { config } = await import('@/proxy');

      expect(
        unstable_doesMiddlewareMatch({
          config,
          nextConfig: {},
          url: '/calendar.PHP',
        })
      ).toBe(true);
      expect(
        unstable_doesMiddlewareMatch({
          config,
          nextConfig: {},
          url: '/Info/Boats.HTML',
        })
      ).toBe(true);
    });

    it('permanently redirects legacy php paths before intl middleware', async () => {
      resolveLegacyRedirect.mockResolvedValue('/calendar');
      const { default: proxy } = await import('@/proxy');
      const request = new NextRequest(
        new globalThis.URL('http://localhost:3008/calendar.php?month=may')
      );

      const response = await proxy(request);

      expect(response.status).toBe(308);
      expect(response.headers.get('location')).toBe(
        new globalThis.URL('/calendar', request.url).toString()
      );
      expect(resolveLegacyRedirect).toHaveBeenCalledWith({
        locale: 'en',
        pathname: '/calendar.php',
      });
      expect(intlFn).not.toHaveBeenCalled();
    });

    it('continues to intl for unmatched dotted legacy paths', async () => {
      resolveLegacyRedirect.mockResolvedValue(null);
      const { default: proxy } = await import('@/proxy');
      const request = new NextRequest(
        new globalThis.URL('http://localhost:3008/missing.php')
      );

      const response = await proxy(request);

      expect(response.status).toBe(200);
      expect(intlFn).toHaveBeenCalledWith(request);
    });
  });
});
