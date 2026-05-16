import type { LocalePrefixMode } from 'next-intl/routing';

/** Locale prefix strategy for next-intl routing. */
const localePrefix: LocalePrefixMode = 'never';

export const AppConfig = {
  name: 'MIT Sailing',
  i18n: {
    locales: ['en'],
    defaultLocale: 'en',
    localePrefix,
  },
};
