import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    getSession.mockReset();
    getSession.mockResolvedValue(null);
    intlFn.mockReset();
    intlFn.mockImplementation(() => NextResponse.next());
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('runs intl middleware for public routes', async () => {
    const { default: proxy } = await import('@/proxy');
    const request = new NextRequest(new URL('http://localhost:3008/en/about'));
    const response = await proxy(request);
    expect(response.status).toBe(200);
    expect(intlFn).toHaveBeenCalledWith(request);
  });

  describe('authentication / account routes', () => {
    it('allows authenticated account routes', async () => {
      getSession.mockResolvedValue({ user: { id: 'u1' } });
      const { default: proxy } = await import('@/proxy');
      const request = new NextRequest(
        new URL('http://localhost:3008/en/account?tab=security')
      );
      const response = await proxy(request);

      expect(response.status).toBe(200);
      expect(intlFn).toHaveBeenCalledWith(request);
    });

    it('redirects unauthenticated account routes', async () => {
      getSession.mockResolvedValue(null);
      const { default: proxy } = await import('@/proxy');
      const target = new URL('http://localhost:3008/en/account?tab=security');
      const request = new NextRequest(target);
      const response = await proxy(request);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      if (!location) {
        throw new Error('Expected redirect location');
      }
      const redirectUrl = new URL(location, request.url);
      expect(redirectUrl.pathname).toBe('/login');
      expect(redirectUrl.searchParams.get('callbackUrl')).toBe(
        `${target.pathname}${target.search}`
      );
      expect(intlFn).not.toHaveBeenCalled();
    });

    it('redirects unauthenticated visitors away from account routes', async () => {
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
      expect(redirectUrl.searchParams.get('callbackUrl')).toBe(
        expectedCallback
      );
      expect(intlFn).not.toHaveBeenCalled();
    });

    it('allows authenticated visitors through account routes', async () => {
      getSession.mockResolvedValue({ user: { id: 'u1' } });
      const { default: proxy } = await import('@/proxy');
      const request = new NextRequest(
        new URL('http://localhost:3008/en/profile')
      );
      const response = await proxy(request);
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
      expect(intlFn).toHaveBeenCalledWith(request);
    });
  });
});
