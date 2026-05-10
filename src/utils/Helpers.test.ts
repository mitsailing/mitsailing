import { describe, expect, it } from 'vitest';
import { routing } from '@/libs/I18nRouting';
import { getI18nPath } from './Helpers';

describe('Helpers', () => {
  describe('getI18nPath', () => {
    it('keeps default locale paths unchanged', () => {
      const url = '/random-url';
      const locale = routing.defaultLocale;

      expect(getI18nPath(url, locale)).toBe(url);
    });

    it('prefixes non-default locale paths', () => {
      const url = '/random-url';
      const locale = 'fr';

      expect(getI18nPath(url, locale)).toMatch(/^\/fr/);
    });

    it('returns non-default locale roots without trailing slashes', () => {
      expect(getI18nPath('/', 'fr')).toBe('/fr');
    });
  });
});
