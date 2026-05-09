import { describe, expect, it } from 'vitest';
import {
  hashFromHref,
  isNavLinkActive,
  normalizeNavPath,
} from './navPathMatch';

describe('normalizeNavPath', () => {
  it('strips trailing slash except root', () => {
    expect(normalizeNavPath('/fleet/foo/')).toBe('/fleet/foo');
    expect(normalizeNavPath('/')).toBe('/');
  });

  it('normalizes whitespace-only input to root', () => {
    expect(normalizeNavPath('   ')).toBe('/');
  });

  it('drops query on pathname segment', () => {
    expect(normalizeNavPath('/events/?foo=bar')).toBe('/events');
  });

  it('drops hash from pathname fragment', () => {
    expect(normalizeNavPath('/classes#x')).toBe('/classes');
  });
});

describe('hashFromHref', () => {
  it('returns decoded hash when present', () => {
    expect(hashFromHref('/classes/#foo%20bar')).toBe('foo bar');
  });

  it('returns undefined when hash absent', () => {
    expect(hashFromHref('/classes')).toBeUndefined();
  });

  it('returns empty string for trailing hash only', () => {
    expect(hashFromHref('/classes#')).toBe('');
  });
});

describe('isNavLinkActive', () => {
  it('matches path-only link when pathname matches and route has no hash', () => {
    expect(isNavLinkActive('/events/', '', '/events/')).toBe(true);
    expect(isNavLinkActive('/events', '', '/events')).toBe(true);
  });

  it('does not mark path-only link when hash present on route', () => {
    expect(isNavLinkActive('/classes', 'windsurfing', '/classes/')).toBe(false);
  });

  it('matches hashed link when path and hash match', () => {
    expect(isNavLinkActive('/classes/', 'slug', '/classes/#slug')).toBe(true);
  });

  it('does not match hashed link when route hash differs', () => {
    expect(isNavLinkActive('/classes', 'a', '/classes/#b')).toBe(false);
  });

  it('requires hash match when href includes hash', () => {
    expect(isNavLinkActive('/classes', '', '/classes/#slug')).toBe(false);
  });
});
