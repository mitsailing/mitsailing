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

  it('strips bold but keeps text', () => {
    expect(sanitizeSiteAlertBodyHtml('<b>x</b>')).toBe('x');
  });

  it('drops javascript URLs leaving link text', () => {
    expect(
      sanitizeSiteAlertBodyHtml('<a href="javascript:alert(1)">bad</a>')
    ).toBe('bad');
  });

  it('drops xmp raw-text contents', () => {
    expect(
      sanitizeSiteAlertBodyHtml(
        'Ready<xmp><a href="javascript:alert(1)">bad</a></xmp>'
      )
    ).toBe('Ready');
  });

  it('drops protocol-relative URLs', () => {
    expect(sanitizeSiteAlertBodyHtml('<a href="//evil.test/">x</a>')).toBe('x');
  });
});
