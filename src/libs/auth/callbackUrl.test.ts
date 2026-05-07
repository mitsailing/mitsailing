import { describe, expect, it } from 'vitest';
import { authHrefWithCallback, safeAuthCallbackUrl } from './callbackUrl';

describe('safeAuthCallbackUrl', () => {
  it('accepts app relative paths', () => {
    expect(safeAuthCallbackUrl('/fleet/')).toBe('/fleet/');
    expect(safeAuthCallbackUrl('/fleet/?category=dinghy#boats')).toBe(
      '/fleet/?category=dinghy#boats'
    );
  });

  it('rejects external URLs', () => {
    expect(safeAuthCallbackUrl('https://example.com/fleet', '/')).toBe('/');
    expect(safeAuthCallbackUrl('//example.com/fleet', '/')).toBe('/');
  });

  it('rejects malformed relative paths', () => {
    expect(safeAuthCallbackUrl('/\\example.com/fleet', '/')).toBe('/');
    expect(safeAuthCallbackUrl('', '/fleet/')).toBe('/fleet/');
    expect(safeAuthCallbackUrl('   ', '/fleet/')).toBe('/fleet/');
  });

  it('normalizes unsafe fallbacks', () => {
    expect(safeAuthCallbackUrl(null, 'https://example.com/fleet')).toBe('/');
    expect(safeAuthCallbackUrl(null, '/\\example.com/fleet')).toBe('/');
  });
});

describe('authHrefWithCallback', () => {
  it('adds callback query to auth hrefs', () => {
    expect(authHrefWithCallback('/login', '/fleet/')).toBe(
      '/login?callbackUrl=%2Ffleet%2F'
    );
  });

  it('preserves existing auth query params', () => {
    expect(authHrefWithCallback('/login?unlocked=1', '/fleet/')).toBe(
      '/login?unlocked=1&callbackUrl=%2Ffleet%2F'
    );
  });
});
