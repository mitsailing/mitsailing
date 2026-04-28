import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './I18nRouting';

// Default locale and message files live under `src/locales/` (next-intl).
// Add or edit non-default locale JSON there, or re-enable Crowdin when ready.

export default getRequestConfig(async ({ requestLocale }) => {
  // Typically corresponds to the `[locale]` segment
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    // oxlint-disable-next-line unicorn/no-await-expression-member
    messages: (await import(`../locales/${locale}.json`)).default,
  };
});
