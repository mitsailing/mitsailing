import { describe, expect, it } from 'vitest';
import { sanitizeSiteAlertBodyHtml } from '@/libs/mit-sailing/sanitizeSiteAlertHtml';

describe('sanitizeSiteAlertBodyHtml', () => {
  it('keeps root-relative links', () => {
    expect(sanitizeSiteAlertBodyHtml('<a href="/alerts">home</a>')).toBe(
      '<a href="/alerts">home</a>'
    );
  });

  it('adds rel and target on https links', () => {
    expect(
      sanitizeSiteAlertBodyHtml('<a href="https://example.com/p">x</a>')
    ).toBe(
      '<a href="https://example.com/p" rel="noopener noreferrer" target="_blank">x</a>'
    );
  });

  it('keeps br', () => {
    expect(sanitizeSiteAlertBodyHtml('a<br>b')).toBe('a<br />b');
  });

  it('keeps alert links and line breaks while stripping unsupported rich markup', () => {
    expect(
      sanitizeSiteAlertBodyHtml(
        '<strong>Notice</strong><br><a href="/alerts">Read alerts</a>'
      )
    ).toBe('Notice<br /><a href="/alerts">Read alerts</a>');
  });

  it('strips bold but keeps text', () => {
    expect(sanitizeSiteAlertBodyHtml('<b>x</b>')).toBe('x');
  });

  it('drops javascript URLs leaving link text', () => {
    expect(
      sanitizeSiteAlertBodyHtml('<a href="javascript:alert(1)">bad</a>')
    ).toBe('bad');
  });

  it('drops protocol-relative URLs', () => {
    expect(sanitizeSiteAlertBodyHtml('<a href="//evil.test/">x</a>')).toBe('x');
  });

  it('strips raw-text xmp payloads before React rendering', () => {
    expect(
      sanitizeSiteAlertBodyHtml('<xmp><img src=x onerror=alert(1)></xmp>')
    ).toBe('');
  });
});
