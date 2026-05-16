import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBaseUrl } from '@/utils/Helpers';
import { GET } from './route';

const { isDevAuthShortcutEnabledMock, signInEmailMock } = vi.hoisted(() => ({
  isDevAuthShortcutEnabledMock: vi.fn(),
  signInEmailMock: vi.fn(),
}));

vi.mock('@/libs/auth/devAuthShortcut', () => ({
  devAuthDefaultEmail: 'admin@example.com',
  devAuthDefaultPassword: 'dev-local-change-me',
  isDevAuthShortcutEnabled: isDevAuthShortcutEnabledMock,
}));

vi.mock('@/libs/auth', () => ({
  auth: {
    api: {
      signInEmail: signInEmailMock,
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  isDevAuthShortcutEnabledMock.mockReturnValue(true);
  signInEmailMock.mockResolvedValue(
    new Response(null, {
      status: 200,
      headers: {
        'set-cookie': 'session_token=abc; Path=/; HttpOnly',
      },
    })
  );
});

function devLoginRequest(query?: Record<string, string>) {
  const url = new URL('https://example.test/api/dev-login');
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }
  return new NextRequest(url);
}

describe('GET /api/dev-login', () => {
  it('returns 404 when dev auth shortcut is disabled', async () => {
    isDevAuthShortcutEnabledMock.mockReturnValue(false);

    const response = await GET(devLoginRequest());

    expect(response.status).toBe(404);
    expect(signInEmailMock).not.toHaveBeenCalled();
  });

  it('redirects with session cookies when sign-in succeeds', async () => {
    const response = await GET(devLoginRequest({ redirect: '/admin' }));

    expect(signInEmailMock).toHaveBeenCalledWith({
      body: {
        email: 'admin@example.com',
        password: 'dev-local-change-me',
      },
      asResponse: true,
    });
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`${getBaseUrl()}/admin`);
    expect(response.headers.get('set-cookie')).toContain('session_token=abc');
  });

  it('returns 401 when sign-in fails', async () => {
    signInEmailMock.mockResolvedValue(new Response(null, { status: 401 }));

    const response = await GET(devLoginRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('uses email and password query params when provided', async () => {
    await GET(
      devLoginRequest({
        email: 'Agent@Example.com',
        password: 'custom-pass',
      })
    );

    expect(signInEmailMock).toHaveBeenCalledWith({
      body: {
        email: 'agent@example.com',
        password: 'custom-pass',
      },
      asResponse: true,
    });
  });

  it('falls back to root when redirect query is not a safe internal path', async () => {
    const response = await GET(
      devLoginRequest({ redirect: 'https://evil.example.test/phish' })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`${getBaseUrl()}/`);
  });

  it('copies every auth set-cookie header to the redirect response', async () => {
    const headers = new Headers();
    headers.append('set-cookie', 'session_token=abc; Path=/; HttpOnly');
    headers.append('set-cookie', 'csrf=xyz; Path=/; Secure');
    signInEmailMock.mockResolvedValue(
      new Response(null, { status: 200, headers })
    );

    const response = await GET(devLoginRequest({ redirect: '/admin' }));

    expect(response.headers.getSetCookie()).toEqual([
      'session_token=abc; Path=/; HttpOnly',
      'csrf=xyz; Path=/; Secure',
    ]);
  });
});
