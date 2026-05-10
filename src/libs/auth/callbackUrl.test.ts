import { describe, expect, it } from 'vitest';
import { authHrefWithCallback, safeAuthCallbackUrl } from './callbackUrl';

describe('safeAuthCallbackUrl', () => {
  it('visitor returns to app relative paths', () => {
    expect(safeAuthCallbackUrl('/')).toBe('/');
    expect(safeAuthCallbackUrl('/fleet')).toBe('/fleet');
    expect(safeAuthCallbackUrl('/fleet?category=dinghy#boats')).toBe(
      '/fleet?category=dinghy#boats'
    );
  });

  it('visitor cannot return to external URLs', () => {
    expect(safeAuthCallbackUrl('https://example.com/fleet', '/')).toBe('/');
    expect(safeAuthCallbackUrl('//example.com/fleet', '/')).toBe('/');
  });

  it('visitor cannot return to malformed relative paths', () => {
    expect(safeAuthCallbackUrl('fleet', '/login')).toBe('/login');
    expect(safeAuthCallbackUrl('/\\example.com/fleet', '/')).toBe('/');
    expect(safeAuthCallbackUrl('', '/fleet')).toBe('/fleet');
    expect(safeAuthCallbackUrl('   ', '/fleet')).toBe('/fleet');
  });

  it('visitor cannot return to paths with control characters', () => {
    expect(safeAuthCallbackUrl('/fleet/\nadmin', '/login')).toBe('/login');
    expect(safeAuthCallbackUrl('/fleet/\u007Fadmin', '/login')).toBe('/login');
  });

  it('visitor cannot return to overly long paths', () => {
    expect(safeAuthCallbackUrl(`/${'a'.repeat(2000)}`, '/login')).toBe(
      '/login'
    );
  });

  it('visitor gets a safe fallback when fallback input is unsafe', () => {
    expect(safeAuthCallbackUrl(null, 'https://example.com/fleet')).toBe('/');
    expect(safeAuthCallbackUrl(null, '/\\example.com/fleet')).toBe('/');
  });

  it('visitor can keep an intentionally empty fallback path', () => {
    expect(safeAuthCallbackUrl(null, '')).toBe('');
    expect(safeAuthCallbackUrl('https://example.com/fleet', '')).toBe('');
  });
});

describe('authHrefWithCallback', () => {
  it('visitor carries callback query into auth hrefs', () => {
    expect(authHrefWithCallback('/login', '/fleet')).toBe(
      '/login?callbackUrl=%2Ffleet'
    );
  });

  it('visitor keeps existing auth query params with callbacks', () => {
    expect(authHrefWithCallback('/login?unlocked=1', '/fleet')).toBe(
      '/login?unlocked=1&callbackUrl=%2Ffleet'
    );
  });

  it('visitor keeps auth href hashes with callbacks', () => {
    expect(authHrefWithCallback('/login#form', '/fleet#boats')).toBe(
      '/login?callbackUrl=%2Ffleet%23boats#form'
    );
  });

  it('visitor gets unchanged auth hrefs for missing or unsafe callbacks', () => {
    expect(authHrefWithCallback('/login', null)).toBe('/login');
    expect(authHrefWithCallback('/login', 'https://example.com/fleet')).toBe(
      '/login'
    );
  });

  it('visitor gets unchanged external auth hrefs', () => {
    expect(authHrefWithCallback('https://example.com/login', '/fleet')).toBe(
      'https://example.com/login'
    );
    expect(authHrefWithCallback('//example.com/login', '/fleet')).toBe(
      '//example.com/login'
    );
  });

  it('visitor gets unchanged malformed auth hrefs', () => {
    expect(authHrefWithCallback('', '/fleet')).toBe('');
    expect(authHrefWithCallback('login', '/fleet')).toBe('login');
    expect(authHrefWithCallback('/\\example.com/login', '/fleet')).toBe(
      '/\\example.com/login'
    );
  });
});
