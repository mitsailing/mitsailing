import { describe, expect, it } from 'vitest';
import { isAllowedNewsHref } from '@/libs/mit-sailing/hrefSafety';

describe('isAllowedNewsHref', () => {
  it('allows root-relative http and mailto hrefs', () => {
    const allowed = [
      '/news',
      '/ok?x=1#h',
      '/foo\\bar',
      'https://example.com/p',
      'http://example.com/p',
      'mailto:sailing@mit.edu',
    ];
    for (const href of allowed) {
      expect(isAllowedNewsHref(href)).toBe(true);
    }
  });

  it('rejects root-relative hrefs that leave the origin', () => {
    const rejected = [
      '/\\evil.test',
      '/\\\\evil.test',
      '//evil.test',
      '//',
      '/\\',
      '/\\href-safety-a.invalid',
      '/\\href-safety-b.invalid',
      '/\t/href-safety-a.invalid',
    ];
    for (const href of rejected) {
      expect(isAllowedNewsHref(href)).toBe(false);
    }
  });
});
