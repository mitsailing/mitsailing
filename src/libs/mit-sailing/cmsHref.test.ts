import { describe, expect, it } from 'vitest';
import {
  externalCmsLinkProps,
  isAppRelativeCmsHref,
  safeCmsHref,
  safeCmsMenuItemHref,
} from '@/libs/mit-sailing/cmsHref';

describe('cmsHref', () => {
  it('accepts safe cms hrefs', () => {
    expect(safeCmsHref('/classes')).toBe('/classes');
    expect(safeCmsHref('#')).toBe('#');
    expect(safeCmsHref('https://sailing.mit.edu')).toBe(
      'https://sailing.mit.edu'
    );
    expect(safeCmsHref('mailto:sailing@mit.edu')).toBe(
      'mailto:sailing@mit.edu'
    );
    expect(safeCmsHref('tel:+16172534880')).toBe('tel:+16172534880');
  });

  it('rejects unsafe cms hrefs', () => {
    const unsafeScriptHref = `${['java', 'script'].join('')}:alert(1)`;

    expect(safeCmsHref(unsafeScriptHref)).toBeNull();
    expect(safeCmsHref('data:text/html,hello')).toBeNull();
    expect(safeCmsHref('//example.com')).toBeNull();
    expect(safeCmsHref('/\\example.com')).toBeNull();
    expect(safeCmsHref('/classes/../admin')).toBeNull();
    expect(safeCmsHref('/classes/%2e%2e/admin')).toBeNull();
    expect(safeCmsHref('relative/path')).toBeNull();
  });

  it('marks only app relative cms hrefs as internal', () => {
    expect(isAppRelativeCmsHref('/about')).toBe(true);
    expect(isAppRelativeCmsHref('https://sailing.mit.edu')).toBe(false);
  });

  describe('safeCmsMenuItemHref', () => {
    it('accepts normalized paths and allowed absolute urls', () => {
      expect(safeCmsMenuItemHref('/classes')).toBe('/classes');
      expect(safeCmsMenuItemHref('classes')).toBe('/classes');
      expect(safeCmsMenuItemHref('#')).toBe('#');
      expect(safeCmsMenuItemHref('https://sailing.mit.edu')).toBe(
        'https://sailing.mit.edu'
      );
      expect(safeCmsMenuItemHref('mailto:sailing@mit.edu')).toBe(
        'mailto:sailing@mit.edu'
      );
    });

    it('rejects unsafe or unsupported menu hrefs', () => {
      const unsafeScriptHref = `${['java', 'script'].join('')}:alert(1)`;

      expect(safeCmsMenuItemHref(unsafeScriptHref)).toBeUndefined();
      expect(safeCmsMenuItemHref('data:text/html,hello')).toBeUndefined();
      expect(safeCmsMenuItemHref('//example.com')).toBeUndefined();
      expect(safeCmsMenuItemHref('/classes/../admin')).toBeUndefined();
      expect(safeCmsMenuItemHref('tel:+16172534880')).toBeUndefined();
      expect(safeCmsMenuItemHref('/about bad')).toBeUndefined();
    });

    it('trims outer whitespace before validation', () => {
      expect(safeCmsMenuItemHref('  /about  ')).toBe('/about');
      expect(safeCmsMenuItemHref('\n/classes\t')).toBe('/classes');
    });
  });

  it('opens http links with external protections', () => {
    expect(externalCmsLinkProps('https://sailing.mit.edu')).toEqual({
      rel: 'noopener noreferrer',
      target: '_blank',
    });
    expect(externalCmsLinkProps('HTTPS://sailing.mit.edu')).toEqual({
      rel: 'noopener noreferrer',
      target: '_blank',
    });
    expect(externalCmsLinkProps('http://sailing.mit.edu')).toEqual({
      rel: 'noopener noreferrer',
      target: '_blank',
    });
    expect(externalCmsLinkProps('mailto:sailing@mit.edu')).toEqual({});
    expect(externalCmsLinkProps('/about')).toEqual({});
  });
});
